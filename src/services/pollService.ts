import { PollData } from "../types/PollData";

type Env = {
  POLL_DO: DurableObjectNamespace;
  POLL_INDEX: KVNamespace;
};

type JwtPayload = { sub?: string };

export async function createPoll({ question, options, ttl, env, jwtPayload }: {
  question: string;
  options: string[];
  ttl: number;
  env: Env;
  jwtPayload: JwtPayload;
}): Promise<{ id: string }> {
  const durableId = env.POLL_DO.newUniqueId();
  const id = durableId.toString();
  const stub = env.POLL_DO.get(durableId);
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';

  const pollData: PollData = {
    id,
    question,
    options,
    ttl,
    createdAt: Date.now(),
    ownerId,
    votes: Array(options.length).fill(0),
  };

  await stub.fetch("https://dummy/state", {
    method: "POST",
    body: JSON.stringify(pollData),
  });

  // Update global poll index for owner
  const existing = await env.POLL_INDEX.get(ownerId, "json");
  const pollIds = Array.isArray(existing) ? existing : [];
  pollIds.push(id);
  await env.POLL_INDEX.put(ownerId, JSON.stringify(pollIds));
  return { id };
}

export async function editPoll({ pollId, question, options, ttl, env, jwtPayload }: {
  pollId: string;
  question: string;
  options: string[];
  ttl: number;
  env: Env;
  jwtPayload: JwtPayload;
}): Promise<{ ok: boolean; error?: string }> {
  const durableId = env.POLL_DO.idFromString(pollId);
  const stub = env.POLL_DO.get(durableId);
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';
  const res = await stub.fetch("https://dummy/state");
  if (!res.ok) {
    return { ok: false, error: "Poll not found" };
  }
  const poll: PollData = await res.json();
  if (!poll || poll.ownerId !== ownerId) {
    return { ok: false, error: "Unauthorized" };
  }
  const updatedPoll = { ...poll, question, options, ttl };
  await stub.fetch("https://dummy/state", {
    method: "POST",
    body: JSON.stringify(updatedPoll),
  });
  return { ok: true };
}

export async function deletePoll({ pollId, env, jwtPayload }: {
  pollId: string;
  env: Env;
  jwtPayload: JwtPayload;
}): Promise<{ ok: boolean; error?: string }> {
  const durableId = env.POLL_DO.idFromString(pollId);
  const stub = env.POLL_DO.get(durableId);
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';
  const res = await stub.fetch("https://dummy/state");
  if (!res.ok) {
    return { ok: false, error: "Poll not found" };
  }
  const poll: PollData = await res.json();
  if (!poll || poll.ownerId !== ownerId) {
    return { ok: false, error: "Unauthorized" };
  }
  await stub.fetch("https://dummy/delete", { method: "DELETE" });
  // Remove from global poll index
  const existing = await env.POLL_INDEX.get(ownerId, "json");
  const pollIds = Array.isArray(existing) ? existing : [];
  const updatedPollIds = pollIds.filter((pid: string) => pid !== pollId);
  await env.POLL_INDEX.put(ownerId, JSON.stringify(updatedPollIds));
  return { ok: true };
}

export async function votePoll({ pollId, optionIndex, env }: {
  pollId: string;
  optionIndex: number;
  env: Env;
}): Promise<{ ok: boolean; updatedPoll?: PollData; error?: string }> {
  const durableId = env.POLL_DO.idFromString(pollId);
  const stub = env.POLL_DO.get(durableId);
  const voteRes = await stub.fetch("https://dummy/vote", {
    method: "POST",
    body: JSON.stringify({ optionIndex }),
  });
  if (!voteRes.ok) {
    return { ok: false, error: "Vote failed" };
  }
  const updatedPoll: PollData = await voteRes.json();
  return { ok: true, updatedPoll };
}
