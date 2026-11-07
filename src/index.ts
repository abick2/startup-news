import fs from "node:fs";
import path from "node:path";
import { findStories } from "./agent.js";
import { loadConfig, requireSetting, ROOT, type Config } from "./config.js";
import { todayIn } from "./dates.js";
import { filterStories, summaryAfterFiltering } from "./filter.js";
import { renderEmail, type RunInfo } from "./render.js";
import { DigestSchema, type Digest } from "./schema.js";
import { sendDigest, sendFailureNotice } from "./send.js";
import {
  alreadySent,
  readState,
  recentUrls,
  recordFailureNotified,
  recordSent,
  writeState,
} from "./state.js";

const STATE_FILE = path.join(ROOT, "state", "sent.json");
const OUT_DIR = path.join(ROOT, "out");

function loadFixture(): Digest {
  const file = path.join(ROOT, "fixtures", "digest.json");
  return DigestSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

async function produceDigest(
  config: Config,
  today: string,
  useFixture: boolean,
): Promise<{ digest: Digest; run: RunInfo }> {
  // The fixture's dates are fixed and its stories are samples, so it skips the
  // filters that would otherwise drop them.
  if (useFixture) return { digest: loadFixture(), run: { date: today } };

  requireSetting(config, "ANTHROPIC_API_KEY");
  const excludeUrls = recentUrls(readState(STATE_FILE), today);
  const { digest, costUsd } = await findStories(config, today, excludeUrls);
  const { kept, dropped } = filterStories(digest.stories, today, excludeUrls);
  console.log(`Kept ${kept.length} of ${digest.stories.length} stories`);
  for (const { title, reason } of dropped) console.log(`Dropped "${title}": ${reason}`);
  return {
    digest: {
      headline_summary: summaryAfterFiltering(digest.headline_summary, kept, dropped),
      stories: kept,
    },
    run: { date: today, model: config.MODEL, costUsd },
  };
}

async function run(config: Config, today: string, dryRun: boolean, useFixture: boolean): Promise<void> {
  if (!dryRun) {
    requireSetting(config, "RESEND_API_KEY", "EMAIL_TO");
    if (alreadySent(readState(STATE_FILE), today)) {
      console.log(`Digest for ${today} already sent; nothing to do`);
      return;
    }
  }

  const { digest, run: runInfo } = await produceDigest(config, today, useFixture);
  const email = renderEmail(digest, runInfo);

  if (dryRun) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "digest.html"), email.html);
    fs.writeFileSync(path.join(OUT_DIR, "digest.txt"), email.text);
    console.log(`Dry run, nothing sent. Subject: ${email.subject}`);
    console.log(`Wrote ${path.join(OUT_DIR, "digest.html")}`);
    return;
  }

  const { emailId, duplicate } = await sendDigest(config, email, today);
  console.log(duplicate ? `Digest for ${today} was already sent` : `Sent digest ${emailId}`);
  writeState(
    STATE_FILE,
    recordSent(readState(STATE_FILE), {
      date: today,
      urls: digest.stories.map((story) => story.url),
      emailId,
    }),
  );
}

async function notifyFailure(config: Config, today: string, error: unknown): Promise<void> {
  const state = readState(STATE_FILE);
  if (!config.RESEND_API_KEY || !config.EMAIL_TO || state.failureNotified.includes(today)) return;
  const message = error instanceof Error ? error.message : String(error);
  await sendFailureNotice(config, today, message);
  writeState(STATE_FILE, recordFailureNotified(state, today));
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const useFixture = args.has("--fixture");
  // A fixture send would mark today as done and block the real digest.
  if (useFixture && !dryRun) throw new Error("--fixture only works with --dry-run");

  const config = loadConfig();
  const today = todayIn(config.TIMEZONE);

  try {
    await run(config, today, dryRun, useFixture);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    if (!dryRun) {
      await notifyFailure(config, today, error).catch((notifyError: unknown) => {
        console.error("Couldn't send the failure email:", notifyError);
      });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
