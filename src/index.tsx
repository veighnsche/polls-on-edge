/**
 * Application routes (refactored for readability & DRY‑ness)
 * --------------------------------------------------------------
 * • Centralised helpers: getJwt(), htmlError()
 * • DRY validation middleware validatePollForm
 * • API routes share common error handling
 * • SHOW_ROUTES wrapped in Miniflare guard
 */

import { Hono, type Context, type Next } from 'hono';
import { showRoutes } from 'hono/dev';
import { jsxRenderer } from 'hono/jsx-renderer';

import { ConfirmDeletePage } from './components/ConfirmDeletePage';
import { CreatePage } from './components/CreatePage';
import { EditPage } from './components/EditPage';
import { LandingPage } from './components/LandingPage';
import { Layout } from './components/Layout';
import { PollPage } from './components/PollPage';
import { PollResultsPage } from './components/PollResultsPage';
import { anonJwtCookie } from './middleware/anonJwtCookie';
import * as pollService from './services/pollService';

import { PollData, PollFormSchema, type PollForm } from './types/PollData';

export { PollDurableObject } from './durable-objects/PollDurableObject';
export { UserDurableObject } from './durable-objects/UserDurableObject';

/* -------------------------------------------------------------------------- */
/*                             Hono context typings                           */
/* -------------------------------------------------------------------------- */

declare module 'hono' {
	interface ContextVariableMap {
		pollForm: PollForm;
	}
}

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type Bindings = {
	POLL_DO: DurableObjectNamespace;
	USER_DO: DurableObjectNamespace;
};

type AppContext = Context<{ Bindings: Bindings }>;

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */

const getJwt = (c: AppContext): string | undefined => (c.req as { cookie?: (name: string) => string | undefined }).cookie?.('jwt');

const htmlError = (
	c: AppContext,
	{
		title,
		message,
		status = 400,
		variant = 'destructive',
	}: { title: string; message?: string; status?: number; variant?: 'destructive' | 'muted' },
) =>
	c.html(
		<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
			<h1 className={`text-2xl font-bold mb-4 text-${variant}`}>{title}</h1>
			{message && <p className="text-sm text-destructive/70">{message}</p>}
		</section>,
		status,
	);

/* -------------------------------------------------------------------------- */
/*                                Initialisation                              */
/* -------------------------------------------------------------------------- */

const app = new Hono<{ Bindings: Bindings }>();

/* -------------------------------------------------------------------------- */
/*                               Global middleware                            */
/* -------------------------------------------------------------------------- */

app.use('*', anonJwtCookie);

app.get(
	'*',
	jsxRenderer(({ children }) => <Layout>{children}</Layout>),
);

/* -------------------------------------------------------------------------- */
/*                               Utility middleware                           */
/* -------------------------------------------------------------------------- */

/**
 * Extract & validate HTML form input for poll create / edit routes.
 * Adds the parsed data to `c.set('pollForm', data)`.
 */
const validatePollForm = async (c: AppContext, next: Next) => {
	const body = (await c.req.parseBody()) ?? {};
	const question = typeof body['question'] === 'string' ? body['question'].trim() : '';
	const options = [1, 2, 3, 4, 5]
		.map(i => {
			const v = body[`option${i}`];
			return typeof v === 'string' ? v.trim() : '';
		})
		.filter(Boolean);
	const ttl = typeof body['ttl'] === 'string' ? body['ttl'].trim() : '86400';

	const parsed = PollFormSchema.safeParse({ question, options, ttl });

	if (!parsed.success) {
		return htmlError(c, {
			title: 'Invalid poll data',
			message: JSON.stringify(parsed.error.issues, null, 2),
			status: 400,
		});
	}

	c.set('pollForm', parsed.data);
	await next();
};

/* -------------------------------------------------------------------------- */
/*                                  Pages                                     */
/* -------------------------------------------------------------------------- */

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

