import { formatLong, formatShort } from "./dates.js";
import type { Digest, Story } from "./schema.js";

const NAME = "The Startup Brief";

const FONT = "Inter, Helvetica, Arial, sans-serif";
const PAPER = "#F5F4EE";
const WHITE = "#FFFFFF";
const INK = "#222427";
const MUTED = "#5F6266";
const MUTED_ON_INK = "#C4C5BF";
const CARD_RADIUS = "16px";
const BUTTON_RADIUS = "8px";
const CARD_GAP = 12;

const SPACER = `<tr><td height="${CARD_GAP}" style="height:${CARD_GAP}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

export interface RunInfo {
  date: string;
  model?: string;
  costUsd?: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function label(text: string, color: string): string {
  return `<div style="font-family:${FONT};font-size:12px;line-height:1.4;letter-spacing:0.12em;text-transform:uppercase;color:${color};">${escapeHtml(text)}</div>`;
}

function storyMeta(story: Story): string {
  return `${story.category} · ${story.source} · ${formatShort(story.published_date)}`;
}

function leadSection(story: Story): string {
  return `<tr>
  <td class="pad" style="background-color:${INK};border-radius:${CARD_RADIUS};padding:40px;">
    ${label(storyMeta(story), MUTED_ON_INK)}
    <h2 class="lead-title" style="margin:16px 0 0;font-family:${FONT};font-size:32px;line-height:1.15;font-weight:400;color:${WHITE};"><a href="${escapeHtml(story.url)}" style="color:${WHITE};text-decoration:none;">${escapeHtml(story.title)}</a></h2>
    <p style="margin:20px 0 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${WHITE};">${escapeHtml(story.summary)}</p>
    <p style="margin:16px 0 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${MUTED_ON_INK};">${escapeHtml(story.why_it_matters)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr>
      <td style="background-color:${WHITE};border-radius:${BUTTON_RADIUS};"><a href="${escapeHtml(story.url)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:12px;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${INK};text-decoration:none;">Read the story</a></td>
    </tr></table>
  </td>
</tr>`;
}

function storySection(story: Story): string {
  return `<tr>
  <td class="pad" style="background-color:${WHITE};border-radius:${CARD_RADIUS};padding:32px 40px;">
    ${label(storyMeta(story), MUTED)}
    <h3 style="margin:12px 0 0;font-family:${FONT};font-size:22px;line-height:1.25;font-weight:400;color:${INK};"><a href="${escapeHtml(story.url)}" style="color:${INK};text-decoration:none;">${escapeHtml(story.title)}</a></h3>
    <p style="margin:12px 0 0;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK};">${escapeHtml(story.summary)}</p>
    <p style="margin:10px 0 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${MUTED};">${escapeHtml(story.why_it_matters)}</p>
    <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.4;letter-spacing:0.12em;text-transform:uppercase;"><a href="${escapeHtml(story.url)}" style="color:${INK};text-decoration:underline;">Read more</a></p>
  </td>
</tr>`;
}

function quietSection(): string {
  return `<tr>
  <td class="pad" style="background-color:${WHITE};border-radius:${CARD_RADIUS};padding:40px;">
    <p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.55;color:${INK};">Nothing new met the bar today, so there are no stories in this edition. Back tomorrow.</p>
  </td>
</tr>`;
}

function runDetails(run: RunInfo): string {
  const parts: string[] = [];
  if (run.model) parts.push(run.model);
  if (run.costUsd !== undefined) parts.push(`$${run.costUsd.toFixed(2)} this run`);
  return parts.join(" · ");
}

export function renderEmail(digest: Digest, run: RunInfo): RenderedEmail {
  const [lead, ...rest] = digest.stories;
  const summary = lead ? digest.headline_summary : "A quiet day: nothing new met the bar.";
  const longDate = formatLong(run.date);
  const details = runDetails(run);

  // Header fields can't contain line breaks.
  const subject = `${NAME}: ${lead ? lead.title : "a quiet day"}`.replace(/\s+/g, " ").trim();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(NAME)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 0; }
  a { color: inherit; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .gutter { padding-left: 12px !important; padding-right: 12px !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .masthead { font-size: 32px !important; }
    .lead-title { font-size: 26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${escapeHtml(summary)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};">
<tr><td align="center" class="gutter">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr>
  <td class="pad" style="padding:40px 40px 32px;">
    ${label(longDate, MUTED)}
    <h1 class="masthead" style="margin:16px 0 0;font-family:${FONT};font-size:40px;line-height:1.1;font-weight:400;color:${INK};">${escapeHtml(NAME)}</h1>
    <p style="margin:16px 0 0;font-family:${FONT};font-size:18px;line-height:1.45;color:${INK};">${escapeHtml(summary)}</p>
  </td>
</tr>
${lead ? leadSection(lead) : quietSection()}
${rest.map((story) => `${SPACER}\n${storySection(story)}`).join("\n")}
<tr>
  <td class="pad" style="padding:32px 40px 48px;">
    <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">Researched and summarized by an AI agent, so check the original article before relying on a detail.${details ? `<br>${escapeHtml(details)}` : ""}</p>
  </td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  const storyText = digest.stories
    .map((story) =>
      [
        storyMeta(story).toUpperCase(),
        story.title,
        story.summary,
        story.why_it_matters,
        story.url,
      ].join("\n"),
    )
    .join("\n\n");

  const text = [
    NAME.toUpperCase(),
    longDate,
    "",
    summary,
    ...(storyText ? ["", storyText] : []),
    "",
    "---",
    "Researched and summarized by an AI agent, so check the original article before relying on a detail.",
    ...(details ? [details] : []),
    "",
  ].join("\n");

  return { subject, html, text };
}
