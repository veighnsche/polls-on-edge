import { PollDataWithUserVote } from '../types/PollData';
import { PollAdminPage } from './PollAdminPage';
import { PollUserPage } from './PollUserPage';

interface PollPageProps {
	pollId: string;
	env: { POLL_DO: DurableObjectNamespace; USER_DO: DurableObjectNamespace };
	jwtPayload: any;
}

export const PollPage = async ({ pollId, env, jwtPayload }: PollPageProps) => {
	let poll: PollDataWithUserVote | null = null;
	let error: string | null = null;
	try {
		const durableId = env.POLL_DO.idFromString(pollId);
		const stub = env.POLL_DO.get(durableId);
		const res = await stub.fetch('https://dummy/state');
		if (!res.ok) throw new Error('Poll not found');
		poll = await res.json();
	} catch (err: any) {
		error = err.message || 'Error fetching poll';
	}

	if (error) {
		return (
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
				<p className="text-lg text-muted">{error}</p>
			</section>
		);
	}
	if (!poll) {
		return (
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4">Poll not found</h1>
			</section>
		);
	}
	if (jwtPayload?.sub) {
		try {
			const userStub = env.USER_DO.get(env.USER_DO.idFromName(jwtPayload.sub));
			const url = new URL('https://dummy/has-voted');
			url.searchParams.set('pollId', poll.id);
			const uv = await userStub.fetch(url.toString(), { cf: { cacheTtl: 0 } });
			const { userVote }: { userVote: number } = await uv.json();
			poll.userVote = userVote;
		} catch {
			// ignore errors for user vote enrichment
		}
	}
	const isOwner = jwtPayload && jwtPayload.sub === poll.ownerId;
	return isOwner ? <PollAdminPage poll={poll} /> : <PollUserPage poll={poll} />;
};
