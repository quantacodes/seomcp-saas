import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { sqlite } from "../db/index";
import { validateSession, SESSION_COOKIE_NAME, type SessionData } from "../auth/session";
import {
  createTeam,
  getUserTeam,
  updateTeam,
  deleteTeam,
  getMemberRole,
  canManageMembers,
  changeMemberRole,
  removeMember,
  leaveTeam,
  getTeamUsage,
  type TeamRole,
} from "../teams/teams";
import {
  createInvite,
  acceptInvite,
  buildInviteUrl,
  sendInviteEmail,
} from "../teams/invites";

export const teamRoutes = new Hono();

// ── Helpers ──
function getSession(c: any): SessionData | null {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

function requireJson(c: any): Response | null {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  return null;
}

function requireAuth(c: any): SessionData | Response {
  const session = getSession(c);
  if (!session) {
    return c.json({ error: "Authentication required" }, 401);
  }
  return session;
}

const VALID_ROLES: TeamRole[] = ["admin", "member"];

/**
 * POST /api/teams — Create a new team.
 * Only agency plan users can create teams.
 */
teamRoutes.post("/api/teams", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;

  // Check plan
  const user = sqlite
    .query("SELECT plan FROM users WHERE id = ?")
    .get(session.userId) as { plan: string } | null;

  if (!user || (user.plan !== "agency" && user.plan !== "enterprise")) {
    return c.json({ error: "Team creation requires Agency or Enterprise plan" }, 403);
  }

  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  if (!body.name || body.name.trim().length < 2 || body.name.trim().length > 50) {
    return c.json({ error: "Team name must be 2-50 characters" }, 400);
  }

  const { team, error } = createTeam(session.userId, body.name);

  if (error) {
    return c.json({ error }, 409);
  }

  return c.json({ team }, 201);
});

/**
 * GET /api/teams — Get current user's team.
 */
teamRoutes.get("/api/teams", async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;
  const team = getUserTeam(session.userId);

  if (!team) {
    return c.json({ team: null });
  }

  // Get usage stats
  const usage = getTeamUsage(team.id);

  return c.json({
    team: {
      ...team,
      usage: {
        totalCalls: usage.totalCalls,
        memberUsage: usage.memberUsage,
      },
    },
  });
});

/**
 * PATCH /api/teams — Update team name.
 * Owner or admin only.
 */
teamRoutes.patch("/api/teams", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;
  const team = getUserTeam(session.userId);

  if (!team) {
    return c.json({ error: "You are not in a team" }, 404);
  }

  const role = getMemberRole(team.id, session.userId);
  if (!role || !canManageMembers(role)) {
    return c.json({ error: "Only owners and admins can update the team" }, 403);
  }

  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  if (!body.name || body.name.trim().length < 2 || body.name.trim().length > 50) {
    return c.json({ error: "Team name must be 2-50 characters" }, 400);
  }

  updateTeam(team.id, body.name);

  return c.json({ success: true });
});

/**
 * DELETE /api/teams — Delete team.
 * Owner only.
 */
teamRoutes.delete("/api/teams", async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;
  const team = getUserTeam(session.userId);

  if (!team) {
    return c.json({ error: "You are not in a team" }, 404);
  }

  if (team.ownerId !== session.userId) {
    return c.json({ error: "Only the team owner can delete the team" }, 403);
  }

  deleteTeam(team.id);

  return c.json({ success: true });
});

/**
 * POST /api/teams/invite — Invite a member.
 * Owner or admin only.
 */
teamRoutes.post("/api/teams/invite", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;
  const team = getUserTeam(session.userId);

  if (!team) {
    return c.json({ error: "You are not in a team" }, 404);
  }

  const role = getMemberRole(team.id, session.userId);
  if (!role || !canManageMembers(role)) {
    return c.json({ error: "Only owners and admins can invite members" }, 403);
  }

  const body = await c.req.json<{ email?: string; role?: string }>().catch(() => ({}));

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ error: "Valid email is required" }, 400);
  }

  const inviteRole = (body.role as TeamRole) || "member";
  if (!VALID_ROLES.includes(inviteRole)) {
    return c.json({ error: "Role must be 'admin' or 'member'" }, 400);
  }

  // Only owners can invite admins
  if (inviteRole === "admin" && role !== "owner") {
    return c.json({ error: "Only the owner can invite admins" }, 403);
  }

  const { memberId, autoJoined, token, error } = createInvite(team.id, body.email, inviteRole);

  if (error) {
    return c.json({ error }, 409);
  }

  if (!autoJoined && token) {
    // Send invite email
    const inviteUrl = buildInviteUrl(token);
    const inviter = sqlite
      .query("SELECT email FROM users WHERE id = ?")
      .get(session.userId) as { email: string };

    sendInviteEmail(body.email.toLowerCase(), team.name, inviteUrl, inviter.email).catch(() => {});
  }

  return c.json({
    memberId,
    autoJoined,
    message: autoJoined
      ? "User was already registered and has been added to the team"
      : "Invite sent! They have 48 hours to accept.",
  }, 201);
});

