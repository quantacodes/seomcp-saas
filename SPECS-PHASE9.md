# Phase 9: Team/Organization Support

## Overview
Agency plan ($79/mo) users can create a team, invite members via email, and share a usage pool.
This is a key differentiator — no other SEO MCP SaaS has team support.

## Data Model

### teams table
```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY,           -- ULID
  name TEXT NOT NULL,            -- "Acme Agency"
  owner_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'agency',
  max_members INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### team_members table
```sql
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,           -- ULID
  team_id TEXT NOT NULL REFERENCES teams(id),
  user_id TEXT REFERENCES users(id),  -- NULL if invite pending
  email TEXT NOT NULL,           -- Invite email (may differ from user email)
  role TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  invite_token TEXT,             -- HMAC token for pending invites
  invite_expires_at TIMESTAMP,   -- 48h expiry
  joined_at TIMESTAMP,          -- NULL if not yet joined
  created_at TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX idx_team_members_unique ON team_members(team_id, email);
```

## Roles
- **owner** — Full control, billing, can delete team. Only one per team.
- **admin** — Can invite/remove members, manage keys. Cannot delete team or change billing.
- **member** — Can use tools, view own usage. Cannot manage team.

## Usage Pool
- All team members share the team's usage quota (10,000 calls/mo for agency)
- Usage is tracked per key (individual accountability) but counted against team total
- Rate limit checks: team's total usage vs team's plan limit

## API Endpoints

### Team Management
- `POST /api/teams` — Create team (agency plan only). Body: `{ name }`. Auto-adds creator as owner.
- `GET /api/teams` — Get user's team (if any). Returns team + members.
- `PATCH /api/teams` — Update team name. Owner/admin only.
- `DELETE /api/teams` — Delete team. Owner only. Removes all members.

### Member Management  
- `POST /api/teams/invite` — Invite member. Body: `{ email, role? }`. Owner/admin only.
  - Generates HMAC invite token (48h expiry)
  - Sends invite email via Resend
  - If user already exists, auto-joins (no token needed)
- `GET /api/teams/invite/:token` — Accept invite (redirect to dashboard)
- `POST /api/teams/members/:id/role` — Change member role. Owner only.
- `DELETE /api/teams/members/:id` — Remove member. Owner/admin only (can't remove owner).
- `POST /api/teams/leave` — Leave team. Member removes themselves.

## Auth Changes
- When authenticating API key, check if user is in a team
- If in team: use team's plan + team's usage pool for rate limiting
- API key creation: team members create keys under their own account
- Dashboard: show team usage alongside personal usage

## Dashboard UI
- New "Team" tab in dashboard sidebar
- Team overview: name, members list, total usage
- Invite form (email + role dropdown)
- Pending invites with resend/cancel
- Member management (role change, remove)
- Leave team button for non-owners

## Security
- Invite tokens: HMAC-SHA256 with team_id:email:timestamp, 48h expiry
- Only agency plan can create teams
- Max 5 members (configurable per plan)
- Owner cannot be removed
- Member removal revokes their API keys from team pool (keys still work, but usage counts against personal quota)

## File Structure
```
src/
  teams/
    teams.ts        — Team CRUD logic
    invites.ts      — Invite generation, validation, acceptance
  routes/
    teams.ts        — API endpoints
  db/
    schema.ts       — + teams, team_members tables
    migrate.ts      — + team migrations
```

## Test Plan
- Team CRUD (create, get, update, delete)
- Invite flow (create, accept, expire, duplicate)
- Role management (change, permissions)
- Usage pool (team rate limiting vs individual)
- Security (non-agency can't create, non-owner can't delete, etc.)
