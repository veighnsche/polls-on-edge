import { z } from 'zod';

/* ─────────────────────────────── types ─────────────────────────────── */

export interface UserData {
	ownedPollIds: string[];
	votes: Record<string, number>; // pollId -> optionIndex
}

export interface Env {
	JWT_SECRET: string;
}

/* ────────────────────────────── zod schemas ─────────────────────────── */

const AddPollSchema = z.object({
	pollId: z.string().min(1),
});

const AddVoteSchema = z.object({
	pollId: z.string().min(1),
	optionIndex: z.number().int().min(0),
});

/* ────────────────────────────── constants ────────────────────────────── */

const DEFAULT_USER: UserData = { ownedPollIds: [], votes: {} };

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

/* ─────────────────────────── durable object ─────────────────────────── */

export class UserDurableObject {
	constructor(private state: DurableObjectState) {}

	/* ───────────────────────── helpers ───────────────────────── */

	private json(body: unknown, status = 200) {
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
		});
	}

	private text(body: string, status = 200) {
		return new Response(body, { status, headers: CORS_HEADERS });
	}

	/* ───────────────────────── endpoint handler ───────────────────────── */

	async fetch(request: Request): Promise<Response> {
		const { method } = request;
		const url = new URL(request.url);

		/* Handle CORS pre‑flight */
		if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

		/* Read (or initialise) user blob once – most routes need it */
		const load = async () => (await this.state.storage.get<UserData>('user')) ?? { ...DEFAULT_USER };
		const save = (data: UserData) => this.state.storage.put('user', data);

		switch (`${method.toUpperCase()} ${url.pathname}`) {
			/* ─────────────── GET /state ─────────────── */
			case 'GET /state': {
				return this.json(await load());
			}

			/* ─────────────── POST /add-poll ─────────────── */
			case 'POST /add-poll': {
				const parse = AddPollSchema.safeParse(await request.json());
				if (!parse.success) return this.json(parse.error.format(), 400);

				const data = await load();
				if (!data.ownedPollIds.includes(parse.data.pollId)) {
					data.ownedPollIds.push(parse.data.pollId);
					await save(data);
				}
				return this.json({ success: true });
			}

			/* ─────────────── POST /add-vote ─────────────── */
			case 'POST /add-vote': {
				const parse = AddVoteSchema.safeParse(await request.json());
				if (!parse.success) return this.json(parse.error.format(), 400);

				const data = await load();
				data.votes[parse.data.pollId] = parse.data.optionIndex;
				await save(data);
				return this.json({ success: true });
			}

			/* ─────────────── GET /has-voted ─────────────── */
			case 'GET /has-voted': {
				const pollId = url.searchParams.get('pollId');
				if (!pollId) return this.json({ error: 'Missing pollId' }, 400);

				const data = await load();
				const userVote = data.votes[pollId];
				return this.json({ hasVoted: userVote !== undefined, userVote: userVote ?? null });
			}

			/* ─────────────── default ─────────────── */
			default:
				return this.text('Not found', 404);
		}
	}
}
