import type { FC } from 'hono/jsx';
import { PollsList } from './PollsList';

interface LandingPageProps {
	env: { POLL_INDEX: KVNamespace; POLL_DO: DurableObjectNamespace };
	jwtPayload: any;
}

export const LandingPage: FC<LandingPageProps> = ({ env, jwtPayload }) => {
	return (
		<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card">
			<h1 className="text-3xl sm:text-4xl font-bold mb-4 text-primary text-center">Welcome to Polls on Edge</h1>
			<p className="text-lg text-muted mb-8 text-center max-w-lg">
				Create, share, and participate in polls instantly. Polls on Edge leverages edge rendering for real-time, scalable, and
				lightning-fast polling experiences.
			</p>
			<a
				href="/create"
				className="inline-block px-8 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-lg shadow-lg hover:bg-primary/90 transition mb-8"
			>
				Create Your Poll
			</a>
			{/* Polls List Component */}
			<PollsList env={env} jwtPayload={jwtPayload} />
		</section>
	);
};
