// PollData is defined in index.tsx; import type-only to avoid runtime issues
import type { PollData } from "./components/PollPage";
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

    return new Response("Not found", { status: 404 });
  }
}
