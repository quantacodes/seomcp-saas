import { eq, and } from "drizzle-orm";
import { db, schema, sqlite } from "../db/index";
import { ulid } from "../utils/ulid";

export type TeamRole = "owner" | "admin" | "member";

export interface TeamInfo {
  id: string;
  name: string;
  ownerId: string;
  maxMembers: number;
  createdAt: Date;
  members: TeamMemberInfo[];
}

export interface TeamMemberInfo {
  id: string;
  email: string;
  role: TeamRole;
  userId: string | null;
  joinedAt: Date | null;
  pending: boolean;
}

/**
 * Create a new team. Only agency plan users can create teams.
 */
export function createTeam(userId: string, name: string): { team: TeamInfo; error?: string } {
  // Check if user already owns or is in a team
  const existingMember = sqlite
    .query("SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1")
    .get(userId) as { team_id: string } | null;

  if (existingMember) {
    return { team: null as any, error: "You are already in a team" };
  }

  const teamId = ulid();
  const now = new Date();
  const memberId = ulid();

  db.insert(schema.teams)
    .values({
      id: teamId,
      name: name.trim(),
      ownerId: userId,
      maxMembers: 5,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Get user's email
  const user = sqlite
    .query("SELECT email FROM users WHERE id = ?")
    .get(userId) as { email: string };

  db.insert(schema.teamMembers)
    .values({
      id: memberId,
      teamId,
      userId,
      email: user.email,
      role: "owner",
      joinedAt: now,
      createdAt: now,
    })
    .run();

  return {
    team: {
      id: teamId,
      name: name.trim(),
      ownerId: userId,
      maxMembers: 5,
      createdAt: now,
      members: [
        {
          id: memberId,
          email: user.email,
          role: "owner",
          userId,
          joinedAt: now,
          pending: false,
        },
      ],
    },
  };
}

/**
 * Get a user's team (if any).
 */
export function getUserTeam(userId: string): TeamInfo | null {
  const membership = sqlite
    .query("SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1")
    .get(userId) as { team_id: string } | null;

  if (!membership) return null;

  return getTeamById(membership.team_id);
}

/**
 * Get team by ID with all members.
 */
export function getTeamById(teamId: string): TeamInfo | null {
  const team = sqlite
    .query("SELECT * FROM teams WHERE id = ?")
    .get(teamId) as any;

  if (!team) return null;

  const members = sqlite
    .query("SELECT * FROM team_members WHERE team_id = ? ORDER BY created_at ASC")
    .all(teamId) as any[];

  return {
    id: team.id,
    name: team.name,
    ownerId: team.owner_id,
    maxMembers: team.max_members,
    createdAt: new Date(team.created_at * 1000),
    members: members.map((m) => ({
      id: m.id,
      email: m.email,
      role: m.role as TeamRole,
      userId: m.user_id,
      joinedAt: m.joined_at ? new Date(m.joined_at * 1000) : null,
      pending: !m.user_id || !m.joined_at,
    })),
  };
}

/**
 * Update team name.
 */
export function updateTeam(teamId: string, name: string): void {
  db.update(schema.teams)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(schema.teams.id, teamId))
    .run();
}

/**
 * Delete a team and all memberships.
 */
export function deleteTeam(teamId: string): void {
  sqlite.query("DELETE FROM team_members WHERE team_id = ?").run(teamId);
  sqlite.query("DELETE FROM teams WHERE id = ?").run(teamId);
}

/**
 * Get a member's role in a team.
 */
export function getMemberRole(teamId: string, userId: string): TeamRole | null {
  const row = sqlite
    .query("SELECT role FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1")
    .get(teamId, userId) as { role: string } | null;

  return row ? (row.role as TeamRole) : null;
}

/**
 * Check if a role can perform management actions.
 */
export function canManageMembers(role: TeamRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Change a member's role. Only owner can change roles.
 */
export function changeMemberRole(memberId: string, newRole: TeamRole): void {
  sqlite
    .query("UPDATE team_members SET role = ? WHERE id = ?")
    .run(newRole, memberId);
}

/**
 * Remove a member from a team.
 */
export function removeMember(memberId: string): void {
  sqlite.query("DELETE FROM team_members WHERE id = ?").run(memberId);
}

/**
 * Leave a team (remove yourself).
 */
export function leaveTeam(teamId: string, userId: string): void {
  sqlite
    .query("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
    .run(teamId, userId);

  // Check if team is now empty
  const remaining = sqlite
    .query("SELECT COUNT(*) as count FROM team_members WHERE team_id = ?")
    .get(teamId) as { count: number };

  if (remaining.count === 0) {
    sqlite.query("DELETE FROM teams WHERE id = ?").run(teamId);
  }
}

/**
 * Get total usage for a team in the current month.
 */
export function getTeamUsage(teamId: string): { totalCalls: number; memberUsage: Array<{ email: string; calls: number }> } {
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const windowStartTs = Math.floor(windowStart.getTime() / 1000);

  // Get all team member user IDs
  const members = sqlite
    .query("SELECT user_id, email FROM team_members WHERE team_id = ? AND user_id IS NOT NULL")
    .all(teamId) as Array<{ user_id: string; email: string }>;

  if (members.length === 0) return { totalCalls: 0, memberUsage: [] };

  const userIds = members.map((m) => m.user_id);
  const placeholders = userIds.map(() => "?").join(",");

  const rows = sqlite
    .query(`SELECT user_id, COUNT(*) as calls FROM usage_logs WHERE user_id IN (${placeholders}) AND created_at >= ? GROUP BY user_id`)
    .all(...userIds, windowStartTs) as Array<{ user_id: string; calls: number }>;

  const usageMap = new Map(rows.map((r) => [r.user_id, r.calls]));

  const memberUsage = members.map((m) => ({
    email: m.email,
    calls: usageMap.get(m.user_id) || 0,
  }));

  const totalCalls = memberUsage.reduce((sum, m) => sum + m.calls, 0);

  return { totalCalls, memberUsage };
}
