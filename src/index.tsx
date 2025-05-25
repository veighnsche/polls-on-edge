import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { LandingPage } from "./components/LandingPage";
import { Layout } from "./components/Layout";
import { anonJwtCookie } from "./middleware/anonJwtCookie";
import { CreatePage } from "./components/CreatePage";
import { PollData, PollPage } from "./components/PollPage";

export { PollDurableObject } from "./PollDurableObject";

type Bindings = { POLLS: DurableObjectNamespace };
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
  return c.html(
    <Layout>
      {/* PollPage is now async and fetches its own data */}
      <PollPage pollId={pollId} />
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

  const id = crypto.randomUUID();
  const durableId = c.env.POLLS.idFromString(id);
  const stub = c.env.POLLS.get(durableId);
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

  await stub.fetch("/state", {
    method: "POST",
    body: JSON.stringify(pollData),
  });

  return c.json({ id, message: "Poll created successfully" });
});

showRoutes(app, { verbose: true });

export default app;
