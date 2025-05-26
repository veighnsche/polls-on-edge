/**
 * pollService.ts – service helpers wired to **PollDurableObject** + **UserDurableObject**
 * -------------------------------------------------------------------------------------
 * • POLL_DO  – per-poll state / vote counters
 * • USER_DO  – per-user state (ownedPollIds, votes)
 */

import type { PollData } from '../types/PollData';
import { StatusCodes as HTTP } from './utils/status';

/* ------------------------------------------------------------------------- */
// Types / bindings
/* ------------------------------------------------------------------------- */

type Env = {
	POLL_DO: DurableObjectNamespace;
	USER_DO: DurableObjectNamespace;
};

type JwtPayload = { sub?: string };

/* ------------------------------------------------------------------------- */
// Internals
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

const getUserStub = (env: Env, userId: string) => env.USER_DO.get(env.USER_DO.idFromName(userId));

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
	const pollStub = env.POLL_DO.get(durableId);
	const userStub = getUserStub(env, ownerId);

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

	/* 1. create poll --------------------------------------------------------- */
	const res = await pollStub.fetch('https://dummy/state', {
		method: 'PUT',
		body: JSON.stringify(pollData),
		headers: authHeaders(jwt),
	});
	if (!res.ok) return { error: await res.text() };

	/* 2. register ownership in UserDO --------------------------------------- */
	await userStub.fetch('https://dummy/add-poll', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ pollId: id }),
	});

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

	const pollStub = env.POLL_DO.get(env.POLL_DO.idFromString(pollId));

	/* pull current state for auth check */
	const current = await pollStub.fetch('https://dummy/state');
	if (current.status === HTTP.NOT_FOUND) return { ok: false, error: 'Poll not found' };

	const poll: PollData = await current.json();
	if (poll.ownerId !== ownerId) return { ok: false, error: 'Unauthorized' };

	const patch = { question, options, ttl };
	const res = await pollStub.fetch('https://dummy/state', {
		method: 'PATCH',
		body: JSON.stringify(patch),
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

	const pollStub = env.POLL_DO.get(env.POLL_DO.idFromString(pollId));
	const userStub = getUserStub(env, ownerId);

	/* verify poll exists and user owns it */
	const resState = await pollStub.fetch('https://dummy/state');
	if (resState.status === HTTP.NOT_FOUND) return { ok: false, error: 'Poll not found' };

	const poll: PollData = await resState.json();
	if (poll.ownerId !== ownerId) return { ok: false, error: 'Unauthorized' };

	/* delete in PollDO */
	const resDel = await pollStub.fetch('https://dummy/delete', {
		method: 'DELETE',
		headers: authHeaders(jwt),
	});
	if (!resDel.ok) return { ok: false, error: await resDel.text() };

	/* update UserDO (remove pollId) */
	await userStub.fetch('https://dummy/remove-poll', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ pollId }),
	});

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
	jwt?: string; // pass undefined for anonymous vote
}): Promise<{ ok: boolean; updatedPoll?: PollData; error?: string }> {
	const pollStub = env.POLL_DO.get(env.POLL_DO.idFromString(pollId));

	/* 1. submit vote to PollDO */
	const res = await pollStub.fetch('https://dummy/vote', {
		method: 'POST',
		body: JSON.stringify({ optionIndex }),
		headers: {
			...(jwt ? authHeaders(jwt) : { 'Content-Type': 'application/json' }),
		},
	});
	if (!res.ok) return { ok: false, error: await res.text() };

	const updatedPoll: PollData = await res.json();

	/* 2. persist per-user vote (if authenticated) */
	if (jwt) {
		const { sub } = JSON.parse(atob(jwt.split('.')[1] || '')) as JwtPayload; // light client-side decode
		if (sub) {
			const userStub = getUserStub(env, sub);
			await userStub.fetch('https://dummy/add-vote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pollId, optionIndex }),
			});
		}
	}

	return { ok: true, updatedPoll };
}
