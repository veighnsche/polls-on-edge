/*
 * Application routes (refactored & bug‑fixed)
 * --------------------------------------------------------------
 * • DRY validation middleware `validatePollForm`
 * • Service calls aligned with hardened DO (PUT /state, PATCH /state)
 * • JWT auto‑forward via pollService
 * • showRoutes guarded by a Miniflare-only flag (no `process`/Node globals)
 */

import { zValidator } from '@hono/zod-validator';
import { Hono, type Context, type Next } from 'hono';
import { showRoutes } from 'hono/dev';
import { jsxRenderer } from 'hono/jsx-renderer';

import { ConfirmDeletePage } from './components/ConfirmDeletePage';
import { CreatePage } from './components/CreatePage';
import { EditPage } from './components/EditPage';
import { LandingPage } from './components/LandingPage';
import { Layout } from './components/Layout';
import { PollPage } from './components/PollPage';
import { anonJwtCookie } from './middleware/anonJwtCookie';
import * as pollService from './services/pollService';

import { PollFormSchema, VoteRequestBodySchema, type PollForm } from './types/PollData';

export { PollDurableObject } from './PollDurableObject';

// ---------------------------------------------------------------------------
// Hono context augmentation --------------------------------------------------

declare module 'hono' {
	interface ContextVariableMap {
		pollForm: PollForm;
	}
}

// ---------------------------------------------------------------------------
// Bindings -------------------------------------------------------------------

type Bindings = {
	POLL_DO: DurableObjectNamespace;
	POLL_INDEX: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// ---------------------------------------------------------------------------
// Global middleware ----------------------------------------------------------

app.use('*', anonJwtCookie);

app.get(
	'*',
	jsxRenderer(({ children }) => <Layout>{children}</Layout>),
);

// ---------------------------------------------------------------------------
// Utility middleware ---------------------------------------------------------

/**
 * Extract & validate HTML form input for poll create / edit routes.
 * Adds the parsed data to `c.set('pollForm', data)`.
 */
const validatePollForm = async (c: Context, next: Next) => {
	const body = await c.req.parseBody();
	const question = typeof body['question'] === 'string' ? String(body['question']).trim() : '';
	const options = [1, 2, 3, 4, 5]
		.map(i => (typeof body[`option${i}`] === 'string' ? String(body[`option${i}`] as string).trim() : ''))
		.filter(Boolean);
	const ttl = typeof body['ttl'] === 'string' ? String(body['ttl']).trim() : '86400';

	const parsed = PollFormSchema.safeParse({ question, options, ttl });
	if (!parsed.success) {
		return c.html(
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-destructive">Invalid poll data</h1>
				<pre className="text-sm text-destructive/70">{JSON.stringify(parsed.error.issues, null, 2)}</pre>
			</section>,
			400,
		);
	}

	c.set('pollForm', parsed.data);
	await next();
};

// ---------------------------------------------------------------------------
// Page routes ----------------------------------------------------------------

app.get('/', c => {
	const jwtPayload = c.get('jwtPayload');
	return c.render(<LandingPage env={c.env} jwtPayload={jwtPayload} />);
});

app.get('/create', c => c.render(<CreatePage />));

app.get('/poll/:pollId', c => {
	const pollId = c.req.param('pollId');
	const jwtPayload = c.get('jwtPayload');
	return c.render(<PollPage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />);
});

app.get('/poll/:pollId/edit', c => {
	const pollId = c.req.param('pollId');
	const jwtPayload = c.get('jwtPayload');
	return c.render(<EditPage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />);
});

app.get('/poll/:pollId/delete', c => {
	const pollId = c.req.param('pollId');
	const jwtPayload = c.get('jwtPayload');
	return c.render(<ConfirmDeletePage pollId={pollId} env={c.env} jwtPayload={jwtPayload} />);
});

// ---------------------------------------------------------------------------
// API routes -----------------------------------------------------------------

app.post('/api/poll/create', validatePollForm, async c => {
	console.log('[ROUTE] /api/poll/create - called');
	const { question, options, ttl } = c.get('pollForm');
	const jwtPayload = c.get('jwtPayload');
	const jwt = (c.req as any).cookie ? (c.req as any).cookie('jwt') : undefined;
	console.log('[ROUTE] JWT string:', jwt);
	if (!jwt) {
		return c.html(
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-destructive">Missing JWT</h1>
				<p className="text-sm text-destructive/70">Authentication token missing. Please refresh and try again.</p>
			</section>,
			401,
		);
	}
	const result = await pollService.createPoll({ question, options, ttl, env: c.env, jwtPayload, jwt });
	console.log('[ROUTE] pollService.createPoll result:', result);
	return c.redirect(`/poll/${result.id}`, 303);
});

app.post('/api/poll/:pollId/edit', validatePollForm, async c => {
	const pollId = c.req.param('pollId');
	const { question, options, ttl } = c.get('pollForm');
	const jwtPayload = c.get('jwtPayload');
	const jwt = (c.req as any).cookie ? (c.req as any).cookie('jwt') : undefined;
	console.log('[ROUTE] JWT string:', jwt);
	if (!jwt) {
		return c.html(
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-destructive">Missing JWT</h1>
				<p className="text-sm text-destructive/70">Authentication token missing. Please refresh and try again.</p>
			</section>,
			401,
		);
	}
	const result = await pollService.editPoll({ pollId, question, options, ttl, env: c.env, jwtPayload, jwt });
	if (!result.ok) {
		const msg = result.error === 'Unauthorized' ? 'Unauthorized' : 'Poll not found';
		return c.html(
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-destructive">{msg}</h1>
			</section>,
			result.error === 'Unauthorized' ? 403 : 404,
		);
	}
	return c.redirect(`/poll/${pollId}`, 303);
});

app.post('/api/poll/:pollId/delete', async c => {
	const pollId = c.req.param('pollId');
	const jwtPayload = c.get('jwtPayload');
	const jwt = (c.req as any).cookie ? (c.req as any).cookie('jwt') : undefined;
	console.log('[ROUTE] JWT string:', jwt);
	if (!jwt) {
		return c.html(
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-destructive">Missing JWT</h1>
				<p className="text-sm text-destructive/70">Authentication token missing. Please refresh and try again.</p>
			</section>,
			401,
		);
	}
	const result = await pollService.deletePoll({ pollId, env: c.env, jwtPayload, jwt });
	if (!result.ok) {
		const msg = result.error === 'Unauthorized' ? 'Unauthorized' : 'Poll not found';
		return c.html(
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-destructive">{msg}</h1>
			</section>,
			result.error === 'Unauthorized' ? 403 : 404,
		);
	}
	return c.redirect('/', 303);
});

app.post('/api/poll/:pollId/vote', zValidator('json', VoteRequestBodySchema), async c => {
	const pollId = c.req.param('pollId');
	const { optionIndex } = c.req.valid('json');
	const jwt = (c.req as any).cookie ? (c.req as any).cookie('jwt') : undefined;
	console.log('[ROUTE] JWT string:', jwt);
	if (!jwt) {
		return c.json({ error: 'Missing JWT' }, 401);
	}
	const result = await pollService.votePoll({ pollId, optionIndex, env: c.env, jwt });
	if (!result.ok) return c.json({ error: result.error ?? 'Vote failed' }, 500);
	return c.json(result.updatedPoll);
});

// ---------------------------------------------------------------------------
// Dev helpers ----------------------------------------------------------------

// Only true when running under Miniflare (used by `wrangler dev`).
if (typeof (globalThis as any).MINIFLARE !== 'undefined') {
	showRoutes(app, { verbose: true });
}

// ---------------------------------------------------------------------------
export default app;
