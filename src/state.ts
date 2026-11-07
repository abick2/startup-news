import fs from "node:fs";
import path from "node:path";
import { daysBetween } from "./dates.js";

const DEDUPE_DAYS = 14;
const RETAIN_DAYS = 30;

export interface SentRecord {
  date: string;
  urls: string[];
  emailId: string | null;
}

export interface State {
  sent: SentRecord[];
  // Dates a failure email already went out for, so retries don't send another.
  failureNotified: string[];
}

export function readState(file: string): State {
  if (!fs.existsSync(file)) return { sent: [], failureNotified: [] };
  return JSON.parse(fs.readFileSync(file, "utf8")) as State;
}

// Written through a rename so a crash can't leave a half-written file.
export function writeState(file: string, state: State): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temp, file);
}

export function alreadySent(state: State, date: string): boolean {
  return state.sent.some((record) => record.date === date);
}

export function recentUrls(state: State, today: string): string[] {
  return state.sent
    .filter((record) => daysBetween(record.date, today) <= DEDUPE_DAYS)
    .flatMap((record) => record.urls);
}

export function recordSent(state: State, record: SentRecord): State {
  return {
    sent: [...state.sent, record].filter(
      (entry) => daysBetween(entry.date, record.date) <= RETAIN_DAYS,
    ),
    failureNotified: state.failureNotified.filter(
      (date) => daysBetween(date, record.date) <= RETAIN_DAYS,
    ),
  };
}

export function recordFailureNotified(state: State, date: string): State {
  return { ...state, failureNotified: [...state.failureNotified, date] };
}
