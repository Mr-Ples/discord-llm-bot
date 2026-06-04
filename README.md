# Google Gemma Discord Bot & Admin Portal

This repository contains a serverless Discord LLM bot built around Cloudflare Workers and Discord slash commands.

What changed:
- The Discord gateway daemon is gone from the main flow.
- Discord now calls the Worker through an interactions webhook.
- Slash commands are registered once with a small script, so there is no VPS requirement.

The project is structured as:
- **Cloudflare Worker Backend (`src/worker.ts`)**: Verifies Discord interaction signatures, serves the web dashboard, queries Cloudflare Workers AI (`@cf/google/gemma-4-26b-a4b-it` by default), and can fetch recent channel history over the Discord REST API when a bot token is available.
- **React Dashboard (`src/App.tsx`)**: A web UI for setup, status, and test utilities.
- **Slash command registration script (`scripts/register-discord-commands.mjs`)**: Registers the `/chat` and `/chat_system` commands through Discord REST.

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
DISCORD_COMMAND_NAME="chat"
DISCORD_SYSTEM_COMMAND_NAME="chat_system"
DISCORD_USER_ALIASES='{"ossi":"totalrecall"}'
```

If you want the slash command registration script to run locally, create a `.env` file:

```env
DISCORD_TOKEN="your_bot_token"
DISCORD_APPLICATION_ID="your_application_id"
DISCORD_COMMAND_NAME="chat"
DISCORD_SYSTEM_COMMAND_NAME="chat_system"
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
npx wrangler secret put DISCORD_USER_ALIASES
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
/chat prompt: Tell me a short story about an edge server
/chat prompt: Tell me a short story about an edge server personality: The Sarcastic Scribe
/personalities
/chat_system prompt: Tell me a short story about an edge server system_prompt: You are a concise technical narrator.
```

Optional command arguments:
- `personality`: for `/chat`, choose one of the personalities from `prompts.md`; omit it to use a random personality
- `system_prompt`: for `/chat_system`, provide the system prompt directly
- `history`: how many recent messages from the channel to include as context
- `ephemeral`: whether the response should only be visible to you

Use `/personalities` to list every available personality name and id. Personality replies are prefixed with the personality name, and each personality prompt automatically includes `Be concise.`

The chat command can ping users from natural language requests like `tell ossi do this`. By default, `ossi` resolves to the Discord username `totalrecall`; add more aliases with `DISCORD_USER_ALIASES`, either as JSON like `{"sam":"samantha"}`, JavaScript-style entries like `{'sam':'samantha'}`, or comma-separated pairs like `sam=samantha,alex=alexander`. User lookup requires the command to run in a guild and the bot token to be able to search guild members.

After changing slash commands, re-register them with `npm run register:commands`.

The Worker defers chat interactions immediately, then edits the original slash-command response once Gemini finishes generating the reply.
