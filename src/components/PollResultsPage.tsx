import { PollDataWithUserVote } from '../types/PollData';

interface PollResultsPageProps {
	poll: PollDataWithUserVote;
}

export const PollResultsPage = ({ poll }: PollResultsPageProps) => {
	const totalVotes = poll.votes.reduce((a, b) => a + b, 0);
	return (
		<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
			<h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary text-center">{poll.question}</h1>
			<div className="w-full flex flex-col gap-4">
				{poll.options.map((option, i) => {
					const count = poll.votes[i];
					const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
					return (
						<div key={i} className="w-full">
							<div className="flex justify-between mb-1">
								<span className="font-medium text-lg">{option}</span>
								<span className="text-sm text-muted">
									{count} vote{count !== 1 ? 's' : ''} ({percent}%)
								</span>
							</div>
							<div className="w-full bg-muted rounded-full h-3">
								<div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${percent}%` }}></div>
							</div>
						</div>
					);
				})}
			</div>
			<p className="text-sm text-muted mt-6">Poll ID: {poll.id}</p>
			<a href={`/poll/${poll.id}`} className="mt-8 text-primary underline">
				Back to poll
			</a>
		</section>
	);
};
