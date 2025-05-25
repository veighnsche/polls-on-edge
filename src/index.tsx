import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { LandingPage } from "./components/LandingPage";
import { Layout } from "./components/Layout";
import { anonJwtCookie } from "./middleware/anonJwtCookie";
import { CreatePage } from "./components/CreatePage";
import { PollPage } from "./components/PollPage";
import { EditPage } from "./components/EditPage";
import { ConfirmDeletePage } from "./components/ConfirmDeletePage";
import { PollData } from "./types/PollData";
import { jsxRenderer } from "hono/jsx-renderer";

export { PollDurableObject } from "./PollDurableObject";

type Bindings = { POLL_DO: DurableObjectNamespace; POLL_INDEX: KVNamespace };
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", anonJwtCookie);

app.get("*", jsxRenderer(({ children }) => {
  return (
    <Layout>
      {children}
    </Layout>
  )
}))

app.get("/", (c) => {
  const jwtPayload = c.get('jwtPayload');
  return c.render(<LandingPage env={c.env} jwtPayload={jwtPayload} />);
});

app.get("/create", (c) => c.render(<CreatePage />));

app.get("/poll/:pollId", (c) => {
  const pollId = c.req.param("pollId");
  const jwtPayload = c.get('jwtPayload');
  return c.render(<PollPage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />);
});

app.get("/poll/:pollId/edit", (c) => {
  const pollId = c.req.param("pollId");
  const jwtPayload = c.get('jwtPayload');
  return c.render(<EditPage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />);
});

app.get("/poll/:pollId/confirm-delete", (c) => {
  const pollId = c.req.param("pollId");
  const jwtPayload = c.get('jwtPayload');
  return c.render(<ConfirmDeletePage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />);
});

app.post("/api/poll/create", async (c) => {
  const body = await c.req.parseBody();
  const question = String(body["question"] || "").trim();
  const options = [1, 2, 3, 4, 5]
    .map((i) => String(body[`option${i}`] || "").trim())
    .filter((opt) => opt.length > 0);
  const ttl = parseInt(String(body["ttl"] || "86400"), 10) || 86400;

  if (!question || options.length < 2) {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Invalid poll data</h1>
      </section>
    );
  }

  const durableId = c.env.POLL_DO.newUniqueId();
  const id = durableId.toString();
  const stub = c.env.POLL_DO.get(durableId);
  // Get ownerId from JWT (set by anonJwtCookie middleware)
  const jwtPayload = c.get('jwtPayload');
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';

  const pollData: PollData = {
    id,
    question,
    options,
    ttl,
    createdAt: Date.now(),
    ownerId,
    votes: Array(options.length).fill(0), // Initialize votes for each option
  };

  await stub.fetch("https://dummy/state", {
    method: "POST",
    body: JSON.stringify(pollData),
  });

  // Update global poll index for owner
  const existing = await c.env.POLL_INDEX.get(ownerId, "json");
  const pollIds = Array.isArray(existing) ? existing : [];
  pollIds.push(id);
  await c.env.POLL_INDEX.put(ownerId, JSON.stringify(pollIds));

  return c.redirect(`/poll/${id}`);
});

app.post("/api/poll/:pollId/edit", async (c) => {
  const pollId = c.req.param("pollId");
  const body = await c.req.parseBody();
  const question = String(body["question"] || "").trim();
  const options = [1, 2, 3, 4, 5]
    .map((i) => String(body[`option${i}`] || "").trim())
    .filter((opt) => opt.length > 0);
  const ttl = parseInt(String(body["ttl"] || "86400"), 10) || 86400;

  if (!question || options.length < 2) {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Invalid poll data</h1>
      </section>
    );
  }

  const durableId = c.env.POLL_DO.idFromString(pollId);
  const stub = c.env.POLL_DO.get(durableId);
  // Get ownerId from JWT (set by anonJwtCookie middleware)
  const jwtPayload = c.get('jwtPayload');
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';

  // Fetch existing poll
  const res = await stub.fetch("https://dummy/state");
  if (!res.ok) {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Poll not found</h1>
      </section>
    );
  }

  const poll: PollData = await res.json();
  if (!poll || poll.ownerId !== ownerId) {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Unauthorized</h1>
      </section>
    );
  }

  const updatedPoll = {
    ...poll,
    question,
    options,
    ttl,
    // Do not update createdAt or ownerId
  };

  await stub.fetch("https://dummy/state", {
    method: "POST",
    body: JSON.stringify(updatedPoll),
  });

  return c.redirect(`/poll/${pollId}`);
});

app.post("/api/poll/:pollId/delete", async (c) => {
  const pollId = c.req.param("pollId");
  const durableId = c.env.POLL_DO.idFromString(pollId);
  const stub = c.env.POLL_DO.get(durableId);
  const jwtPayload = c.get('jwtPayload');
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';
  const res = await stub.fetch("https://dummy/state");
  if (!res.ok) {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Poll not found</h1>
      </section>
    );
  }
  const poll: PollData = await res.json();
  if (!poll || poll.ownerId !== ownerId) {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Unauthorized</h1>
      </section>
    );
  }
  await stub.fetch("https://dummy/delete", { method: "DELETE" });

  // Remove from global poll index
  const existing = await c.env.POLL_INDEX.get(ownerId, "json");
  const pollIds = Array.isArray(existing) ? existing : [];
  const updatedPollIds = pollIds.filter((pid: string) => pid !== pollId);
  await c.env.POLL_INDEX.put(ownerId, JSON.stringify(updatedPollIds));

  return c.redirect("/");
});

// Endpoint: Get all polls for current owner
app.get("/api/my-polls", async (c) => {
  const jwtPayload = c.get('jwtPayload');
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';
  const pollIds = await c.env.POLL_INDEX.get(ownerId, "json");
  if (!Array.isArray(pollIds) || pollIds.length === 0) {
    return c.json([]);
  }
  // Fetch each poll's data from its DO
  const polls: any[] = [];
  for (const pollId of pollIds) {
    const durableId = c.env.POLL_DO.idFromString(pollId);
    const stub = c.env.POLL_DO.get(durableId);
    const res = await stub.fetch("https://dummy/state");
    if (res.ok) {
      const poll: PollData = await res.json();
      if (poll && poll.ownerId === ownerId) polls.push(poll);
    }
  }
  return c.json(polls);
});

app.post("/api/poll/:pollId/vote", async (c) => {
  const pollId = c.req.param("pollId");
  const { optionIndex } = await c.req.json();
  if (typeof optionIndex !== "number") {
    return c.json({ error: "Invalid option index" }, 400);
  }
  const durableId = c.env.POLL_DO.idFromString(pollId);
  const stub = c.env.POLL_DO.get(durableId);
  const voteRes = await stub.fetch("https://dummy/vote", {
    method: "POST",
    body: JSON.stringify({ optionIndex }),
  });
  if (!voteRes.ok) {
    return c.json({ error: "Vote failed" }, 500);
  }
  const updatedPoll = await voteRes.json();
  return c.json(updatedPoll);
});

showRoutes(app, { verbose: true });

export default app;
