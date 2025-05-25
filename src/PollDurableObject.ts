// PollData is defined in index.tsx; import type-only to avoid runtime issues
import type { PollData, VoteRequestBody } from "./types/PollData";
// Now includes ownerId: string (set by creator, used for edit/remove permissions)

export class PollDurableObject {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/state") {
      const poll = await this.state.storage.get<PollData>("poll");
      if (!poll) return new Response("Not found", { status: 404 });
      return new Response(JSON.stringify(poll), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST" && url.pathname === "/state") {
      const poll: PollData = await request.json();
      await this.state.storage.put("poll", poll);
      return new Response("OK", { status: 200 });
    }

    if (request.method === "DELETE" && url.pathname === "/delete") {
      const existed = await this.state.storage.get("poll");
      if (!existed) return new Response("Not found", { status: 404 });
      await this.state.storage.delete("poll");
      return new Response("Deleted", { status: 200 });
    }

    // Helper to extract JWT from Authorization header
    const getJwtPayload = async () => {
      const auth = request.headers.get("Authorization");
      if (!auth || !auth.startsWith("Bearer ")) return null;
      const token = auth.substring(7);
      try {
        // Use the same secret as anonJwtCookie.ts
        const { verify } = await import("hono/jwt");
        return await verify(token, "dev_secret_change_me");
      } catch {
        return null;
      }
    };

    // Voting endpoint
    if (request.method === "POST" && url.pathname === "/vote") {
      const poll = await this.state.storage.get<PollData>("poll");
      if (!poll) return new Response("Not found", { status: 404 });
      const jwtPayload = await getJwtPayload();
      if (!jwtPayload || typeof jwtPayload.sub !== "string") {
        return new Response("Missing or invalid JWT", { status: 401 });
      }
      // Load voters
      let voters: string[] = (await this.state.storage.get("voters")) || [];
      if (voters.includes(jwtPayload.sub)) {
        return new Response("Already voted", { status: 403 });
      }
      let body: VoteRequestBody;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
      }
      const { optionIndex } = body || {};
      if (typeof optionIndex !== "number" || optionIndex < 0 || optionIndex >= poll.options.length) {
        return new Response("Invalid option index", { status: 400 });
      }
      poll.votes[optionIndex] = (poll.votes[optionIndex] || 0) + 1;
      voters.push(jwtPayload.sub);
      await Promise.all([
        this.state.storage.put("poll", poll),
        this.state.storage.put("voters", voters)
      ]);
      return new Response(JSON.stringify(poll), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Has-voted endpoint
    if (request.method === "GET" && url.pathname === "/has-voted") {
      const jwtPayload = await getJwtPayload();
      if (!jwtPayload || typeof jwtPayload.sub !== "string") {
        return new Response(JSON.stringify({ voted: false }), { headers: { "Content-Type": "application/json" } });
      }
      let voters: string[] = (await this.state.storage.get("voters")) || [];
      const voted = voters.includes(jwtPayload.sub);
      return new Response(JSON.stringify({ voted }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Not found", { status: 404 });
  }
}
