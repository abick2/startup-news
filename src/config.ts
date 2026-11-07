import path from "node:path";
import { z } from "zod";

export const ROOT = path.resolve(import.meta.dirname, "..");

const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_TO: z.string().optional(),
  EMAIL_FROM: z.string().default("The Startup Brief <onboarding@resend.dev>"),
  MODEL: z.string().default("claude-haiku-5-5"),
  MAX_BUDGET_USD: z.coerce.number().positive().default(2),
  TIMEZONE: z.string().default("America/New_York"),
});

export type Config = z.infer<typeof ConfigSchema>;

// Under systemd the variables arrive through EnvironmentFile and the .env file
// isn't readable by the service user, so a missing file is fine.
export function loadConfig(): Config {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {}
  // Empty strings from an unfilled .env count as unset.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ""),
  );
  return ConfigSchema.parse(env);
}

export function requireSetting(
  config: Config,
  ...names: ("ANTHROPIC_API_KEY" | "RESEND_API_KEY" | "EMAIL_TO")[]
): void {
  const missing = names.filter((name) => !config[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required settings: ${missing.join(", ")}`);
  }
}
