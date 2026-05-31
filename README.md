# Google Gemma Discord Bot & Admin Portal

This repository contains a unified, edge-inferred Discord LLM bot utilizing the Google Gemma model, paired with a web-based administration dashboard. 

The project is structured under a single unified directory sharing one `package.json` for simplicity:
* **Cloudflare Worker Backend (`src/worker.ts`)**: Handles Google OAuth 2.0 validation, whitelists allowed emails, routes inference requests to Cloudflare Workers AI (`@cf/google/gemma-2-9b-it`), and interacts with the Discord REST API to test message deliveries.
* **React Dashboard (`src/App.tsx`)**: Built using React Router and styled with premium glassmorphic Tailwind CSS. It is served directly by the Cloudflare Worker using native Assets, secured by Google Login.
* **Discord Bot Gateway Daemon (`bot.js`)**: A lightweight background Node.js daemon that connects to the Discord Gateway, listens for mentions (`@GemmaBot`), fetches channel/thread context history, and queries the edge Worker.

---

## 🛠️ Prerequisites

1. [Node.js](https://nodejs.org/) v18+ (tested on Node v25).
2. A [Cloudflare Account](https://dash.cloudflare.com/) (free tier is fully compatible).
3. A [Discord Developer Account](https://discord.com/developers/applications).
4. A [Google Cloud Console Account](https://console.cloud.google.com/) (only if setting up Google OAuth).

---

## 1. 🤖 Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and enter a name.
3. In the left-hand sidebar, navigate to **Bot**.
4. Click **Add Bot** (if prompted).
5. Locate the **Token** section and click **Reset Token**. Copy this token — you will need it for `DISCORD_TOKEN`.
6. Scroll down on the **Bot** tab to the **Privileged Gateway Intents** section.
7. Toggle **MESSAGE CONTENT INTENT** to **ON** and save changes. (This is required so the bot can read messages mentioning it).
8. Go to **General Information** and copy the **Application ID** (Client ID) to generate invite links later.

---

## 2. 🔑 Google OAuth Setup (For Web Dashboard)

If you wish to secure your dashboard, you must register a Google Client ID:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Go to **APIs & Services** > **Credentials**.
4. Click **Create Credentials** > **OAuth client ID**.
5. Set the Application Type to **Web application**.
6. Under **Authorized JavaScript origins**, add:
   * `http://localhost:8787` (local worker testing)
   * `http://localhost:5173` (local Vite testing)
   * Your deployed Worker URL (e.g. `https://gemma-discord-worker.<subdomain>.workers.dev`)
7. Under **Authorized redirect URIs**, add the exact same URLs:
   * `http://localhost:8787/`
   * `http://localhost:5173/`
   * `https://gemma-discord-worker.<subdomain>.workers.dev/`
8. Click **Create** and copy your **Client ID**.

---

## 3. 💻 Local Development Setup

### Install Dependencies
Run `npm install` at the root folder:
```bash
npm install
```

### Configure Credentials
Create a `.dev.vars` file in the root directory for the Cloudflare Worker:
```env
# .dev.vars (Worker secrets)
DISCORD_TOKEN="YOUR_DISCORD_BOT_TOKEN"
GOOGLE_CLIENT_ID="YOUR_GOOGLE_OAUTH_CLIENT_ID"
ALLOWED_EMAILS="admin@example.com,user@example.com"
GEMMA_MODEL="@cf/google/gemma-2-9b-it"
```
> **Note**: `ALLOWED_EMAILS` is a comma-separated whitelist. If it is empty or undefined, the login will accept any Google account (acting in public mode).

Create a `.env` file in the root directory for the Discord bot:
```env
# .env (Discord Gateway Bot config)
DISCORD_TOKEN="YOUR_DISCORD_BOT_TOKEN"
WORKER_API_URL="http://localhost:8787"
MESSAGE_CAP="15"
```

### Start Development Servers

1. **Build & run the Frontend & Worker locally**:
   First compile the React frontend so the Worker can serve it:
   ```bash
   npm run build
   ```
   Now start the Wrangler local development server:
   ```bash
   npm run dev:worker
   ```
   This exposes the local backend and serves the frontend on `http://localhost:8787`.

2. **Run the Discord Bot Daemon**:
   In a separate terminal window, start the gateway connection:
   ```bash
   npm run start:bot
   ```

3. **Open the Dashboard**:
   Go to `http://localhost:8787` in your browser. 
   * *Google Login Bypass*: For local development, you will see a **Dev Bypass** button. Clicking this logs you in automatically with a dummy local profile, bypassing the Google OAuth flow so you don't have to configure Google Credentials to test the app!

---

## 🚀 4. Deployment to Cloudflare

Deploying your backend API and frontend assets to Cloudflare is consolidated into one command:

```bash
# 1. Build the React frontend
npm run build

# 2. Deploy both the static assets and the Worker API
npm run deploy
```

Once deployed, you must upload your production secrets:
```bash
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put ALLOWED_EMAILS
```

---

## 💡 Adding the Bot to Your Discord Server

1. Open your Dashboard, log in, and head to the **Setup Guide** panel.
2. Enter your bot's **Client ID** (Application ID).
3. Click the generated **Invite Bot** link to authorize the bot to join your target server.
4. Go to any text channel or thread, tag the bot, and chat! E.g.:
   `@Gemma Bot tell me a short story about an edge server`
5. The bot will automatically fetch the last 15 messages for context and generate replies via the Gemma model.
