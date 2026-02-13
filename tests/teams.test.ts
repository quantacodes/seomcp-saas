import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, unlinkSync, mkdirSync } from "fs";

// Set test DB BEFORE any module loads
const testDbPath = "./data/test-teams.db";
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = "test-jwt-teams-12345";
process.env.TOKEN_ENCRYPTION_KEY = "abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01";

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

const { Hono } = await import("hono");
const { runMigrations } = await import("../src/db/migrate");
const { sqlite } = await import("../src/db/index");
const { teamRoutes } = await import("../src/routes/teams");
const { authRoutes } = await import("../src/routes/auth");
const { dashboardRoutes } = await import("../src/routes/dashboard");
const { healthRoutes } = await import("../src/routes/health");
const { ulid } = await import("../src/utils/ulid");
const { createSession } = await import("../src/auth/session");

runMigrations();

const app = new Hono();
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", dashboardRoutes);
app.route("/", teamRoutes);

// ── Helpers ──

async function createUser(email: string, plan: string = "free"): Promise<{ userId: string; apiKey: string; sessionCookie: string }> {
  const { generateApiKey } = await import("../src/auth/keys");
  const { Bun } = globalThis as any;

  const userId = ulid();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await globalThis.Bun.password.hash("password123", { algorithm: "bcrypt" });

  // Create user directly in DB (bypasses IP rate limiting)
  sqlite.run(
    "INSERT INTO users (id, email, password_hash, plan, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, email.toLowerCase(), passwordHash, plan, 0, now, now],
  );

  // Create API key
  const { raw, hash, prefix } = generateApiKey();
  const keyId = ulid();
  sqlite.run(
    "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [keyId, userId, hash, prefix, "Default", 1, now],
  );

  // Create dashboard session
  const sessionId = createSession(userId);

  return { userId, apiKey: raw, sessionCookie: `session=${sessionId}` };
}

// ── Team Creation ──

describe("Team Creation", () => {
  let agencyUser: Awaited<ReturnType<typeof createUser>>;
  let freeUser: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    agencyUser = await createUser("agency@test.com", "agency");
    freeUser = await createUser("free@test.com", "free");
  });

  it("rejects team creation without auth", async () => {
    const res = await app.request("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Agency" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects team creation for free plan", async () => {
    const res = await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: freeUser.sessionCookie,
      },
      body: JSON.stringify({ name: "My Team" }),
    });
    expect(res.status).toBe(403);
    const data = await res.json() as any;
    expect(data.error).toContain("Agency");
  });

  it("rejects team with invalid name", async () => {
    const res = await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: agencyUser.sessionCookie,
      },
      body: JSON.stringify({ name: "a" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a team for agency users", async () => {
    const res = await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: agencyUser.sessionCookie,
      },
      body: JSON.stringify({ name: "Acme SEO Agency" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.team.name).toBe("Acme SEO Agency");
    expect(data.team.ownerId).toBe(agencyUser.userId);
    expect(data.team.members).toHaveLength(1);
    expect(data.team.members[0].role).toBe("owner");
  });

  it("rejects duplicate team creation", async () => {
    const res = await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: agencyUser.sessionCookie,
      },
      body: JSON.stringify({ name: "Another Team" }),
    });
    expect(res.status).toBe(409);
  });
});

// ── Team CRUD ──

describe("Team CRUD", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    owner = await createUser("crud-owner@test.com", "agency");
    await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ name: "CRUD Team" }),
    });
  });

  it("gets the user's team", async () => {
    const res = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.team.name).toBe("CRUD Team");
    expect(data.team.usage).toBeDefined();
  });

  it("returns null for user without team", async () => {
    const noTeamUser = await createUser("noteam@test.com", "agency");
    const res = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: noTeamUser.sessionCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.team).toBeNull();
  });

  it("updates team name", async () => {
    const res = await app.request("/api/teams", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ name: "Updated Agency" }),
    });
    expect(res.status).toBe(200);

    // Verify
    const getRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const data = await getRes.json() as any;
    expect(data.team.name).toBe("Updated Agency");
  });

  it("rejects CSRF-vulnerable requests", async () => {
    const res = await app.request("/api/teams", {
      method: "POST",
      headers: {
        Cookie: owner.sessionCookie,
        // No Content-Type: application/json
      },
      body: "name=evil",
    });
    expect(res.status).toBe(415);
  });
});

