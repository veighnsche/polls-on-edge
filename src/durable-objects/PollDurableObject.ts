/**
 * PollDurableObject.ts
 * -----------------------------------------------------------------------------
 * ‣ Manages **only** the poll document and its aggregated vote counters.
 * ‣ All per-user data (who owns what, who already voted, etc.) now lives in
 *   **UserDurableObject**.  PollDO calls into that object to prevent
 *   double-voting and to record a successful ballot.
 *
 * Bindings you need in `wrangler.toml`
 * ------------------------------------
 * [[durable_objects.bindings]]
 * name       = "USER_DO"
 * class_name = "UserDurableObject"
 *
 * [[bindings]]
 * type = "secret"
 * name = "JWT_SECRET"
 */

import { verify } from 'hono/jwt';
import { z } from 'zod';
import { PollDataSchema, type PollData } from '../types/PollData';

export interface Env {
	JWT_SECRET: string;
	USER_DO: DurableObjectNamespace;
}

interface JwtPayload {
	sub: string;
}

/* ────────────────────────────── Zod Schemas ─────────────────────────────── */

/** Incoming `{ optionIndex }` for a vote. */
const VoteRequestSchema = z.object({
	optionIndex: z.number().int().min(0),
});

/**
 * PATCH payload may update anything *except* immutable fields.
 * (`votes` stays internal-only; per-user votes are now in UserDO.)
 */
const PatchPollSchema = PollDataSchema.partial().omit({
	id: true,
	ownerId: true,
	votes: true,
});

/* ─────────────────────────────── constants ──────────────────────────────── */

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

/* ────────────────────────────── Durable Object ───────────────────────────── */

export class PollDurableObject {
	constructor(
		private readonly state: DurableObjectState,
		private readonly env: Env,
	) {}

	/* ───────────────────────────── helper responses ─────────────────────── */

	private json(body: unknown, status = 200) {
		return new Response(JSON.stringify(body), {
			status,
			headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
		});
	}

	private text(body: string, status = 200) {
		return new Response(body, { status, headers: CORS_HEADERS });
	}

	/* ───────────────────────────── misc helpers ─────────────────────────── */

	private async getJwt(request: Request): Promise<JwtPayload | null> {
		const auth = request.headers.get('Authorization');
		if (!auth?.startsWith('Bearer ')) return null;
		try {
			return (await verify(auth.slice(7), this.env.JWT_SECRET)) as unknown as JwtPayload;
		} catch {
			return null;
		}
	}

	private async loadPoll(storage: DurableObjectStorage | DurableObjectTransaction = this.state.storage): Promise<PollData> {
		const poll = await storage.get<PollData>('poll');
		if (!poll) throw new Error('Not found');
		return poll;
	}

	/** Obtain a stub for the requesting user’s UserDO (by their `sub`). */
	private getUserStub(userId: string): DurableObjectStub {
		const id = this.env.USER_DO.idFromName(userId);
		return this.env.USER_DO.get(id);
	}

	/* ───────────────────────────── request handler ───────────────────────── */

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		console.log(`[PollDurableObject] fetch: ${request.method} ${url.pathname}`);

