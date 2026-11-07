import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildPrompt } from "../src/agent.js";
import { todayIn } from "../src/dates.js";
import { filterStories, normalizeUrl, summaryAfterFiltering } from "../src/filter.js";
import { escapeHtml, renderEmail } from "../src/render.js";
import type { Story } from "../src/schema.js";
import {
  alreadySent,
  readState,
  recentUrls,
  recordFailureNotified,
  recordSent,
  writeState,
} from "../src/state.js";

const TODAY = "2026-11-05";

function story(overrides: Partial<Story> = {}): Story {
  return {
    title: "A title",
    source: "A source",
    url: "https://example.com/a",
    published_date: TODAY,
    summary: "A summary",
    why_it_matters: "A reason",
    category: "Funding",
    ...overrides,
  };
}

test("normalizeUrl rejects non-web links", () => {
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("data:text/html,hi"), null);
  assert.equal(normalizeUrl("not a url"), null);
});

test("normalizeUrl strips tracking and fragments but keeps other params", () => {
  assert.equal(
    normalizeUrl("https://example.com/a?id=7&utm_source=x&UTM_Medium=y#top"),
    "https://example.com/a?id=7",
  );
});

test("filterStories applies the date window", () => {
  const { kept } = filterStories(
    [
      story({ url: "https://example.com/today" }),
      story({ url: "https://example.com/edge", published_date: "2026-11-02" }),
      story({ url: "https://example.com/old", published_date: "2026-11-01" }),
      story({ url: "https://example.com/tomorrow", published_date: "2026-11-06" }),
      story({ url: "https://example.com/future", published_date: "2026-11-07" }),
      story({ url: "https://example.com/invalid", published_date: "2026-13-45" }),
    ],
    TODAY,
    [],
  );
  assert.deepEqual(
    kept.map((item) => item.url),
    ["https://example.com/today", "https://example.com/edge", "https://example.com/tomorrow"],
  );
});

test("filterStories reports why each story was dropped", () => {
  const { dropped } = filterStories(
    [
      story({ title: "Old", url: "https://example.com/old", published_date: "2026-11-01" }),
      story({ title: "Bad link", url: "javascript:alert(1)" }),
      story({ title: "Sent", url: "https://example.com/sent" }),
    ],
    TODAY,
    ["https://example.com/sent"],
  );
  assert.deepEqual(dropped, [
    { title: "Old", reason: "outside the date window: 2026-11-01" },
    { title: "Bad link", reason: "unusable link: javascript:alert(1)" },
    { title: "Sent", reason: "already sent or repeated" },
  ]);
});

test("summaryAfterFiltering only trusts the agent's summary when nothing was dropped", () => {
  const dropped = [{ title: "Gone", reason: "old" }];
  assert.equal(summaryAfterFiltering("Agent summary", [story()], []), "Agent summary");
  assert.equal(summaryAfterFiltering("Agent summary", [story()], dropped), "1 story made the cut today.");
  assert.equal(
    summaryAfterFiltering("Agent summary", [story(), story()], dropped),
    "2 stories made the cut today.",
  );
});

test("filterStories drops bad links, recent URLs, and repeats within a digest", () => {
  const { kept } = filterStories(
    [
      story({ url: "javascript:alert(1)" }),
      story({ url: "https://example.com/sent?utm_source=x" }),
      story({ url: "https://example.com/new" }),
      story({ url: "https://example.com/new#again" }),
    ],
    TODAY,
    ["https://example.com/sent"],
  );
  assert.deepEqual(
    kept.map((item) => item.url),
    ["https://example.com/new"],
  );
});

test("escapeHtml covers every markup character", () => {
  assert.equal(escapeHtml(`<a href="x" id='y'>&`), "&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;");
});

test("renderEmail escapes agent text in the body and in links", () => {
  const { html } = renderEmail(
    {
      headline_summary: "<script>alert(1)</script>",
      stories: [
        story({ title: "<img src=x onerror=alert(1)>" }),
        story({ url: `https://example.com/"onmouseover="alert(1)`, summary: "<b>bold</b>" }),
      ],
    },
    { date: TODAY },
  );
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<b>bold"));
  assert.ok(!html.includes(`"onmouseover="`));
});

test("renderEmail removes line breaks from the subject", () => {
  const { subject } = renderEmail(
    { headline_summary: "s", stories: [story({ title: "Line one\r\nBcc: someone@example.com" })] },
    { date: TODAY },
  );
  assert.ok(!/[\r\n]/.test(subject));
});

test("renderEmail produces a quiet edition with no stories", () => {
  const { subject, html, text } = renderEmail({ headline_summary: "", stories: [] }, { date: TODAY });
  assert.match(subject, /quiet day/);
  assert.match(html, /Nothing new met the bar/);
  assert.match(text, /quiet day/);
});

test("renderEmail text version includes each story's link", () => {
  const { text } = renderEmail(
    { headline_summary: "s", stories: [story({ url: "https://example.com/plain" })] },
    { date: TODAY },
  );
  assert.match(text, /https:\/\/example\.com\/plain/);
});

test("todayIn uses the configured time zone, not UTC", () => {
  // 02:00 UTC on Nov 6 is still the evening of Nov 5 in New York.
  const now = new Date("2026-11-06T02:00:00Z");
  assert.equal(todayIn("America/New_York", now), "2026-11-05");
});

test("once-a-day guard and URL history survive a save and reload", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "startup-news-"));
  const file = path.join(dir, "nested", "sent.json");
  try {
    const empty = readState(file);
    assert.equal(alreadySent(empty, TODAY), false);

    writeState(file, recordSent(empty, { date: TODAY, urls: ["https://example.com/a"], emailId: "id" }));

    const loaded = readState(file);
    assert.equal(alreadySent(loaded, TODAY), true);
    assert.equal(alreadySent(loaded, "2026-11-06"), false);
    assert.deepEqual(recentUrls(loaded, "2026-11-06"), ["https://example.com/a"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("recentUrls only looks back 14 days and old records get pruned", () => {
  let state = recordSent(
    { sent: [], failureNotified: [] },
    { date: "2026-10-01", urls: ["https://example.com/old"], emailId: null },
  );
  state = recordFailureNotified(state, "2026-10-01");
  state = recordSent(state, { date: "2026-10-22", urls: ["https://example.com/mid"], emailId: null });
  assert.deepEqual(recentUrls(state, TODAY), ["https://example.com/mid"]);

  state = recordSent(state, { date: TODAY, urls: [], emailId: null });
  assert.deepEqual(
    state.sent.map((record) => record.date),
    ["2026-10-22", TODAY],
  );
  assert.deepEqual(state.failureNotified, []);
});

test("buildPrompt includes the date, relevance text, and exclusions", () => {
  const prompt = buildPrompt(TODAY, ["https://example.com/sent"], "Relevant means X.\n");
  assert.match(prompt, /Today is 2026-11-05/);
  assert.match(prompt, /cutoff date is 2026-11-02/);
  assert.match(prompt, /Relevant means X\./);
  assert.match(prompt, /https:\/\/example\.com\/sent/);
  assert.doesNotMatch(buildPrompt(TODAY, [], "X"), /already sent/);
});
