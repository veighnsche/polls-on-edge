/**
 * userDurableObject.ts – refined implementation of **UserDurableObject**
 * ---------------------------------------------------------------------
 * ▸ Collapses repetitive logic (CORS, JSON helpers, load/save) into utilities
 * ▸ Introduces a tiny router table + handler helpers for clarity
 * ▸ Provides strongly‑typed helpers (`Ok`, `Err`) for consistent returns
 * ▸ Keeps the public storage shape 100% backward‑compatible
 */

import { z } from 'zod';

/* ------------------------------------------------------------------------- */
// Types
/* ------------------------------------------------------------------------- */

export interface UserData {
	ownedPollIds: string[];
	votes: Record<string, number>; // pollId -> optionIndex
}

export interface Env {
	JWT_SECRET: string;
}

/* ------------------------------------------------------------------------- */
// Schemas
/* ------------------------------------------------------------------------- */

const AddPollSchema = z.object({ pollId: z.string().min(1) });
const AddVoteSchema = z.object({
	pollId: z.string().min(1),
	optionIndex: z.number().int().min(0),
});

/* ------------------------------------------------------------------------- */
// Constants & helpers
/* ------------------------------------------------------------------------- */

const DEFAULT_USER: UserData = { ownedPollIds: [], votes: {} };

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	});

const text = (body: string, status = 200) => new Response(body, { status, headers: CORS_HEADERS });

/* ── Result helper ── */

type Ok<T = void> = { ok: true; data: T };
type Err = { ok: false; error: string };

type Result<T = void> = Ok<T> | Err;

const ok = <T = void>(data: T): Ok<T> => ({ ok: true, data });
const err = (error: string): Err => ({ ok: false, error });

/* ------------------------------------------------------------------------- */
// Handler type
/* ------------------------------------------------------------------------- */

type Handler<T = void> = (req: Request, url: URL) => Promise<Result<T>>;

/* ------------------------------------------------------------------------- */
// Durable Object implementation
/* ------------------------------------------------------------------------- */

export class UserDurableObject {
	constructor(private state: DurableObjectState) {}

	/* ─────────── high‑level storage helpers ─────────── */

	private async load(): Promise<UserData> {
		return (
			(await this.state.storage.get<UserData>('user')) ?? {
				...DEFAULT_USER,
			}
		);
	}

	private save(data: UserData) {
		return this.state.storage.put('user', data);
	}

	/* ------------------------------------------------------------------ */
	// Router handlers
	/* ------------------------------------------------------------------ */

	private readonly handlers: Record<string, Handler<any>> = {
		/* GET /state */
		'GET /state': async () => ok(await this.load()),

		/* POST /add-poll */
		'POST /add-poll': async req => {
			const parse = AddPollSchema.safeParse(await req.json());
			if (!parse.success) return err(JSON.stringify(parse.error.format()));

			const data = await this.load();
			if (!data.ownedPollIds.includes(parse.data.pollId)) {
				data.ownedPollIds.push(parse.data.pollId);
				await this.save(data);
			}
			return ok(undefined);
		},

		/* POST /add-vote */
		'POST /add-vote': async req => {
			const parse = AddVoteSchema.safeParse(await req.json());
			if (!parse.success) return err(JSON.stringify(parse.error.format()));

			const data = await this.load();
			data.votes[parse.data.pollId] = parse.data.optionIndex;
			await this.save(data);
			return ok(undefined);
		},

		/* GET /has-voted */
		'GET /has-voted': async (_req, url) => {
			const pollId = url.searchParams.get('pollId');
			if (!pollId) return err('Missing pollId');

			const data = await this.load();
			const userVote = data.votes[pollId];
			return ok({
				hasVoted: userVote !== undefined,
				userVote: userVote ?? null,
			});
		},
	};

	/* ------------------------------------------------------------------ */
	// fetch entrypoint
	/* ------------------------------------------------------------------ */

	async fetch(request: Request): Promise<Response> {
		const { method } = request;
		const url = new URL(request.url);
		const routeKey = `${method.toUpperCase()} ${url.pathname}`;
		console.log('[UserDO] ', routeKey);

		// Handle CORS pre‑flight early
		if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

		const handler = this.handlers[routeKey];
		if (!handler) return text('Not found', 404);

		const result = await handler(request, url);
		return result.ok ? json(result.data ?? { success: true }) : json({ error: result.error }, 400);
	}
}