// ── Team Invites ──

describe("Team Invites", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let existingUser: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    owner = await createUser("invite-owner@test.com", "agency");
    existingUser = await createUser("existing-member@test.com", "free");
    await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ name: "Invite Team" }),
    });
  });

  it("invites a new email (pending invite)", async () => {
    const res = await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "newuser@test.com" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.autoJoined).toBe(false);
    expect(data.message).toContain("Invite sent");
  });

  it("auto-joins existing user", async () => {
    const res = await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "existing-member@test.com" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.autoJoined).toBe(true);
    expect(data.message).toContain("already registered");
  });

  it("rejects duplicate invites", async () => {
    const res = await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "newuser@test.com" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects invalid email", async () => {
    const res = await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invite with owner role", async () => {
    const res = await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "admin-test@test.com", role: "owner" }),
    });
    expect(res.status).toBe(400);
  });

  it("verifies team now has 3 members (owner + 2)", async () => {
    const res = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const data = await res.json() as any;
    expect(data.team.members.length).toBe(3);
    // Owner + auto-joined existing user + pending invite
    const roles = data.team.members.map((m: any) => m.role);
    expect(roles).toContain("owner");
    expect(roles.filter((r: string) => r === "member")).toHaveLength(2);
  });
});

// ── Role Management ──

