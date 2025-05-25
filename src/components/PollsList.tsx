import type { FC } from "hono/jsx";
import { PollData } from "../types/PollData";

interface PollsListProps {
  env: { POLL_INDEX: KVNamespace; POLL_DO: DurableObjectNamespace };
  jwtPayload: any;
}

export const PollsList: FC<PollsListProps> = async ({ env, jwtPayload }) => {
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';
  const pollIds = await env.POLL_INDEX.get(ownerId, "json");
  let polls: PollData[] = [];
  if (Array.isArray(pollIds) && pollIds.length > 0) {
    for (const pollId of pollIds) {
      const durableId = env.POLL_DO.idFromString(pollId);
      const stub = env.POLL_DO.get(durableId);
      const res = await stub.fetch("https://dummy/state");
      if (res.ok) {
        const poll: PollData = await res.json();
        if (poll && poll.ownerId === ownerId) polls.push(poll);
      }
    }
  }
  return (
    <div className="w-full mt-8">
      <h2 className="text-xl font-bold mb-4 text-foreground">Your Polls</h2>
      {polls.length > 0 ? (
        <ul className="w-full flex flex-col gap-3">
          {polls.map((poll) => (
            <li key={poll.id} className="bg-muted/80 rounded p-4 flex justify-between items-center">
              <span className="font-semibold text-foreground">{poll.question}</span>
              <a
                href={`/poll/${poll.id}`}
                className="ml-4 text-muted-foreground underline hover:text-muted-foreground/80"
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
  );
};
