import type { FC } from "hono/jsx";

interface ConfirmDeletePageProps {
  pollId: string;
  env: { POLL_DO: DurableObjectNamespace };
  jwtPayload: any;
}

export const ConfirmDeletePage = async ({ pollId, env, jwtPayload }: ConfirmDeletePageProps) => {
  let poll: import("./PollPage").PollData | null = null;
  let error: string | null = null;
  try {
    const durableId = env.POLL_DO.idFromString(pollId);
    const stub = env.POLL_DO.get(durableId);
    const res = await stub.fetch("https://dummy/state");
    if (!res.ok) throw new Error("Poll not found");
    poll = await res.json();
  } catch (err: any) {
    error = err.message || "Error fetching poll";
  }

  if (error) {
    return (
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
        <p className="text-lg text-muted">{error}</p>
      </section>
    );
  }
  if (!poll) {
    return (
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4">Poll not found</h1>
      </section>
    );
  }
  if (!jwtPayload || jwtPayload.sub !== poll.ownerId) {
    return (
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Unauthorized</h1>
        <a
          href={`/poll/${poll.id}`}
          className="px-4 py-2 rounded bg-muted text-muted-foreground font-semibold hover:bg-primary/80 transition mt-4"
        >
          Return to Poll
        </a>
      </section>
    );
  }
  return (
    <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
      <h1 className="text-2xl font-bold text-destructive mb-4">Confirm Deletion</h1>
      <p className="text-lg mb-2">Are you sure you want to delete the poll:</p>
      <div className="text-xl font-semibold text-center mb-4">“{poll.question}”</div>
      <form method="post" action={`/api/poll/${poll.id}/delete`} className="flex gap-4">
        <button
          type="submit"
          className="px-4 py-2 rounded bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/80 transition"
        >
          Delete
        </button>
        <a
          href={`/poll/${poll.id}`}
          className="px-4 py-2 rounded bg-muted text-muted-foreground font-semibold hover:bg-muted/80 transition" 
        >
          Cancel
        </a>
      </form>
      <p className="text-lg mb-6 text-muted">This action cannot be undone.</p>
    </section>
  );
};
