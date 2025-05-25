import type { FC } from "hono/jsx";

interface PollData {
  id: string;
  question: string;
  options: string[];
  ttl: number;
  createdAt: number;
  ownerId: string;
}

export const LandingPage: FC = async () => {
  let polls: PollData[] = [];
  try {
    const res = await fetch("/api/my-polls");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) polls = data;
    }
  } catch {}

  return (
    <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-primary text-center">
        Welcome to EdgePoll
      </h1>
      <p className="text-lg text-muted mb-8 text-center max-w-lg">
        Create, share, and participate in polls instantly. EdgePoll leverages
        edge rendering for real-time, scalable, and lightning-fast polling
        experiences.
      </p>
      <a
        href="/create"
        className="inline-block px-8 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-lg shadow-lg hover:bg-primary/90 transition mb-8"
      >
        Create Your Poll
      </a>
      <div className="w-full mt-8">
        <h2 className="text-xl font-bold mb-4 text-foreground">Your Polls</h2>
        {polls.length > 0 ? (
          <ul className="w-full flex flex-col gap-3">
            {polls.map((poll) => (
              <li key={poll.id} className="bg-muted rounded p-4 flex justify-between items-center">
                <span className="font-semibold text-foreground">{poll.question}</span>
                <a
                  href={`/poll/${poll.id}`}
                  className="ml-4 text-primary underline hover:text-primary/80"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">You don't own any polls yet. Create one above!</p>
        )}
      </div>
    </section>
  );
};