/**
 * GET /dashboard/teams/invite/:token — Accept an invite (magic link).
 * Under /dashboard/ path so the session cookie (path=/dashboard) is included.
 * Redirects to dashboard after acceptance.
 */
teamRoutes.get("/dashboard/teams/invite/:token", async (c) => {
  const token = c.req.param("token");

  if (!token) {
    return c.html(inviteResultHtml(false, "Invalid invite link."), 400);
  }

  // Check if user is logged in (session cookie)
  const sessionId = c.req.header("Cookie")?.match(/session=([^;]+)/)?.[1];

  if (!sessionId) {
    // Not logged in — redirect to login with return URL
    const returnUrl = encodeURIComponent(`/dashboard/teams/invite/${token}`);
    return c.redirect(`/dashboard/login?return=${returnUrl}`);
  }

  // Validate session
  const session = sqlite
    .query("SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?")
    .get(sessionId, Math.floor(Date.now() / 1000)) as { user_id: string } | null;

  if (!session) {
    const returnUrl = encodeURIComponent(`/dashboard/teams/invite/${token}`);
    return c.redirect(`/dashboard/login?return=${returnUrl}`);
  }

  const { success, teamId, error } = acceptInvite(token, session.user_id);

  if (!success) {
    return c.html(inviteResultHtml(false, error || "Failed to accept invite"), 400);
  }

  // Get team name
  const team = sqlite
    .query("SELECT name FROM teams WHERE id = ?")
    .get(teamId!) as { name: string };

  return c.html(inviteResultHtml(true, `Welcome to <strong>${escapeHtml(team.name)}</strong>!`));
});

/**
 * POST /api/teams/members/:id/role — Change member role.
 * Owner only.
 */
teamRoutes.post("/api/teams/members/:id/role", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;
  const memberId = c.req.param("id");
  const team = getUserTeam(session.userId);

  if (!team) {
    return c.json({ error: "You are not in a team" }, 404);
  }

  if (team.ownerId !== session.userId) {
    return c.json({ error: "Only the owner can change roles" }, 403);
  }

  const body = await c.req.json<{ role?: string }>().catch(() => ({}));
  if (!body.role || !VALID_ROLES.includes(body.role as TeamRole)) {
    return c.json({ error: "Role must be 'admin' or 'member'" }, 400);
  }

  // Can't change own role
  const member = sqlite
    .query("SELECT user_id, role FROM team_members WHERE id = ? AND team_id = ?")
    .get(memberId, team.id) as { user_id: string; role: string } | null;

  if (!member) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (member.user_id === session.userId) {
    return c.json({ error: "Cannot change your own role" }, 400);
  }

  if (member.role === "owner") {
    return c.json({ error: "Cannot change the owner's role" }, 400);
  }

  changeMemberRole(memberId, body.role as TeamRole);

  return c.json({ success: true });
});

/**
 * DELETE /api/teams/members/:id — Remove a member.
 * Owner or admin only. Cannot remove owner.
 */
teamRoutes.delete("/api/teams/members/:id", async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;
  const memberId = c.req.param("id");
  const team = getUserTeam(session.userId);

  if (!team) {
    return c.json({ error: "You are not in a team" }, 404);
  }

  const myRole = getMemberRole(team.id, session.userId);
  if (!myRole || !canManageMembers(myRole)) {
    return c.json({ error: "Only owners and admins can remove members" }, 403);
  }

  const member = sqlite
    .query("SELECT user_id, role FROM team_members WHERE id = ? AND team_id = ?")
    .get(memberId, team.id) as { user_id: string; role: string } | null;

  if (!member) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (member.role === "owner") {
    return c.json({ error: "Cannot remove the team owner" }, 400);
  }

  // Admins can't remove other admins (only owner can)
  if (member.role === "admin" && myRole !== "owner") {
    return c.json({ error: "Only the owner can remove admins" }, 403);
  }

  removeMember(memberId);

  return c.json({ success: true });
});

/**
 * POST /api/teams/leave — Leave a team.
 * Owner cannot leave (must delete or transfer).
 */
teamRoutes.post("/api/teams/leave", async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const session = auth;
  const team = getUserTeam(session.userId);

  if (!team) {
    return c.json({ error: "You are not in a team" }, 404);
  }

  if (team.ownerId === session.userId) {
    return c.json({ error: "Team owner cannot leave. Delete the team or transfer ownership first." }, 400);
  }

  leaveTeam(team.id, session.userId);

  return c.json({ success: true });
});

// ── Helpers ──

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inviteResultHtml(success: boolean, messageHtml: string): string {
  const icon = success ? "🎉" : "❌";
  const color = success ? "#22c55e" : "#ef4444";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? "Invite Accepted" : "Invite Failed"} — SEO MCP</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 48px; text-align: center; max-width: 440px; border: 1px solid #334155; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${color}; font-size: 24px; margin: 0 0 12px; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 24px; }
    a.btn { display: inline-block; background: #38bdf8; color: #0f172a; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${success ? "You're In!" : "Invite Failed"}</h1>
    <p>${messageHtml}</p>
    <a class="btn" href="/dashboard">${success ? "Go to Dashboard" : "Sign Up"}</a>
  </div>
</body>
</html>`;
}
