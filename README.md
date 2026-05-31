# Google Gemma Discord Bot & Admin Portal

This repository contains a serverless Discord LLM bot built around Cloudflare Workers and Discord slash commands.

What changed:
- The Discord gateway daemon is gone from the main flow.
- Discord now calls the Worker through an interactions webhook.
- Slash commands are registered once with a small script, so there is no VPS requirement.

The project is structured as:
- **Cloudflare Worker Backend (`src/worker.ts`)**: Verifies Discord interaction signatures, serves the web dashboard, queries Cloudflare Workers AI (`@cf/google/gemma-4-26b-a4b-it` by default), and can fetch recent channel history over the Discord REST API when a bot token is available.
- **React Dashboard (`src/App.tsx`)**: A web UI for setup, status, and test utilities.
- **Slash command registration script (`scripts/register-discord-commands.mjs`)**: Registers the `/gemma` command through Discord REST.

## Prerequisites

1. Node.js v18+.
2. A Cloudflare account.
3. A Discord Developer account.
4. A Google Cloud Console account, if you want Google OAuth for the dashboard.

## Discord Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create or open your application.
3. In **Bot**, create the bot and copy the **Bot Token**.
4. In **General Information**, copy the **Application ID** and **Public Key**.
5. In the application settings, set the **Interactions Endpoint URL** to:

   `https://<your-worker-domain>/api/discord/interactions`

6. Invite the bot to your server with both `bot` and `applications.commands` scopes.

## Local Development

Install dependencies:

```bash
npm install
```

Create a `.dev.vars` file for the Worker:

```env
DISCORD_TOKEN="your_bot_token"
DISCORD_PUBLIC_KEY="your_discord_public_key"
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
ALLOWED_EMAILS="your.email@gmail.com,another@gmail.com"
DISCORD_COMMAND_NAME="gemma"
```

If you want the slash command registration script to run locally, create a `.env` file:

```env
DISCORD_TOKEN="your_bot_token"
DISCORD_APPLICATION_ID="your_application_id"
DISCORD_COMMAND_NAME="gemma"
# Optional: register instantly in one guild while testing
DISCORD_GUILD_ID="your_guild_id"
```

Run the command registration script whenever you change the slash command definition:

```bash
npm run register:commands
```

## Worker Secrets

Upload production secrets to Cloudflare:

```bash
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put ALLOWED_EMAILS
```

## Running Locally

Build the frontend and start the Worker:

```bash
npm run build
npm run dev:worker
```

Then point Discord's interactions endpoint at your local Worker URL if you are using a public tunnel, or deploy first and use the deployed Worker URL.

## Deployment

Deploy the frontend and Worker:

```bash
npm run deploy
```

## Using the Bot

After registering the command, use:

```text
/gemma prompt: Tell me a short story about an edge server
```

Optional command arguments:
- `history`: how many recent messages from the channel to include as context
- `ephemeral`: whether the response should only be visible to you

The Worker defers the interaction immediately, then edits the original slash-command response once Gemini finishes generating the reply.
