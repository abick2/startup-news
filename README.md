# The Startup Brief

A daily startup news email. Each morning an agent built on the Claude Agent SDK searches the web, then ordinary code filters the stories, renders the email, and sends it through Resend.

The agent only has web search and web fetch, and it never sees the Resend key.

## Common changes

| To change | Edit |
|---|---|
| What counts as relevant | `prompts/relevance.md` (no rebuild needed locally; on the instance, re-run setup) |
| Email design | `src/render.ts` |
| Fields the agent returns | `src/schema.ts` |
| Send time | `OnCalendar` in `deploy/startup-news.timer` |
| Model or per-run spending cap | `MODEL` and `MAX_BUDGET_USD` in `.env` |

## Run it locally

```bash
npm install
cp .env.example .env        # then fill it in

npm run preview             # sample stories, no API calls: writes out/digest.html
npm run digest:dry          # real agent run (costs money), sends nothing
npm test
```

## Set up the accounts

1. **Anthropic:** create an API key in the [Claude Console](https://platform.claude.com/). The SDK needs an API key, not a claude.ai login.
2. **Resend:** create an account and an [API key](https://resend.com/api-keys). Until you [verify a domain](https://resend.com/docs/add-a-domain), the shared `onboarding@resend.dev` sender can only deliver to your Resend account's own email address, so set `EMAIL_TO` to that address.

## Deploy to Lightsail

These steps assume Ubuntu or Debian. From your laptop:

```bash
rsync -a --exclude node_modules --exclude dist --exclude .env --exclude state --exclude work --exclude out --exclude .git \
  ./ ubuntu@YOUR_INSTANCE_IP:~/startup-news-sender/
```

On the instance:

```bash
cd ~/startup-news-sender
sudo bash deploy/setup.sh
sudo nano /opt/startup-news-sender/.env
sudo systemctl enable --now startup-news.timer
```

Start one run now to test it. This sends that day's real digest, so the 7:00 run the same day will skip:

```bash
sudo systemctl start startup-news.service
journalctl -u startup-news.service -n 50 --no-pager
systemctl show startup-news.service -p MemoryPeak
systemctl list-timers startup-news.timer
```

To update later, repeat the `rsync` and `setup.sh` steps. Your `.env` and send history are kept.

### Memory on a 512 MB instance

The SDK's suggested starting point is 1 GiB, so `setup.sh` adds a 2 GB swap file on smaller instances. If runs get killed or crawl, move to a 1 GB plan.

## How it behaves

- **One email a day:** `state/sent.json` records each day's send, and a Resend idempotency key covers a crash between sending and recording.
- **Missed runs:** if the instance was off at 7:00, the run happens when it next boots.
- **Failures:** you get one short failure email that day and the service exits non-zero. Details are in `journalctl`.
- **Nothing to report:** you get a short "quiet day" edition.
- **Filters:** links must be `http` or `https`, stories must be at most 3 days old, and URLs sent in the last 14 days are dropped.
- **Limits:** each run stops at 30 turns, the `MAX_BUDGET_USD` estimate ($2 by default), or 15 minutes.