app.get('/poll/:pollId/results', async c => {
	const pollId = c.req.param('pollId');

	try {
		const stub = c.env.POLL_DO.get(c.env.POLL_DO.idFromName(pollId));
		const res = await stub.fetch('https://dummy/state');
		if (!res.ok) throw new Error('Poll not found');
		const poll = await res.json();
		return c.render(<PollResultsPage poll={poll as PollData} />);
	} catch (err: any) {
		return htmlError(c, { title: 'Error', message: err.message ?? 'Poll not found', status: 404 });
	}
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

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const requireJwt = (c: AppContext): string | Response | undefined => {
	const jwt = getJwt(c);
	if (!jwt) {
		return htmlError(c, {
			title: 'Missing JWT',
			message: 'Authentication token missing. Please refresh and try again.',
			status: 401,
		});
	}
	return jwt;
};

const handleServiceResult = (c: AppContext, result: { ok: boolean; error?: string }) => {
	if (result.ok) return null;

	const message = result.error === 'Unauthorized' ? 'Unauthorized' : 'Poll not found';
	const status = result.error === 'Unauthorized' ? 403 : 404;

	return htmlError(c, { title: message, status });
};

/* -------------------------------------------------------------------------- */
/*                                  API routes                                */
/* -------------------------------------------------------------------------- */

app.post('/api/poll/create', validatePollForm, async c => {
	const jwt = requireJwt(c);
	if (typeof jwt !== 'string') return jwt; // early error response

	const { question, options, ttl } = c.get('pollForm');
	const jwtPayload = c.get('jwtPayload');

	const result = await pollService.createPoll({ question, options, ttl, env: c.env, jwtPayload, jwt });
	if (!result.ok) {
		return htmlError(c, { title: "Poll creation failed", message: result.error, status: 400 });
	}
	return c.redirect(`/poll/${result.data.id}`, 303);
});

app.post('/api/poll/:pollId/edit', validatePollForm, async c => {
	const jwt = requireJwt(c);
	if (typeof jwt !== 'string') return jwt;

	const { question, options, ttl } = c.get('pollForm');
	const pollId = c.req.param('pollId');
	const jwtPayload = c.get('jwtPayload');

	const result = await pollService.editPoll({ pollId, question, options, ttl, env: c.env, jwtPayload, jwt });
	const err = handleServiceResult(c, result);
	if (err) return err;

	return c.redirect(`/poll/${pollId}`, 303);
});

app.post('/api/poll/:pollId/delete', async c => {
	const jwt = requireJwt(c);
	if (typeof jwt !== 'string') return jwt;

	const pollId = c.req.param('pollId');
	const jwtPayload = c.get('jwtPayload');

	const result = await pollService.deletePoll({ pollId, env: c.env, jwtPayload, jwt });
	const err = handleServiceResult(c, result);
	if (err) return err;

	return c.redirect('/', 303);
});

/* -------------------------------------------------------------------------- */
/*                           Voting (no JWT required)                         */
/* -------------------------------------------------------------------------- */

app.post('/poll/:pollId/vote', async c => {
	const pollId = c.req.param('pollId');

	const form: FormData | Record<string, unknown> =
		typeof c.req.formData === 'function' ? await c.req.formData() : typeof c.req.parseBody === 'function' ? await c.req.parseBody() : {};

	const rawOptionIndex =
		typeof (form as FormData).get === 'function' ? (form as FormData).get('optionIndex') : (form as Record<string, unknown>).optionIndex;

	const optionIndex = Number(rawOptionIndex);
	if (!Number.isInteger(optionIndex)) return c.text('Invalid option index', 400);

	await pollService.votePoll({ pollId, optionIndex, env: c.env, jwt: getJwt(c) });

	return c.redirect(`/poll/${pollId}`, 303);
});

/* -------------------------------------------------------------------------- */
/*                                 Dev helpers                                */
/* -------------------------------------------------------------------------- */

if (typeof (globalThis as any).MINIFLARE !== 'undefined') {
	showRoutes(app, { verbose: true });
}

/* -------------------------------------------------------------------------- */
export default app;
