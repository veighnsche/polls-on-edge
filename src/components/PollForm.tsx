import type { FC } from 'hono/jsx';

interface PollFormProps {
	initialQuestion?: string;
	initialOptions?: string[];
	initialTTL?: string;
	onSubmitAction?: string;
	submitLabel?: string;
}

/**
 * PollForm - Reusable form for creating or editing a poll.
 * Props allow pre-filling values and customizing submit action/label.
 */
export const PollForm: FC<PollFormProps> = ({
	initialQuestion = '',
	initialOptions = ['', '', '', '', ''],
	initialTTL = '86400',
	onSubmitAction = '/api/poll/create',
	submitLabel = 'Create Poll',
}) => {
	console.log('[PollForm] Rendered with props:', { initialQuestion, initialOptions, initialTTL, onSubmitAction, submitLabel });
	return (
		<form
			method="post"
			action={onSubmitAction}
			className="w-full max-w-lg flex flex-col gap-6"
			onSubmit={e => {
				console.log('[PollForm] Form submitted');
				const form = e.target as HTMLFormElement;
				const data = new FormData();
				data.append('question', form.question.value);
				data.append('option1', form.option1.value);
				data.append('option2', form.option2.value);
				data.append('option3', form.option3.value);
				data.append('option4', form.option4.value);
				data.append('option5', form.option5.value);
				data.append('ttl', form.ttl.value);
				const formDataObj = Object.fromEntries(data.entries());
				console.log('[PollForm] Form data:', formDataObj);
			}}
		>
			{/* Poll Question */}
			<div>
				<label htmlFor="question" className="block text-lg font-medium mb-2 text-foreground">
					Poll Question
				</label>
				<input
					type="text"
					id="question"
					name="question"
					required
					minLength={5}
					className="w-full px-4 py-2 rounded border border-muted focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="What do you want to ask?"
					value={initialQuestion}
				/>
			</div>
			{/* Poll Options (at least 2 required, allow up to 5) */}
			<div>
				<label className="block text-lg font-medium mb-2 text-foreground">Options</label>
				{[0, 1, 2, 3, 4].map(i => (
					<div key={i} className="mb-2">
						<input
							type="text"
							name={`option${i + 1}`}
							required={i < 2}
							minLength={1}
							maxLength={100}
							className="w-full px-4 py-2 rounded border border-muted focus:outline-none focus:ring-2 focus:ring-primary"
							placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ''}`}
							value={initialOptions[i] || ''}
						/>
					</div>
				))}
				<p className="text-sm text-muted mt-1">At least 2 options required. Leave others blank if not needed.</p>
			</div>
			{/* TTL (Time To Live) Radio Buttons */}
			<div>
				<label className="block text-lg font-medium mb-2 text-foreground">Poll Duration</label>
				<div className="flex flex-wrap gap-4">
					<label className="inline-flex items-center gap-2">
						<input type="radio" name="ttl" value="3600" className="accent-primary" checked={initialTTL === '3600'} />
						<span>1 hour</span>
					</label>
					<label className="inline-flex items-center gap-2">
						<input type="radio" name="ttl" value="86400" className="accent-primary" checked={initialTTL === '86400'} />
						<span>1 day</span>
					</label>
					<label className="inline-flex items-center gap-2">
						<input type="radio" name="ttl" value="604800" className="accent-primary" checked={initialTTL === '604800'} />
						<span>1 week</span>
					</label>
					<label className="inline-flex items-center gap-2">
						<input type="radio" name="ttl" value="2592000" className="accent-primary" checked={initialTTL === '2592000'} />
						<span>1 month</span>
					</label>
				</div>
				<p className="text-sm text-muted mt-1">How long should this poll remain open?</p>
			</div>
			{/* Submit Button */}
			<button
				type="submit"
				className="mt-4 px-8 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-lg shadow-lg hover:bg-primary/90 transition"
			>
				{submitLabel}
			</button>
		</form>
	);
};
