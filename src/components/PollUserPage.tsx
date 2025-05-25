import { PollData } from "../types/PollData";

interface PollUserPageProps {
  poll: PollData;
}

export const PollUserPage = ({ poll }: PollUserPageProps) => {
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
            className="w-full px-4 py-3 rounded-xl border border-muted bg-background hover:bg-primary/10 transition text-lg font-medium"
          >
            {option}
          </button>
        ))}
      </form>
      <p className="text-sm text-muted mt-6">Poll ID: {poll.id}</p>
    </section>
  );
};
