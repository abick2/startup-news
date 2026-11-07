import { z } from "zod";

export const StorySchema = z.object({
  title: z.string(),
  source: z.string().describe("Publication name"),
  url: z.string().describe("Article URL, exactly as returned by the search"),
  published_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Date the article was published, as YYYY-MM-DD"),
  summary: z.string().describe("Two sentences on what happened"),
  why_it_matters: z.string().describe("One sentence on why it matters"),
  category: z.string().describe("One or two words, such as Funding, M&A, or Product"),
});

export const DigestSchema = z.object({
  headline_summary: z.string().describe("One sentence summing up today's news"),
  stories: z.array(StorySchema).describe("Most important first; the first is the lead"),
});

export type Story = z.infer<typeof StorySchema>;
export type Digest = z.infer<typeof DigestSchema>;

export const digestJsonSchema = z.toJSONSchema(DigestSchema, { target: "draft-7" });
