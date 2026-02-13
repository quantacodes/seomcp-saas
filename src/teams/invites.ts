import { createHmac, createHash, timingSafeEqual } from "crypto";
import { sqlite } from "../db/index";
import { db, schema } from "../db/index";
import { ulid } from "../utils/ulid";
import { config } from "../config";
import type { TeamRole } from "./teams";

/**
 * Domain-separated HMAC key for team invites.
 */
function getInviteKey(): Buffer {
  return createHmac("sha256", config.jwtSecret)
    .update("team-invite-v1")
    .digest();
}

/**
 * Generate an invite token for a team invitation.
 * Token format: timestamp.hmac
 */
export function generateInviteToken(
  teamId: string,
  email: string,
): { token: string; hash: string; expiresAt: number } {
  const timestamp = Date.now();
  const payload = `${teamId}:${email}:${timestamp}`;
  const hmac = createHmac("sha256", getInviteKey())
    .update(payload)
    .digest("hex");

  const token = `${timestamp}.${hmac}`;
  const hash = createHash("sha256").update(token).digest("hex");
  const expiresAt = timestamp + 48 * 60 * 60 * 1000; // 48 hours

  return { token, hash, expiresAt };
}

/**
 * Verify an invite token.
 */
export function verifyInviteToken(
  token: string,
  teamId: string,
  email: string,
): { valid: boolean; expired: boolean } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, expired: false };

  const [timestampStr, receivedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return { valid: false, expired: false };

  const payload = `${teamId}:${email}:${timestamp}`;
  const expectedHmac = createHmac("sha256", getInviteKey())
    .update(payload)
    .digest("hex");

  const a = Buffer.from(receivedHmac, "hex");
  const b = Buffer.from(expectedHmac, "hex");
  if (a.length !== b.length) return { valid: false, expired: false };
  const valid = timingSafeEqual(a, b);

  const expired = Date.now() - timestamp > 48 * 60 * 60 * 1000;

  return { valid, expired };
}

/**
 * Create a team invite.
 * If the invited email already has an account, auto-join them.
 */
export function createInvite(
  teamId: string,
  email: string,
  role: TeamRole = "member",
): { memberId: string; autoJoined: boolean; token?: string; error?: string } {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if already a member
  const existing = sqlite
    .query("SELECT id FROM team_members WHERE team_id = ? AND email = ? LIMIT 1")
    .get(teamId, normalizedEmail) as { id: string } | null;

  if (existing) {
    return { memberId: "", autoJoined: false, error: "This email is already invited or a member" };
  }

  // Check team member limit
  const team = sqlite
    .query("SELECT max_members FROM teams WHERE id = ?")
    .get(teamId) as { max_members: number } | null;

  if (!team) {
    return { memberId: "", autoJoined: false, error: "Team not found" };
  }

  const memberCount = sqlite
    .query("SELECT COUNT(*) as count FROM team_members WHERE team_id = ?")
    .get(teamId) as { count: number };

  if (memberCount.count >= team.max_members) {
    return { memberId: "", autoJoined: false, error: `Team is full (max ${team.max_members} members)` };
  }

  // Check if the invited user already exists
  const existingUser = sqlite
    .query("SELECT id FROM users WHERE email = ? LIMIT 1")
    .get(normalizedEmail) as { id: string } | null;

  // Check if existing user is already in another team
  if (existingUser) {
    const otherTeam = sqlite
      .query("SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1")
      .get(existingUser.id) as { team_id: string } | null;

    if (otherTeam) {
      return { memberId: "", autoJoined: false, error: "This user is already in another team" };
    }
  }

  const memberId = ulid();
  const now = new Date();

  if (existingUser) {
    // Auto-join existing user
    db.insert(schema.teamMembers)
      .values({
        id: memberId,
        teamId,
        userId: existingUser.id,
        email: normalizedEmail,
        role,
        joinedAt: now,
        createdAt: now,
      })
      .run();

    return { memberId, autoJoined: true };
  }

  // Create pending invite
  const { token, hash, expiresAt } = generateInviteToken(teamId, normalizedEmail);

  db.insert(schema.teamMembers)
    .values({
      id: memberId,
      teamId,
      userId: null,
      email: normalizedEmail,
      role,
      inviteToken: hash, // Store hash, not raw token
      inviteExpiresAt: Math.floor(expiresAt / 1000),
      createdAt: now,
    })
    .run();

  return { memberId, autoJoined: false, token };
}

