import { PollData } from "../types/PollData";

interface PollAdminPageProps {
  poll: PollData;
}

export const PollAdminPage = ({ poll }: PollAdminPageProps) => {
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
            <div key={i} className="w-full px-4 py-3 rounded-xl border border-muted bg-background flex justify-between items-center">
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
};
