import { Hono } from "hono";
import { db } from "../db";
import { waitlist } from "../db/schema";
import { ulid } from "../utils/ulid";
import { eq, count } from "drizzle-orm";

const app = new Hono();

// POST /api/waitlist — add email to waitlist
app.post("/api/waitlist", async (c) => {
  try {
    const body = await c.req.json();
    const email = body.email?.trim()?.toLowerCase();

    if (!email || !email.includes("@")) {
      return c.json({ error: "Valid email required" }, 400);
    }

    // Check if already on waitlist
    const existing = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ ok: true, message: "Already on waitlist", position: null });
    }

    // Add to waitlist
    const id = ulid();
    await db.insert(waitlist).values({
      id,
      email,
      source: body.source || "unknown",
    });

    // Get total count for position
    const [result] = await db.select({ total: count() }).from(waitlist);
    const total = result?.total || 1;
    const spotsLeft = Math.max(0, 25 - total);

    return c.json({
      ok: true,
      message: "Added to waitlist",
      position: total,
      spotsLeft,
    });
  } catch (err: any) {
    // Unique constraint = already exists
    if (err.message?.includes("UNIQUE")) {
      return c.json({ ok: true, message: "Already on waitlist" });
    }
    console.error("Waitlist error:", err);
    return c.json({ error: "Server error" }, 500);
  }
});

// GET /api/waitlist/count — get current waitlist size (public)
app.get("/api/waitlist/count", async (c) => {
  const [result] = await db.select({ total: count() }).from(waitlist);
  const total = result?.total || 0;
  return c.json({ total, spotsLeft: Math.max(0, 25 - total) });
});

export const waitlistRoutes = app;
