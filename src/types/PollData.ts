import { z } from 'zod';

export const PollDataSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  ttl: z.number(),
  createdAt: z.number(),
  ownerId: z.string(),
  votes: z.array(z.number()),
});
export type PollData = z.infer<typeof PollDataSchema>;

export const VoteRequestBodySchema = z.object({
  optionIndex: z.number(),
});
export type VoteRequestBody = z.infer<typeof VoteRequestBodySchema>;

// For poll creation/editing via forms (question, options, ttl)
export const PollFormSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  ttl: z.preprocess((val) => Number(val), z.number().int().min(1)),
});
export type PollForm = z.infer<typeof PollFormSchema>;