		/* CORS pre-flight */
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		switch (`${request.method} ${url.pathname}`) {
			/* ─────────────── read current poll ─────────────── */
			case 'GET /state': {
				const poll = await this.state.storage.get<PollData>('poll');
				console.log(`[PollDurableObject] GET /state, poll:`, poll);
				return poll ? this.json(poll) : this.text('Not found', 404);
			}

			/* ─────────────── create poll ─────────────── */
			case 'PUT /state': {
				/* owner must be authenticated */
				const jwt = await this.getJwt(request);
				if (!jwt) {
					console.log(`[PollDurableObject] PUT /state: Unauthorized`);
					return this.text('Unauthorized', 401);
				}

				const body = await request.json();
				console.log(`[PollDurableObject] PUT /state: body:`, body);
				const parsed = PollDataSchema.safeParse(body);
				if (!parsed.success) {
					console.log(`[PollDurableObject] PUT /state: validation failed`, parsed.error.format());
					return this.json(parsed.error.format(), 400);
				}

				const poll = parsed.data;
				if (poll.ownerId !== jwt.sub) {
					console.log(`[PollDurableObject] PUT /state: ownerId mismatch jwt.sub=${jwt.sub}, poll.ownerId=${poll.ownerId}`);
					return this.text('ownerId must match JWT', 403);
				}

				await this.state.storage.put('poll', poll);
				console.log(`[PollDurableObject] PUT /state: poll saved`, poll);
				return this.json({ ok: true }, 201);
			}

			/* ─────────────── update poll ─────────────── */
			case 'PATCH /state': {
				console.log(`[PollDurableObject] PATCH /state`);
				const jwt = await this.getJwt(request);
				if (!jwt) return this.text('Unauthorized', 401);

				let poll;
				try {
					poll = await this.loadPoll();
				} catch {
					return this.text('Not found', 404);
				}
				if (poll.ownerId !== jwt.sub) return this.text('Forbidden', 403);

				const patchBody = await request.json();
				console.log(`[PollDurableObject] PATCH /state: patchBody`, patchBody);
				const parsed = PatchPollSchema.safeParse(patchBody);
				if (!parsed.success) {
					console.log(`[PollDurableObject] PATCH /state: validation failed`, parsed.error.format());
					return this.json(parsed.error.format(), 400);
				}

				const updated: PollData = { ...poll, ...parsed.data };
				await this.state.storage.put('poll', updated);
				console.log(`[PollDurableObject] PATCH /state: poll updated`, updated);
				return this.json(updated);
			}

			/* ─────────────── delete poll ─────────────── */
			case 'DELETE /delete': {
				console.log(`[PollDurableObject] DELETE /delete`);
				const jwt = await this.getJwt(request);
				if (!jwt) return this.text('Unauthorized', 401);

				let poll;
				try {
					poll = await this.loadPoll();
				} catch {
					return this.text('Not found', 404);
				}
				if (poll.ownerId !== jwt.sub) return this.text('Forbidden', 403);

				await this.state.storage.deleteAll();
				console.log(`[PollDurableObject] DELETE /delete: poll deleted`);
				return this.json({ ok: true }, 200);
			}

			/* ─────────────── vote ─────────────── */
			case 'POST /vote': {
				console.log(`[PollDurableObject] POST /vote`);
				/* authenticate & parse body first (cheap) */
				const jwt = await this.getJwt(request);
				if (!jwt) return this.text('Unauthorized', 401);

				const voteBody = await request.json();
				console.log(`[PollDurableObject] POST /vote: body`, voteBody);
				const parsedBody = VoteRequestSchema.safeParse(voteBody);
				if (!parsedBody.success) {
					console.log(`[PollDurableObject] POST /vote: validation failed`, parsedBody.error.format());
					return this.json(parsedBody.error.format(), 400);
				}
				const { optionIndex } = parsedBody.data;

				/* Ask UserDO if this user already voted in this poll */
				let poll;
				try {
					poll = await this.loadPoll();
				} catch {
					return this.text('Not found', 404);
				}
				const userStub = this.getUserStub(jwt.sub);

				const hasVotedUrl = new URL('https://dummy/has-voted');
				hasVotedUrl.searchParams.set('pollId', poll.id);
				const hasVotedRes = await userStub.fetch(hasVotedUrl.toString(), { cf: { cacheTtl: 0 } });
				const hasVoted: { hasVoted: boolean } = await hasVotedRes.json();

				if (hasVoted.hasVoted) return this.text('Already voted', 403);
				if (optionIndex >= poll.options.length) return this.text('Invalid option index', 400);

				/* -------- increment counts atomically inside PollDO -------- */
				await this.state.storage.transaction(async txn => {
					const live = await this.loadPoll(txn); // refresh inside txn
					while (live.votes.length < live.options.length) live.votes.push(0);
					live.votes[optionIndex] += 1;
					await txn.put('poll', live);
				});

				/* Record the vote in UserDO (best-effort) */
				await userStub.fetch('https://dummy/add-vote', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ pollId: poll.id, optionIndex }),
				});

				const updatedPoll = await this.state.storage.get<PollData>('poll');
				return this.json({ ...updatedPoll, userVote: optionIndex });
			}

			/* ─────────────── unknown route ─────────────── */
			default:
				return this.text('Not found', 404);
		}
	}
}
