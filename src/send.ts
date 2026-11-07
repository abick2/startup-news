import { Resend } from "resend";
import type { Config } from "./config.js";
import type { RenderedEmail } from "./render.js";

export interface SendResult {
  emailId: string | null;
  // Resend had already seen this idempotency key, so nothing new was sent.
  duplicate: boolean;
}

// Resend remembers idempotency keys for 24 hours, which covers a crash between
// sending and recording the send. A retry can carry different content for the
// same key, and Resend rejects that rather than sending, which is what we want.
const DUPLICATE_ERRORS = new Set(["invalid_idempotent_request", "concurrent_idempotent_requests"]);

async function send(
  config: Config,
  email: Omit<RenderedEmail, "html"> & { html?: string },
  idempotencyKey: string,
): Promise<SendResult> {
  const resend = new Resend(config.RESEND_API_KEY);
  const { data, error } = await resend.emails.send(
    {
      from: config.EMAIL_FROM,
      to: [config.EMAIL_TO!],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    },
    { idempotencyKey },
  );
  if (error) {
    if (DUPLICATE_ERRORS.has(error.name)) return { emailId: null, duplicate: true };
    throw new Error(`Resend rejected the email: ${error.name}: ${error.message}`);
  }
  return { emailId: data?.id ?? null, duplicate: false };
}

export function sendDigest(config: Config, email: RenderedEmail, date: string): Promise<SendResult> {
  return send(config, email, `digest-${date}`);
}

export function sendFailureNotice(config: Config, date: string, message: string): Promise<SendResult> {
  return send(
    config,
    {
      subject: `The Startup Brief failed on ${date}`,
      text: `Today's digest couldn't be sent.\n\n${message}\n\nCheck the logs on the instance: journalctl -u startup-news.service\n`,
    },
    `digest-failure-${date}`,
  );
}
