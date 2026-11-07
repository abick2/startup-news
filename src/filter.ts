import { daysBetween } from "./dates.js";
import type { Story } from "./schema.js";

export const MAX_AGE_DAYS = 3;
// A story dated tomorrow can be legitimate across time zones; further out isn't.
const MAX_FUTURE_DAYS = 1;

// Returns a canonical URL so the same article matches across days, or null if
// the URL isn't a usable web link.
export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  }
  return url.href;
}

export interface DroppedStory {
  title: string;
  reason: string;
}

export function filterStories(
  stories: Story[],
  today: string,
  recentUrls: Iterable<string>,
): { kept: Story[]; dropped: DroppedStory[] } {
  const seen = new Set(recentUrls);
  const kept: Story[] = [];
  const dropped: DroppedStory[] = [];
  for (const story of stories) {
    const url = normalizeUrl(story.url);
    const age = daysBetween(story.published_date, today);
    if (!url) {
      dropped.push({ title: story.title, reason: `unusable link: ${story.url}` });
      continue;
    }
    if (seen.has(url)) {
      dropped.push({ title: story.title, reason: "already sent or repeated" });
      continue;
    }
    if (!(age <= MAX_AGE_DAYS && age >= -MAX_FUTURE_DAYS)) {
      dropped.push({ title: story.title, reason: `outside the date window: ${story.published_date}` });
      continue;
    }
    seen.add(url);
    kept.push({ ...story, url });
  }
  return { kept, dropped };
}

// The agent's summary can mention stories the filters removed, so it's only
// trustworthy when every story survived.
export function summaryAfterFiltering(
  summary: string,
  kept: Story[],
  dropped: DroppedStory[],
): string {
  if (dropped.length === 0) return summary;
  return `${kept.length} ${kept.length === 1 ? "story" : "stories"} made the cut today.`;
}
