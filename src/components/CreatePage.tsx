import type { FC } from "hono/jsx";
import { PollForm } from "./PollForm"; // Reusable poll form

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
    <PollForm
      submitLabel="Create Poll"
      onSubmitAction="/api/poll/create"
    />
  </section>
);