describe("Role Management", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let member: Awaited<ReturnType<typeof createUser>>;
  let memberId: string;

  beforeAll(async () => {
    owner = await createUser("role-owner@test.com", "agency");
    member = await createUser("role-member@test.com", "free");

    await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ name: "Role Team" }),
    });

    await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "role-member@test.com" }),
    });

    // Get the member ID
    const teamRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const teamData = await teamRes.json() as any;
    const memberEntry = teamData.team.members.find((m: any) => m.email === "role-member@test.com");
    memberId = memberEntry.id;
  });

  it("owner can change member to admin", async () => {
    const res = await app.request(`/api/teams/members/${memberId}/role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(200);
  });

  it("member cannot change roles", async () => {
    // Create another member to test
    const anotherUser = await createUser("role-another@test.com", "free");
    await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "role-another@test.com" }),
    });

    // Get the new member's ID
    const teamRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const teamData = await teamRes.json() as any;
    const anotherEntry = teamData.team.members.find((m: any) => m.email === "role-another@test.com");

    // The member (now admin) can manage others? Check: admin should NOT be able to change roles (only owner)
    const res = await app.request(`/api/teams/members/${anotherEntry.id}/role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: member.sessionCookie,
      },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(403);
  });

  it("cannot change own role", async () => {
    // Get owner's member ID
    const teamRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const teamData = await teamRes.json() as any;
    const ownerEntry = teamData.team.members.find((m: any) => m.role === "owner");

    const res = await app.request(`/api/teams/members/${ownerEntry.id}/role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ role: "member" }),
    });
    expect(res.status).toBe(400);
  });
});

// ── Remove & Leave ──

describe("Remove and Leave", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let member1: Awaited<ReturnType<typeof createUser>>;
  let member2: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    owner = await createUser("rm-owner@test.com", "agency");
    member1 = await createUser("rm-member1@test.com", "free");
    member2 = await createUser("rm-member2@test.com", "free");

    await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ name: "Remove Team" }),
    });

    for (const email of ["rm-member1@test.com", "rm-member2@test.com"]) {
      await app.request("/api/teams/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: owner.sessionCookie,
        },
        body: JSON.stringify({ email }),
      });
    }
  });

  it("owner cannot leave the team", async () => {
    const res = await app.request("/api/teams/leave", {
      method: "POST",
      headers: { Cookie: owner.sessionCookie },
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.error).toContain("owner");
  });

  it("member can leave the team", async () => {
    const res = await app.request("/api/teams/leave", {
      method: "POST",
      headers: { Cookie: member1.sessionCookie },
    });
    expect(res.status).toBe(200);

    // Verify they're gone
    const teamRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const data = await teamRes.json() as any;
    const emails = data.team.members.map((m: any) => m.email);
    expect(emails).not.toContain("rm-member1@test.com");
  });

  it("owner can remove a member", async () => {
    const teamRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const data = await teamRes.json() as any;
    const m2 = data.team.members.find((m: any) => m.email === "rm-member2@test.com");

    const res = await app.request(`/api/teams/members/${m2.id}`, {
      method: "DELETE",
      headers: { Cookie: owner.sessionCookie },
    });
    expect(res.status).toBe(200);
  });

  it("cannot remove the owner", async () => {
    const teamRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const data = await teamRes.json() as any;
    const ownerMember = data.team.members.find((m: any) => m.role === "owner");

    const res = await app.request(`/api/teams/members/${ownerMember.id}`, {
      method: "DELETE",
      headers: { Cookie: owner.sessionCookie },
    });
    expect(res.status).toBe(400);
  });
});

// ── Team Deletion ──

describe("Team Deletion", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let member: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    owner = await createUser("del-owner@test.com", "agency");
    member = await createUser("del-member@test.com", "free");

    await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ name: "Delete Team" }),
    });

    await app.request("/api/teams/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ email: "del-member@test.com" }),
    });
  });

  it("member cannot delete team", async () => {
    const res = await app.request("/api/teams", {
      method: "DELETE",
      headers: { Cookie: member.sessionCookie },
    });
    expect(res.status).toBe(403);
  });

  it("owner can delete team", async () => {
    const res = await app.request("/api/teams", {
      method: "DELETE",
      headers: { Cookie: owner.sessionCookie },
    });
    expect(res.status).toBe(200);

    // Verify team is gone
    const getRes = await app.request("/api/teams", {
      method: "GET",
      headers: { Cookie: owner.sessionCookie },
    });
    const data = await getRes.json() as any;
    expect(data.team).toBeNull();
  });
});

// ── Invite Token Logic ──

describe("Invite Token Logic", () => {
  it("generates and verifies invite tokens", async () => {
    const { generateInviteToken, verifyInviteToken } = await import("../src/teams/invites");

    const { token, hash, expiresAt } = generateInviteToken("TEAM123", "user@test.com");
    expect(token).toMatch(/^\d+\.[a-f0-9]{64}$/);
    expect(hash).toHaveLength(64);
    expect(expiresAt).toBeGreaterThan(Date.now());

    const result = verifyInviteToken(token, "TEAM123", "user@test.com");
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  it("rejects tokens for wrong team", async () => {
    const { generateInviteToken, verifyInviteToken } = await import("../src/teams/invites");

    const { token } = generateInviteToken("TEAM123", "user@test.com");
    const result = verifyInviteToken(token, "WRONG_TEAM", "user@test.com");
    expect(result.valid).toBe(false);
  });

  it("rejects tokens for wrong email", async () => {
    const { generateInviteToken, verifyInviteToken } = await import("../src/teams/invites");

    const { token } = generateInviteToken("TEAM123", "user@test.com");
    const result = verifyInviteToken(token, "TEAM123", "wrong@test.com");
    expect(result.valid).toBe(false);
  });

  it("rejects tampered tokens", async () => {
    const { generateInviteToken, verifyInviteToken } = await import("../src/teams/invites");

    const { token } = generateInviteToken("TEAM123", "user@test.com");
    const tampered = token.split(".")[0] + "." + "0".repeat(64);
    const result = verifyInviteToken(tampered, "TEAM123", "user@test.com");
    expect(result.valid).toBe(false);
  });
});

// ── Team Rate Limiting ──

describe("Team Rate Limiting", () => {
  it("returns team context for team members", async () => {
    const { getTeamRateContext } = await import("../src/ratelimit/middleware");

    const owner = await createUser("rateowner@test.com", "agency");
    await app.request("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.sessionCookie,
      },
      body: JSON.stringify({ name: "Rate Team" }),
    });

    const context = getTeamRateContext(owner.userId);
    expect(context.isTeamMember).toBe(true);
    expect(context.teamPlan).toBe("agency");
    expect(context.teamUsed).toBe(0);
    expect(context.teamLimit).toBe(10000);
  });

  it("returns no team context for solo users", async () => {
    const { getTeamRateContext } = await import("../src/ratelimit/middleware");

    const solo = await createUser("solo@test.com", "pro");
    const context = getTeamRateContext(solo.userId);
    expect(context.isTeamMember).toBe(false);
  });
});

afterAll(async () => {
  try {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
    if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}
  } catch {}
});
