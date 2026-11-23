import { z } from 'zod';

export const journalSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date.'),
  title: z.string().trim().min(1, 'Title is required.').max(120, 'Use 120 characters or fewer.'),
  content: z
    .string()
    .trim()
    .min(1, 'Description is required.')
    .max(5000, 'Use 5,000 characters or fewer.'),
  notes: z.string().trim().max(5000, 'Use 5,000 characters or fewer.'),
});

export type JournalFormValues = z.infer<typeof journalSchema>;
