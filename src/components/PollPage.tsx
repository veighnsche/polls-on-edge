import type { FC } from "hono/jsx";
import { PollData } from "../types/PollData";

interface PollPageProps {
  pollId: string;
  env: { POLL_DO: DurableObjectNamespace };
  jwtPayload: any;
}

export const PollPage: FC<PollPageProps> = async ({ pollId, env, jwtPayload }) => {
  let poll: PollData | null = null;
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
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
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
  // Debug: log the current user and poll owner
  // If user is owner, show results
  const isOwner = jwtPayload && jwtPayload.sub === poll.ownerId;
  if (isOwner) {
    const totalVotes = poll.votes.reduce((a, b) => a + b, 0);
    return (
      <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary text-center">
          {poll.question}
        </h1>
        <div className="w-full flex flex-col gap-4">
          {poll.options.map((option, i) => {
            const count = poll.votes[i] || 0;
            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return (
              <div key={i} className="w-full px-4 py-3 rounded border border-muted bg-background flex justify-between items-center">
                <span className="font-medium">{option}</span>
                <span className="ml-4 text-primary font-bold">{count} vote{count !== 1 ? 's' : ''} ({percent}%)</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-6">
          <a
            href={`/poll/${poll.id}/edit`}
            className="px-4 py-2 rounded bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition"
          >
            Edit
          </a>
          <a
            href={`/poll/${poll.id}/delete`}
            className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition"
          >
            Remove
          </a>
        </div>
        <p className="text-sm text-muted mt-6">Poll ID: {poll.id}</p>
      </section>
    );
  }
  // Otherwise, show voting form
  return (
    <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary text-center">
        {poll.question}
      </h1>
      <form className="w-full flex flex-col gap-4">
        {poll.options.map((option, i) => (
          <button
            key={i}
            type="button"
            className="w-full px-4 py-3 rounded border border-muted bg-background hover:bg-primary/10 transition text-lg font-medium"
          >
            {option}
          </button>
        ))}
      </form>
      <p className="text-sm text-muted mt-6">Poll ID: {poll.id}</p>
    </section>
  );
};
