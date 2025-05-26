import { PollDataWithUserVote } from '../types/PollData';

interface PollUserPageProps {
	poll: PollDataWithUserVote;
}

export const PollUserPage = ({ poll }: PollUserPageProps) => {
	const hasVoted = poll.userVote !== null && poll.userVote !== undefined;
	return (
		<section className="rounded-xl shadow p-10 flex flex-col items-center bg-card max-w-lg mx-auto mt-10">
			<h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary text-center">{poll.question}</h1>
			<form className="w-full flex flex-col gap-4" method="post" action={`/poll/${poll.id}/vote`}>
				{hasVoted ? (
					<>
						{poll.options.map((option, i) => (
							<div
								key={i}
								className={
									`w-full px-4 py-3 rounded-xl border text-lg font-medium ` +
									(i === poll.userVote
										? 'border-primary bg-primary/10 text-primary font-semibold'
										: 'border-muted bg-background text-foreground opacity-60')
								}
							>
								{option}
								{i === poll.userVote && (
									<span className="ml-2 text-xs rounded px-2 py-0.5 bg-primary text-primary-foreground align-middle">Your vote</span>
								)}
							</div>
						))}
						<div className="mt-6">
							<a
								href={`/poll/${poll.id}/results`}
								className="inline-block px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/80 transition font-medium shadow"
							>
								View Results
							</a>
						</div>
					</>
				) : (
					poll.options.map((option, i) => (
						<button
							key={i}
							type="submit"
							name="optionIndex"
							value={i}
							className="w-full px-4 py-3 rounded-xl border border-muted bg-background hover:bg-primary/10 transition text-lg font-medium"
							disabled={hasVoted}
						>
							{option}
						</button>
					))
				)}
			</form>
			<p className="text-sm text-muted mt-6">Poll ID: {poll.id}</p>
		</section>
	);
};
