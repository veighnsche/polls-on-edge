/**
 * pollService.ts – service helpers wired to **PollDurableObject** + **UserDurableObject**
 * Refactored for readability, reuse, and stronger typing.
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

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

/* ------------------------------------------------------------------------- */
// Internals
/* ------------------------------------------------------------------------- */

const DUMMY_HOST = 'https://dummy';

function debug(...args: unknown[]) {
	if ((globalThis as any).DEBUG) console.log('[pollService.debug]', ...args);
}

const authHeaders = (jwt: string): HeadersInit => ({
	Authorization: `Bearer ${jwt}`,
	'Content-Type': 'application/json',
});

function requireJwt(jwt?: string): asserts jwt is string {
	if (!jwt) throw new Error('JWT is required for this operation');
}

const getUserStub = (env: Env, userId: string) => env.USER_DO.get(env.USER_DO.idFromName(userId));

const getPollStub = (env: Env, pollId: string) => env.POLL_DO.get(env.POLL_DO.idFromName(pollId));

async function callDO(stub: DurableObjectStub, path: string, init: RequestInit = {}): Promise<Response> {
	const url = `${DUMMY_HOST}/${path}`;
	return stub.fetch(url, init);
}

async function readJsonOrError<T>(res: Response): Promise<Result<T>> {
	if (res.ok) {
		const data = (await res.json()) as T;
		return { ok: true, data };
	}
	return { ok: false, error: await res.text() };
}

/* ------------------------------------------------------------------------- */
// Service API
/* ------------------------------------------------------------------------- */

export async function createPoll(params: {
	question: string;
	options: string[];
	ttl: number;
	env: Env;
	jwtPayload: JwtPayload;
	jwt?: string;
}): Promise<Result<{ id: string }>> {
	const { question, options, ttl, env, jwtPayload, jwt } = params;
	requireJwt(jwt);
	const ownerId = jwtPayload.sub;
	if (!ownerId) return { ok: false, error: 'Missing ownerId in JWT' };

	const id = crypto.randomUUID();
	const pollStub = getPollStub(env, id);
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

	debug('createPoll ->', pollData);

	// 1. create poll in PollDO
	const createRes = await callDO(pollStub, 'state', {
		method: 'PUT',
		body: JSON.stringify(pollData),
		headers: authHeaders(jwt),
	});
	const pollResult = await readJsonOrError<void>(createRes);
	if (!pollResult.ok) return pollResult;

	// 2. register ownership in UserDO
	const userRes = await callDO(userStub, 'add-poll', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ pollId: id }),
	});
	const userResult = await readJsonOrError<void>(userRes);
	if (!userResult.ok) return userResult;

	return { ok: true, data: { id } };
}

async function assertPollOwner(pollStub: DurableObjectStub, ownerId: string): Promise<Result<PollData>> {
	const res = await callDO(pollStub, 'state');
	if (res.status === HTTP.NOT_FOUND) return { ok: false, error: 'Poll not found' };

	const poll: PollData = await res.json();
	if (poll.ownerId !== ownerId) return { ok: false, error: 'Unauthorized' };

	return { ok: true, data: poll };
}

export async function editPoll(params: {
	pollId: string;
	question: string;
	options: string[];
	ttl: number;
	env: Env;
	jwtPayload: JwtPayload;
	jwt?: string;
}): Promise<Result<void>> {
	const { pollId, question, options, ttl, env, jwtPayload, jwt } = params;
	requireJwt(jwt);

	const ownerId = jwtPayload.sub;
	if (!ownerId) return { ok: false, error: 'Missing ownerId in JWT' };

	const pollStub = getPollStub(env, pollId);

	// auth check
	const auth = await assertPollOwner(pollStub, ownerId);
	if (!auth.ok) return auth;

	const patch = { question, options, ttl };
	const res = await callDO(pollStub, 'state', {
		method: 'PATCH',
		body: JSON.stringify(patch),
		headers: authHeaders(jwt),
	});
	return readJsonOrError<void>(res);
}

export async function deletePoll(params: { pollId: string; env: Env; jwtPayload: JwtPayload; jwt?: string }): Promise<Result<void>> {
	const { pollId, env, jwtPayload, jwt } = params;
	requireJwt(jwt);
	const ownerId = jwtPayload.sub;
	if (!ownerId) return { ok: false, error: 'Missing ownerId in JWT' };

	const pollStub = getPollStub(env, pollId);
	const userStub = getUserStub(env, ownerId);

	// auth check
	const auth = await assertPollOwner(pollStub, ownerId);
	if (!auth.ok) return auth;

	// 1. delete poll in PollDO
	const delRes = await callDO(pollStub, 'delete', {
		method: 'DELETE',
		headers: authHeaders(jwt),
	});
	const delResult = await readJsonOrError<void>(delRes);
	if (!delResult.ok) return delResult;

	// 2. update UserDO
	await callDO(userStub, 'remove-poll', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ pollId }),
	});

	return { ok: true, data: undefined };
}

export async function votePoll(params: { pollId: string; optionIndex: number; env: Env; jwt?: string }): Promise<Result<PollData>> {
	const { pollId, optionIndex, env, jwt } = params;
	const pollStub = getPollStub(env, pollId);

	// 1. submit vote to PollDO
	const voteRes = await callDO(pollStub, 'vote', {
		method: 'POST',
		body: JSON.stringify({ optionIndex }),
		headers: jwt ? authHeaders(jwt) : { 'Content-Type': 'application/json' },
	});
	const voteResult = await readJsonOrError<PollData>(voteRes);
	if (!voteResult.ok) return voteResult;

	// 2. persist per-user vote (if authenticated)
	if (jwt) {
		const { sub } = JSON.parse(atob(jwt.split('.')[1] || '')) as JwtPayload;
		if (sub) {
			const userStub = getUserStub(env, sub);
			await callDO(userStub, 'add-vote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pollId, optionIndex }),
			});
		}
	}

	return voteResult;
}
