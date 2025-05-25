import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { LandingPage } from "./components/LandingPage";
import { Layout } from "./components/Layout";
import { anonJwtCookie } from "./middleware/anonJwtCookie";
import { CreatePage } from "./components/CreatePage";
import { PollData, PollPage } from "./components/PollPage";
import { EditPage } from "./components/EditPage";

export { PollDurableObject } from "./PollDurableObject";

type Bindings = { POLL_DO: DurableObjectNamespace };
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", anonJwtCookie);

app.get("/", (c) =>
  c.html(
    <Layout>
      <LandingPage />
    </Layout>
  )
);

app.get("/create", (c) =>
  c.html(
    <Layout>
      <CreatePage />
    </Layout>
  )
);

app.get("/poll/:pollId", (c) => {
  const pollId = c.req.param("pollId");
  const jwtPayload = c.get('jwtPayload');
  return c.html(
    <Layout>
      <PollPage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />
    </Layout>
  );
});

app.get("/poll/:pollId/edit", (c) => {
  const pollId = c.req.param("pollId");
  const jwtPayload = c.get('jwtPayload');
  return c.html(
    <Layout>
      <EditPage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />
    </Layout>
  );
});

app.post("/api/poll/create", async (c) => {
  const body = await c.req.parseBody();
  const question = String(body["question"] || "").trim();
  const options = [1, 2, 3, 4, 5]
    .map((i) => String(body[`option${i}`] || "").trim())
    .filter((opt) => opt.length > 0);
  const ttl = parseInt(String(body["ttl"] || "86400"), 10) || 86400;

  if (!question || options.length < 2) {
    return c.json({ error: "Invalid poll data" }, 400);
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
  };

  await stub.fetch("https://dummy/state", {
    method: "POST",
    body: JSON.stringify(pollData),
  });

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
    return c.json({ error: "Invalid poll data" }, 400);
  }

  const durableId = c.env.POLL_DO.idFromString(pollId);
  const stub = c.env.POLL_DO.get(durableId);
  // Get ownerId from JWT (set by anonJwtCookie middleware)
  const jwtPayload = c.get('jwtPayload');
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';

  // Fetch existing poll
  const res = await stub.fetch("https://dummy/state");
  if (!res.ok) {
    return c.json({ error: "Poll not found" }, 404);
  }
  const poll: PollData = await res.json();
  if (!poll || poll.ownerId !== ownerId) {
    return c.json({ error: "Unauthorized" }, 403);
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

showRoutes(app, { verbose: true });

export default app;
