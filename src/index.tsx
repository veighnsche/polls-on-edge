import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { LandingPage } from "./components/LandingPage";
import { Layout } from "./components/Layout";
import { anonJwtCookie } from "./middleware/anonJwtCookie";
import { CreatePage } from "./components/CreatePage";
import { PollPage } from "./components/PollPage";
import { EditPage } from "./components/EditPage";
import { ConfirmDeletePage } from "./components/ConfirmDeletePage";
import * as pollService from "./services/pollService";
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

app.get("/poll/:pollId/delete", (c) => {
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

  const jwtPayload = c.get('jwtPayload');
  const result = await pollService.createPoll({
    question,
    options,
    ttl,
    env: c.env,
    jwtPayload
  });
  return c.redirect(`/poll/${result.id}`);
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
  const jwtPayload = c.get('jwtPayload');
  const result = await pollService.editPoll({
    pollId,
    question,
    options,
    ttl,
    env: c.env,
    jwtPayload
  });
  if (!result.ok && result.error === "Poll not found") {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Poll not found</h1>
      </section>
    );
  }
  if (!result.ok && result.error === "Unauthorized") {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Unauthorized</h1>
      </section>
    );
  }
  return c.redirect(`/poll/${pollId}`);
});

app.post("/api/poll/:pollId/delete", async (c) => {
  const pollId = c.req.param("pollId");
  const jwtPayload = c.get('jwtPayload');
  const result = await pollService.deletePoll({
    pollId,
    env: c.env,
    jwtPayload
  });
  if (!result.ok && result.error === "Poll not found") {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Poll not found</h1>
      </section>
    );
  }
  if (!result.ok && result.error === "Unauthorized") {
    return c.html(
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Unauthorized</h1>
      </section>
    );
  }
  return c.redirect("/");
});

app.post("/api/poll/:pollId/vote", async (c) => {
  const pollId = c.req.param("pollId");
  const { optionIndex } = await c.req.json();
  if (typeof optionIndex !== "number") {
    return c.json({ error: "Invalid option index" }, 400);
  }
  const result = await pollService.votePoll({
    pollId,
    optionIndex,
    env: c.env
  });
  if (!result.ok) {
    return c.json({ error: result.error || "Vote failed" }, 500);
  }
  return c.json(result.updatedPoll);
});

showRoutes(app, { verbose: true });

export default app;
