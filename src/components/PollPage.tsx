import type { FC } from "hono/jsx";

export interface PollData {
  id: string;
  question: string;
  options: string[];
  ttl: number;
  createdAt: number;
  ownerId: string;
}

interface PollPageProps {
  pollId: string;
}

export const PollPage: FC<PollPageProps> = async ({ pollId }) => {
  let poll: PollData | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(`/api/poll/${pollId}`);
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
