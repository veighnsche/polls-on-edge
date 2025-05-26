import type { FC } from 'hono/jsx';
import { PollsList } from './PollsList';

interface LandingPageProps {
	env: { USER_DO: DurableObjectNamespace; POLL_DO: DurableObjectNamespace };
	jwtPayload: any;
}

export const LandingPage: FC<LandingPageProps> = ({ env, jwtPayload }) => {
	return (
		<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card">
			<h1 className="text-3xl sm:text-4xl font-bold mb-4 text-primary text-center">Welcome to Polls on Edge</h1>
			<p className="text-lg text-muted mb-8 text-center max-w-lg">
				<strong>Polls on Edge</strong> lets you create, share, and participate in polls instantly—no sign-up required. Enjoy real-time
				results, instant voting, and seamless sharing, all powered by edge rendering for lightning-fast performance and global scalability.
				<br />
				<br />
				Whether you’re gathering quick feedback, making group decisions, running live events, or just having fun, our platform ensures your
				polls are always available and up-to-date. Create a poll in seconds, share the link anywhere, and watch the results update in real
				time. Perfect for teams, communities, classrooms, and social media.
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
