import type { FC } from "hono/jsx";

/**
 * CreatePage - Poll creation form
 * Allows users to enter a poll question and multiple options (at least 2 required).
 * Modern, accessible, and styled with Tailwind CSS.
 */
export const CreatePage: FC = () => (
  <section className="rounded-xl shadow p-10 flex flex-col items-center bg-card">
    <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary text-center">
      Create a New Poll
    </h1>
    <form method="post" action="/api/poll/create" className="w-full max-w-lg flex flex-col gap-6">
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
        />
      </div>
      {/* Poll Options (at least 2 required, allow up to 5) */}
      <div>
        <label className="block text-lg font-medium mb-2 text-foreground">Options</label>
        {/* Option fields - JS enhancement would allow add/remove, but for SSR, show 5 fields */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="mb-2">
            <input
              type="text"
              name={`option${i + 1}`}
              required={i < 2} // First two options required
              minLength={1}
              maxLength={100}
              className="w-full px-4 py-2 rounded border border-muted focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ''}`}
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
            <input type="radio" name="ttl" value="3600" className="accent-primary" />
            <span>1 hour</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="ttl" value="86400" className="accent-primary" checked />
            <span>1 day</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="ttl" value="604800" className="accent-primary" />
            <span>1 week</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="ttl" value="2592000" className="accent-primary" />
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
        Create Poll
      </button>
    </form>
  </section>
);
