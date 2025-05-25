import { PollData } from "../types/PollData";

type Env = {
  POLL_DO: DurableObjectNamespace;
  POLL_INDEX: KVNamespace;
};

type JwtPayload = { sub?: string };

export async function createPoll({ question, options, ttl, env, jwtPayload, jwt }: {
  question: string;
  options: string[];
  ttl: number;
  env: Env;
  jwtPayload: JwtPayload;
  jwt: string;
}): Promise<{ id?: string; error?: string }> {
  console.log("[SERVICE] createPoll called with:", { question, options, ttl, jwtPayload, jwt });
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
  console.log("[SERVICE] pollData:", { ...pollData, votes: `[${pollData.votes.length} votes omitted]` });

  const doResponse = await stub.fetch("https://dummy/state", {
    method: "PUT",
    body: JSON.stringify(pollData),
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json"
    }
  });
  console.log("[SERVICE] DO response status:", doResponse.status);
  if (!doResponse.ok) {
    const text = await doResponse.text();
    console.log("[SERVICE] DO error response:", text);
    return { error: text };
  }

  // Update global poll index for owner
  const existing = await env.POLL_INDEX.get(ownerId, "json");
  console.log("[SERVICE] existing pollIds:", existing);
  const pollIds = Array.isArray(existing) ? existing : [];
  pollIds.push(id);
  await env.POLL_INDEX.put(ownerId, JSON.stringify(pollIds));
  console.log("[SERVICE] pollIds after push:", pollIds);
  return { id };

}

export async function editPoll({ pollId, question, options, ttl, env, jwtPayload, jwt }: {
  pollId: string;
  question: string;
  options: string[];
  ttl: number;
  env: Env;
  jwtPayload: JwtPayload;
  jwt: string;
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
    method: "PATCH",
    body: JSON.stringify(updatedPoll),
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json"
    }
  });
  return { ok: true };
}

export async function deletePoll({ pollId, env, jwtPayload, jwt }: {
  pollId: string;
  env: Env;
  jwtPayload: JwtPayload;
  jwt: string;
}): Promise<{ ok: boolean; error?: string }> {
  const durableId = env.POLL_DO.idFromString(pollId);
  const stub = env.POLL_DO.get(durableId);
  const res = await stub.fetch("https://dummy/state");
  if (!res.ok) {
    return { ok: false, error: "Poll not found" };
  }
  const poll: PollData = await res.json();
  const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';
  if (!poll || poll.ownerId !== ownerId) {
    return { ok: false, error: "Unauthorized" };
  }
  await stub.fetch("https://dummy/delete", {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json"
    }
  });
  // Remove from global poll index
  const existing = await env.POLL_INDEX.get(ownerId, "json");
  const pollIds = Array.isArray(existing) ? existing : [];
  const updatedPollIds = pollIds.filter((pid: string) => pid !== pollId);
  await env.POLL_INDEX.put(ownerId, JSON.stringify(updatedPollIds));
  return { ok: true };
}

export async function votePoll({ pollId, optionIndex, env, jwt }: {
  pollId: string;
  optionIndex: number;
  env: Env;
  jwt: string;
}): Promise<{ ok: boolean; updatedPoll?: PollData; error?: string }> {
  const durableId = env.POLL_DO.idFromString(pollId);
  const stub = env.POLL_DO.get(durableId);
  const voteRes = await stub.fetch("https://dummy/vote", {
    method: "POST",
    body: JSON.stringify({ optionIndex }),
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json"
    }
  });
  if (!voteRes.ok) {
    return { ok: false, error: "Vote failed" };
  }
  const updatedPoll: PollData = await voteRes.json();
  return { ok: true, updatedPoll };
}
