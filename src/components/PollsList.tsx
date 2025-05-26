import { PollData } from '../types/PollData';

interface PollsListProps {
	env: { USER_DO: DurableObjectNamespace; POLL_DO: DurableObjectNamespace };
	jwtPayload: any;
}

export const PollsList = async ({ env, jwtPayload }: PollsListProps) => {
	const ownerId = jwtPayload && typeof jwtPayload.sub === 'string' ? jwtPayload.sub : 'unknown';
	console.log('[PollsList] ownerId:', ownerId);
	const userDurableId = env.USER_DO.idFromName(ownerId);
	const userStub = env.USER_DO.get(userDurableId);
	const userRes = await userStub.fetch('https://dummy/state');
	console.log('[PollsList] userRes:', userRes);
	let pollIds: string[] = [];
	if (userRes.ok) {
		const userData: { ownedPollIds: string[] } = await userRes.json();
		console.log('[PollsList] userData:', userData);
		pollIds = Array.isArray(userData.ownedPollIds) ? userData.ownedPollIds : [];
	}
	console.log('[PollsList] pollIds:', pollIds);
	const polls: PollData[] = [];
	if (Array.isArray(pollIds) && pollIds.length > 0) {
		for (const pollId of pollIds) {
			console.log('[PollsList] Fetching pollId:', pollId);
			const durableId = env.POLL_DO.idFromName(pollId);
			const stub = env.POLL_DO.get(durableId);
			const res = await stub.fetch('https://dummy/state');
			console.log('[PollsList] Poll fetch res for', pollId, ':', res);
			if (res.ok) {
				const poll: PollData = await res.json();
				console.log('[PollsList] Poll data for', pollId, ':', poll);
				if (poll && poll.ownerId === ownerId) polls.push(poll);
			}
		}
	}
	console.log('[PollsList] Final polls:', polls);
	return (
		<div className="w-full mt-8">
			<h2 className="text-xl font-bold mb-4 text-foreground">Your Polls</h2>
			{polls.length > 0 ? (
				<ul className="w-full flex flex-col gap-3">
					{polls.map(poll => (
						<li
							key={poll.id}
							className="border border-muted/80 rounded-xl shadow p-0 flex justify-between items-center hover:bg-muted transition"
						>
							<a
								href={`/poll/${poll.id}`}
								className="flex-1 block p-4 font-semibold text-foreground no-underline hover:underline rounded-l transition"
							>
								{poll.question}
							</a>
							<a
								href={`/poll/${poll.id}/delete`}
								className="mr-2 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/80 transition text-center"
								style={{ minWidth: '80px' }}
							>
								Delete
							</a>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted">You don't own any polls yet. Create one above!</p>
			)}
		</div>
	);
};
