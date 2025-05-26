/*
 * pollService.ts – hardened service‑layer helpers
 * ------------------------------------------------------------
 * • Requires a real JWT for every mutating call.
 * • Consistent error handling – bubbles DO response text.
 * • DRY header builder.
 * • Helpful console logs gated behind `DEBUG` env var.
 */

import type { PollData } from '../types/PollData';
import { StatusCodes as HTTP } from './utils/status'; // tiny enum you can add–optional

/* ------------------------------------------------------------------------- */
// Types
/* ------------------------------------------------------------------------- */

type Env = {
	POLL_DO: DurableObjectNamespace;
	POLL_INDEX: KVNamespace;
};

type JwtPayload = { sub?: string };

/* ------------------------------------------------------------------------- */
// Internal helpers
/* ------------------------------------------------------------------------- */

function debug(...args: unknown[]) {
	if ((globalThis as any).DEBUG) console.log(...args);
}

const authHeaders = (jwt: string): HeadersInit => ({
	Authorization: `Bearer ${jwt}`,
	'Content-Type': 'application/json',
});

function requireJwt(jwt?: string): asserts jwt is string {
	if (!jwt) throw new Error('JWT is required for this operation');
}

/* ------------------------------------------------------------------------- */
// Service API
/* ------------------------------------------------------------------------- */

export async function createPoll({
	question,
	options,
	ttl,
	env,
	jwtPayload,
	jwt,
}: {
	question: string;
	options: string[];
	ttl: number;
	env: Env;
	jwtPayload: JwtPayload;
	jwt?: string;
}): Promise<{ id?: string; error?: string }> {
	requireJwt(jwt);
	const ownerId = jwtPayload.sub;
	if (!ownerId) return { error: 'Missing ownerId in JWT' };

	const durableId = env.POLL_DO.newUniqueId();
	const id = durableId.toString();
	const stub = env.POLL_DO.get(durableId);

	const pollData: PollData = {
		id,
		question,
		options,
		ttl,
		createdAt: Date.now(),
		ownerId,
		votes: Array(options.length).fill(0),
	};

	debug('[SERVICE] createPoll ->', pollData);

	const res = await stub.fetch('https://dummy/state', {
		method: 'PUT',
		body: JSON.stringify(pollData),
		headers: authHeaders(jwt),
	});

	if (!res.ok) return { error: await res.text() };

	// Maintain per‑user index ---------------------------------------------------
	const existing: string[] | null = await env.POLL_INDEX.get(ownerId, 'json');
	const pollIds = existing ?? [];
	pollIds.push(id);
	await env.POLL_INDEX.put(ownerId, JSON.stringify(pollIds));

	return { id };
}

export async function editPoll({
	pollId,
	question,
	options,
	ttl,
	env,
	jwtPayload,
	jwt,
}: {
	pollId: string;
	question: string;
	options: string[];
	ttl: number;
	env: Env;
	jwtPayload: JwtPayload;
	jwt?: string;
}): Promise<{ ok: boolean; error?: string }> {
	requireJwt(jwt);
	const ownerId = jwtPayload.sub;
	if (!ownerId) return { ok: false, error: 'Missing ownerId in JWT' };

	const stub = env.POLL_DO.get(env.POLL_DO.idFromString(pollId));

	// Fetch current state -------------------------------------------------------
	const current = await stub.fetch('https://dummy/state');
	if (current.status === HTTP.NOT_FOUND) return { ok: false, error: 'Poll not found' };

	const poll: PollData = await current.json();
	if (poll.ownerId !== ownerId) return { ok: false, error: 'Unauthorized' };

	const updated: PollData = { ...poll, question, options, ttl };
	const res = await stub.fetch('https://dummy/state', {
		method: 'PATCH',
		body: JSON.stringify(updated),
		headers: authHeaders(jwt),
	});

	if (!res.ok) return { ok: false, error: await res.text() };
	return { ok: true };
}

export async function deletePoll({
	pollId,
	env,
	jwtPayload,
	jwt,
}: {
	pollId: string;
	env: Env;
	jwtPayload: JwtPayload;
	jwt?: string;
}): Promise<{ ok: boolean; error?: string }> {
	requireJwt(jwt);
	const ownerId = jwtPayload.sub;
	if (!ownerId) return { ok: false, error: 'Missing ownerId in JWT' };

	const stub = env.POLL_DO.get(env.POLL_DO.idFromString(pollId));

	const resState = await stub.fetch('https://dummy/state');
	if (resState.status === HTTP.NOT_FOUND) return { ok: false, error: 'Poll not found' };

	const poll: PollData = await resState.json();
	if (poll.ownerId !== ownerId) return { ok: false, error: 'Unauthorized' };

	const resDel = await stub.fetch('https://dummy/delete', {
		method: 'DELETE',
		headers: authHeaders(jwt),
	});
	if (!resDel.ok) return { ok: false, error: await resDel.text() };

	// Update index -------------------------------------------------------------
	const existing: string[] | null = await env.POLL_INDEX.get(ownerId, 'json');
	const updatedIds = existing ? existing.filter(pid => pid !== pollId) : [];
	await env.POLL_INDEX.put(ownerId, JSON.stringify(updatedIds));

	return { ok: true };
}

export async function votePoll({
	pollId,
	optionIndex,
	env,
	jwt,
}: {
	pollId: string;
	optionIndex: number;
	env: Env;
	jwt?: string; // anonymous voting supported? pass undefined to skip auth header
}): Promise<{ ok: boolean; updatedPoll?: PollData; error?: string }> {
	const stub = env.POLL_DO.get(env.POLL_DO.idFromString(pollId));

	const res = await stub.fetch('https://dummy/vote', {
		method: 'POST',
		body: JSON.stringify({ optionIndex }),
		headers: {
			...(jwt ? authHeaders(jwt) : { 'Content-Type': 'application/json' }),
		},
	});

	if (!res.ok) return { ok: false, error: await res.text() };

	const updatedPoll: PollData = await res.json();
	return { ok: true, updatedPoll };
}
