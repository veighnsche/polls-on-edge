import { PollData } from '../types/PollData';
import { PollForm } from './PollForm';

interface EditPageProps {
	pollId: string;
	env: { POLL_DO: DurableObjectNamespace };
	jwtPayload: any;
}

/**
 * EditPage - Async poll editing page
 * Loads poll, checks ownership, and renders PollForm if allowed, else error.
 */
export const EditPage = async ({ pollId, env, jwtPayload }: EditPageProps) => {
	console.log('[EditPage] props:', { pollId, env, jwtPayload });
	const durableId = env.POLL_DO.idFromName(pollId);
	const stub = env.POLL_DO.get(durableId);
	console.log('[EditPage] Fetching poll state for id:', pollId);
	const res = await stub.fetch('https://dummy/state');
	console.log('[EditPage] Fetch response:', res);
	if (!res.ok) {
		return (
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-red-600">Poll not found</h1>
			</section>
		);
	}
	const poll: PollData = await res.json();
	console.log('[EditPage] Loaded poll:', poll);
	if (!poll || poll.ownerId !== (jwtPayload && jwtPayload.sub)) {
		return (
			<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
				<h1 className="text-2xl font-bold mb-4 text-red-600">Unauthorized</h1>
			</section>
		);
	}
	return (
		<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card">
			<h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary text-center">Edit Poll</h1>
			<PollForm
				initialQuestion={poll.question}
				initialOptions={poll.options}
				initialTTL={String(poll.ttl)}
				onSubmitAction={`/api/poll/${pollId}/edit`}
				submitLabel="Save Changes"
			/>
		</section>
	);
};
