/*
 * Hardened PollDurableObject
 * ---------------------------------------------
 * ‣ ownerId authorization on every mutating route
 * ‣ race‑free voting via Durable‑Object transaction
 * ‣ JWT secret taken from env binding (no hard‑code)
 * ‣ voters kept as array (simple) but stored/checked inside the same txn
 * ‣ DELETE wipes poll + voters
 * ‣ Basic CORS headers + pre‑flight support
 * ‣ PUT (create)  /state — PATCH (update) /state
 */

import { verify } from "hono/jwt";
import { PollDataSchema, type PollData, type VoteRequestBody } from "./types/PollData";

/**
 * Expose your secret in wrangler.toml
 * [[bindings]]
 * type = "secret"
 * name = "JWT_SECRET"
 */
export interface Env {
  JWT_SECRET: string;
}

interface JwtPayload {
  sub: string;
}

export class PollDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /* ───────────────────────────────────────────────────────── helpers ────────── */

  private json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  private text(body: string, status = 200) {
    return new Response(body, {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  private async getJwt(request: Request): Promise<JwtPayload | null> {
    const auth = request.headers.get("Authorization");
    console.log('[DO] Authorization header:', auth);
    if (!auth?.startsWith("Bearer ")) return null;
    try {
      const payload = await verify(auth.slice(7), this.env.JWT_SECRET);
      console.log('[DO] JWT verify payload:', payload);
      if (payload && typeof payload === "object" && "sub" in payload && typeof (payload as any).sub === "string") {
        return payload as unknown as JwtPayload;
      }
      return null;
    } catch (err) {
      console.log('[DO] JWT verification error:', err);
      return null;
    }
  }

  private async loadPoll(
    txn: { get: <T = unknown>(key: string) => Promise<T | undefined> } = this.state.storage
  ): Promise<PollData> {
    const poll = await txn.get<PollData>("poll");
    if (!poll) throw new Response("Not found", { status: 404 });
    return poll;
  }

  /* ───────────────────────────────────────────────────────── fetch ──────────── */

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { method } = request;
    console.log(`[DO] fetch called: ${method} ${url.pathname}`);

    // CORS pre‑flight
    if (method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });

    /* ─────────────── read current poll ─────────────── */
    if (method === "GET" && url.pathname === "/state") {
      const poll = await this.state.storage.get<PollData>("poll");
      return poll ? this.json(poll) : this.text("Not found", 404);
    }

    /* ─────────────── create poll ─────────────── */
    if (method === "PUT" && url.pathname === "/state") {
      console.log('[DO] Handling poll creation');
      const jwt = await this.getJwt(request);
      if (!jwt) return this.text("Unauthorized", 401);

      const json = await request.json();
      console.log('[DO] Poll creation request body:', json);
      const parseResult = PollDataSchema.safeParse(json);
      if (!parseResult.success) {
        console.log('[DO] Invalid poll data:', parseResult.error.errors);
        return this.json({ error: "Invalid poll data", details: parseResult.error.errors }, 400);
      }
      const poll: PollData = parseResult.data;
      if (jwt.sub !== poll.ownerId) {
        console.log('[DO] ownerId does not match JWT:', { jwtSub: jwt.sub, ownerId: poll.ownerId });
        return this.text("ownerId must match JWT", 403);
      }
      await this.state.storage.put("poll", poll);
      await this.state.storage.put("voters", [] as string[]); // init empty voters list
      console.log('[DO] Poll and voters initialized in storage for pollId', poll.id);
      return this.text("Created", 201);
    }

    /* ─────────────── update poll ─────────────── */
    if (method === "PATCH" && url.pathname === "/state") {
      const jwt = await this.getJwt(request);
      if (!jwt) return this.text("Unauthorized", 401);

      const poll = await this.loadPoll();
      if (jwt.sub !== poll.ownerId) return this.text("Forbidden", 403);

      const patch: PollData = await request.json();
      const updated: PollData = { ...poll, ...patch };
      await this.state.storage.put("poll", updated);
      return this.json(updated);
    }

    /* ─────────────── delete poll ─────────────── */
    if (method === "DELETE" && url.pathname === "/delete") {
      const jwt = await this.getJwt(request);
      if (!jwt) return this.text("Unauthorized", 401);

      const poll = await this.loadPoll();
      if (jwt.sub !== poll.ownerId) return this.text("Forbidden", 403);

      await this.state.storage.deleteAll();
      return this.text("Deleted");
    }

    /* ─────────────── vote ─────────────── */
    if (method === "POST" && url.pathname === "/vote") {
      let response!: Response; // value set inside txn

      await this.state.storage.transaction(async (txn) => {
        const poll = await this.loadPoll(txn);

        const jwt = await this.getJwt(request);
        if (!jwt) {
          response = this.text("Unauthorized", 401);
          return;
        }

        const voters = (await txn.get<string[]>("voters")) ?? [];
        if (voters.includes(jwt.sub)) {
          response = this.text("Already voted", 403);
          return;
        }

        let body: VoteRequestBody;
        try {
          body = await request.clone().json();
        } catch {
          response = this.text("Invalid JSON", 400);
          return;
        }

        const { optionIndex } = body || {};
        if (
          !Number.isInteger(optionIndex) ||
          optionIndex < 0 ||
          optionIndex >= poll.options.length
        ) {
          response = this.text("Invalid option index", 400);
          return;
        }

        // Ensure votes array fully initialised
        while (poll.votes.length < poll.options.length) poll.votes.push(0);
        poll.votes[optionIndex]! += 1;
        voters.push(jwt.sub);

        await Promise.all([
          txn.put("poll", poll),
          txn.put("voters", voters),
        ]);

        response = this.json(poll);
      });

      return response;
    }

    /* ─────────────── has‑voted ─────────────── */
    if (method === "GET" && url.pathname === "/has-voted") {
      const jwt = await this.getJwt(request);
      if (!jwt) return this.json({ voted: false });

      const voters = (await this.state.storage.get<string[]>("voters")) ?? [];
      return this.json({ voted: voters.includes(jwt.sub) });
    }

    /* ─────────────── unknown route ─────────────── */
    return this.text("Not found", 404);
  }
}