/**
 * Accept a team invite.
 * Links the invite to a user account and marks as joined.
 */
export function acceptInvite(
  token: string,
  userId: string,
): { success: boolean; teamId?: string; error?: string } {
  // Hash the token to look up the invite
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = sqlite
    .query("SELECT id, team_id, email, invite_expires_at FROM team_members WHERE invite_token = ? AND user_id IS NULL LIMIT 1")
    .get(tokenHash) as {
      id: string;
      team_id: string;
      email: string;
      invite_expires_at: number;
    } | null;

  if (!invite) {
    return { success: false, error: "Invalid or already used invite" };
  }

  // Check expiry
  if (invite.invite_expires_at && Date.now() / 1000 > invite.invite_expires_at) {
    return { success: false, error: "Invite has expired" };
  }

  // Verify HMAC
  const { valid } = verifyInviteToken(token, invite.team_id, invite.email);
  if (!valid) {
    return { success: false, error: "Invalid invite token" };
  }

  // Verify the accepting user's email matches the invite
  const acceptingUser = sqlite
    .query("SELECT email FROM users WHERE id = ?")
    .get(userId) as { email: string } | null;

  if (!acceptingUser) {
    return { success: false, error: "User not found" };
  }

  if (acceptingUser.email.toLowerCase() !== invite.email.toLowerCase()) {
    return { success: false, error: "This invite was sent to a different email address" };
  }

  // Check user isn't already in a team
  const existingTeam = sqlite
    .query("SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1")
    .get(userId) as { team_id: string } | null;

  if (existingTeam) {
    return { success: false, error: "You are already in a team" };
  }

  // Accept the invite
  const now = new Date();
  sqlite
    .query("UPDATE team_members SET user_id = ?, invite_token = NULL, invite_expires_at = NULL, joined_at = ? WHERE id = ?")
    .run(userId, Math.floor(now.getTime() / 1000), invite.id);

  return { success: true, teamId: invite.team_id };
}

/**
 * Cancel a pending invite.
 */
export function cancelInvite(memberId: string): boolean {
  const result = sqlite
    .query("DELETE FROM team_members WHERE id = ? AND user_id IS NULL")
    .run(memberId);
  return result.changes > 0;
}

/**
 * Build an invite URL.
 */
export function buildInviteUrl(token: string): string {
  return `${config.baseUrl}/dashboard/teams/invite/${encodeURIComponent(token)}`;
}

/**
 * Send invite email.
 */
export async function sendInviteEmail(
  email: string,
  teamName: string,
  inviteUrl: string,
  inviterEmail: string,
): Promise<boolean> {
  if (!config.resendApiKey) {
    console.log(`📧 Team invite for ${email}: ${inviteUrl} (from ${inviterEmail}, team: ${teamName})`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFromEmail,
        to: email,
        subject: `You're invited to join ${teamName} on SEO MCP`,
        html: inviteEmailHtml(teamName, inviteUrl, inviterEmail),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function inviteEmailHtml(teamName: string, url: string, inviter: string): string {
  // Safe: teamName and inviter are from DB (trusted), url is from buildInviteUrl (trusted)
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#38bdf8;font-size:24px;margin:0 0 8px;">🔍 SEO MCP</h1>
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 24px;">You're invited!</h2>
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 16px;">
      <strong style="color:#f1f5f9;">${inviter}</strong> has invited you to join
      <strong style="color:#f1f5f9;">${teamName}</strong> on SEO MCP.
    </p>
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
      As a team member, you'll have access to shared SEO tools and usage quota.
    </p>
    <a href="${url}" style="display:inline-block;background:#38bdf8;color:#0f172a;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;">
      Accept Invite
    </a>
    <p style="color:#64748b;font-size:13px;margin:24px 0 0;">
      This invite expires in 48 hours. If you don't have an account, you'll need to sign up first.
    </p>
  </div>
</body>
</html>`;
}
