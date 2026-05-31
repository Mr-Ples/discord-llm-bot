export interface Env {
  AI: any;
  DISCORD_TOKEN?: string;
  GEMMA_MODEL?: string;
  GOOGLE_CLIENT_ID?: string;
  ALLOWED_EMAILS?: string;
}

const DEFAULT_MODEL = '@cf/google/gemma-2-9b-it';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // 1. API - Status Check
      if (path === '/api/status' && request.method === 'GET') {
        const hasToken = !!env.DISCORD_TOKEN && env.DISCORD_TOKEN.trim().length > 0;
        const hasAI = !!env.AI;
        const activeModel = env.GEMMA_MODEL || DEFAULT_MODEL;
        const hasGoogleClientId = !!env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim().length > 0;
        const hasAllowedEmails = !!env.ALLOWED_EMAILS && env.ALLOWED_EMAILS.trim().length > 0;

        return new Response(
          JSON.stringify({
            status: 'online',
            model: activeModel,
            config: {
              discordTokenConfigured: hasToken,
              workersAIConfigured: hasAI,
              googleAuthConfigured: hasGoogleClientId,
              whitelistActive: hasAllowedEmails,
              googleClientId: env.GOOGLE_CLIENT_ID || '',
            },
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // 2. API - Verify Google Token & Check Whitelist
      if (path === '/api/verify-auth' && request.method === 'POST') {
        const { token } = (await request.json()) as { token?: string };

        if (!token) {
          return new Response(
            JSON.stringify({ error: 'OAuth token is required.' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Fetch userinfo from Google using the access token
        const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!googleResponse.ok) {
          const errData = await googleResponse.text();
          return new Response(
            JSON.stringify({ error: 'Failed to verify token with Google.', details: errData }),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const profile = (await googleResponse.json()) as {
          email?: string;
          name?: string;
          picture?: string;
          email_verified?: boolean;
        };

        if (!profile.email) {
          return new Response(
            JSON.stringify({ error: 'Google did not return an email address.' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const userEmail = profile.email.toLowerCase().trim();
        const allowedEmailsStr = env.ALLOWED_EMAILS || '';
        const whitelistActive = allowedEmailsStr.trim().length > 0;

        if (whitelistActive) {
          const allowedEmails = allowedEmailsStr
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter((email) => email.length > 0);

          if (!allowedEmails.includes(userEmail)) {
            return new Response(
              JSON.stringify({ 
                error: `Access Denied: Email '${profile.email}' is not in the whitelist.` 
              }),
              {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }

        // Whitelisted or no whitelist configured -> Access Granted
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              email: profile.email,
              name: profile.name || 'Gemma Admin',
              picture: profile.picture || '',
            },
            whitelistEnforced: whitelistActive,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 3. API - Chat (Run Gemma LLM)
      if (path === '/api/chat' && request.method === 'POST') {
        if (!env.AI) {
          return new Response(
            JSON.stringify({ error: 'Cloudflare Workers AI binding is missing.' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const body = (await request.json()) as { messages?: Array<{ role: string; content: string }> };
        const messages = body.messages;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Invalid or empty messages array provided.' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const activeModel = env.GEMMA_MODEL || DEFAULT_MODEL;

        const aiResponse = await env.AI.run(activeModel, {
          messages: messages,
        });

        const responseText = aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);

        return new Response(
          JSON.stringify({ response: responseText, model: activeModel }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 4. API - Test Send Message to Discord
      if (path === '/api/test-send' && request.method === 'POST') {
        const token = env.DISCORD_TOKEN;
        if (!token) {
          return new Response(
            JSON.stringify({ error: 'DISCORD_TOKEN environment variable is not set.' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const body = (await request.json()) as { channelId?: string; message?: string };
        const { channelId, message } = body;

        if (!channelId || !message) {
          return new Response(
            JSON.stringify({ error: 'channelId and message are required.' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const discordResponse = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'DiscordBot (https://github.com/cloudflare/workers-sdk, 1.0.0)',
            },
            body: JSON.stringify({
              content: message,
            }),
          }
        );

        const discordData = (await discordResponse.json()) as any;

        if (!discordResponse.ok) {
          return new Response(
            JSON.stringify({
              error: 'Failed to send message to Discord',
              details: discordData,
            }),
            {
              status: discordResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            messageId: discordData.id,
            channelId: discordData.channel_id,
            timestamp: discordData.timestamp,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Fallback for Single Page App (Client-side routing)
      // If the request doesn't match an API route and Wrangler Assets didn't intercept it
      // (e.g. user hits /console directly), we should serve the index.html so the React Router can load
      const isApiRoute = path.startsWith('/api/');
      if (!isApiRoute) {
        // Fetch index.html from static assets (which Wrangler makes available)
        // If we can't fetch it, we just return a 404. Since we have assets directory enabled,
        // wrangler can serve it or we can fetch the asset. The native way to let wrangler assets serve it
        // is to allow it to fall through. For Client Side Routing in Workers, we can fetch the index.html from the asset binding.
        // In Wrangler, we can read the asset by fetching it directly from our own origin.
        const origin = new URL(request.url).origin;
        const indexResponse = await fetch(`${origin}/index.html`);
        if (indexResponse.ok) {
          return new Response(indexResponse.body, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: err.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
