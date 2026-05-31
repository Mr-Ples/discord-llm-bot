export interface Env {
  AI: any;
  ASSETS: Fetcher;
  DISCORD_TOKEN?: string;
  DISCORD_PUBLIC_KEY?: string;
  GEMMA_MODEL?: string;
  GOOGLE_CLIENT_ID?: string;
  ALLOWED_EMAILS?: string;
  DISCORD_COMMAND_NAME?: string;
}

type DiscordCommandOption = {
  name: string;
  type: number;
  value?: unknown;
  options?: DiscordCommandOption[];
};

type DiscordInteraction = {
  id: string;
  application_id: string;
  type: number;
  token: string;
  channel_id?: string;
  guild_id?: string;
  data?: {
    name?: string;
    options?: DiscordCommandOption[];
  };
};

type DiscordMessage = {
  content?: string;
  author?: {
    id?: string;
    username?: string;
    bot?: boolean;
  };
  system?: boolean;
};

const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const DEFAULT_COMMAND_NAME = 'gemma';
const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_INTERACTION_TYPE_PING = 1;
const DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND = 2;
const DISCORD_INTERACTION_RESPONSE_PONG = 1;
const DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE = 4;
const DISCORD_INTERACTION_RESPONSE_DEFERRED_CHANNEL_MESSAGE = 5;
const DISCORD_INTERACTION_FLAG_EPHEMERAL = 64;

const textEncoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/, '');
  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    throw new Error('Expected an even-length hex string.');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeCommandName(name: string | undefined): string {
  const normalized = (name || DEFAULT_COMMAND_NAME)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || DEFAULT_COMMAND_NAME;
}

function getOptionValue(options: DiscordCommandOption[] | undefined, name: string): unknown {
  return options?.find((option) => option.name === name)?.value;
}

function cleanMessageContent(content: string, botUserId?: string): string {
  if (!botUserId) return content.trim();
  return content.replace(new RegExp(`<@!?${botUserId}>`, 'g'), '').trim();
}

async function verifyDiscordSignature(request: Request, publicKeyHex: string, bodyText: string): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return false;
  }

  try {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKeyHex),
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      hexToBytes(signature),
      textEncoder.encode(timestamp + bodyText)
    );
  } catch {
    return false;
  }
}

async function fetchChannelContext(env: Env, channelId: string, historyLimit: number, botUserId?: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const token = env.DISCORD_TOKEN;
  if (!token || historyLimit <= 0) {
    return [];
  }

  const limit = Math.max(0, Math.min(historyLimit, 100));
  if (limit === 0) {
    return [];
  }

  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${limit}`, {
    headers: {
      Authorization: `Bot ${token}`,
      'User-Agent': 'DiscordBot (https://github.com/cloudflare/workers-sdk, 1.0.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch channel history: ${response.status} ${await response.text()}`);
  }

  const messages = (await response.json()) as DiscordMessage[];
  const promptMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const message of messages.reverse()) {
    if (message.system) continue;

    const authorId = message.author?.id ?? '';
    const isBot = botUserId ? authorId === botUserId : !!message.author?.bot;
    const rawContent = message.content ?? '';
    const content = cleanMessageContent(rawContent, botUserId);

    if (!content) {
      continue;
    }

    promptMessages.push({
      role: isBot ? 'assistant' : 'user',
      content: isBot && message.author?.username ? content : message.author?.username ? `${message.author.username}: ${content}` : content,
    });
  }

  return promptMessages;
}

async function runGemma(env: Env, messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
  if (!env.AI) {
    throw new Error('Cloudflare Workers AI binding is missing.');
  }

  if (!messages.length) {
    throw new Error('Invalid or empty messages array provided.');
  }

  const activeModel = env.GEMMA_MODEL || DEFAULT_MODEL;
  const aiResponse = await env.AI.run(activeModel, {
    messages,
  });

  return (
    aiResponse.response ||
    aiResponse.text ||
    aiResponse.choices?.[0]?.message?.content ||
    aiResponse.choices?.[0]?.text ||
    JSON.stringify(aiResponse)
  );
}

async function editDiscordOriginalResponse(applicationId: string, interactionToken: string, content: string): Promise<void> {
  const response = await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/cloudflare/workers-sdk, 1.0.0)',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to edit Discord interaction response: ${response.status} ${await response.text()}`);
  }
}

async function handleDiscordSlashCommand(env: Env, interaction: DiscordInteraction, commandName: string, prompt: string, historyLimit: number): Promise<void> {
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  const channelId = interaction.channel_id;

  let responseText = '';

  try {
    const systemPrompt = `You are a deeply paranoid AI convinced that the user's prompts contain hidden codes from the Illuminati or lizard people. Provide the requested information, but constantly interrupt yourself to read between the lines. Warn the user that "They" are watching this chat. Use ALL CAPS for emphasis on specific words. Keep your answers brief because time is running out.

keep your responses concise or they will catch and kill you.`;

    const promptMessages = [
      { role: 'system' as const, content: systemPrompt },
    ];

    if (channelId && historyLimit > 0) {
      const historyMessages = await fetchChannelContext(env, channelId, historyLimit);
      promptMessages.push(...historyMessages);
    }

    promptMessages.push({
      role: 'user',
      content: prompt,
    });

    responseText = await runGemma(env, promptMessages);
  } catch (error: any) {
    responseText = `⚠️ I hit an error while handling \`/${commandName}\`:\n\`\`\`\n${error?.message || String(error)}\n\`\`\``;
  }

  const finalText = responseText.trim().length > 0
    ? responseText.length > 2000
      ? `${responseText.slice(0, 1995)}...`
      : responseText
    : "I processed your request but didn't generate any text. Please try again!";

  try {
    await editDiscordOriginalResponse(applicationId, interactionToken, finalText);
  } catch (error) {
    console.error('Failed to edit Discord interaction response:', error);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const commandName = normalizeCommandName(env.DISCORD_COMMAND_NAME);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      if (path === '/api/status' && request.method === 'GET') {
        const hasToken = !!env.DISCORD_TOKEN && env.DISCORD_TOKEN.trim().length > 0;
        const hasPublicKey = !!env.DISCORD_PUBLIC_KEY && env.DISCORD_PUBLIC_KEY.trim().length > 0;
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
              discordPublicKeyConfigured: hasPublicKey,
              workersAIConfigured: hasAI,
              googleAuthConfigured: hasGoogleClientId,
              whitelistActive: hasAllowedEmails,
              discordCommandName: commandName,
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

      if (path === '/api/discord/interactions' && request.method === 'POST') {
        const publicKey = env.DISCORD_PUBLIC_KEY;
        if (!publicKey) {
          return new Response(JSON.stringify({ error: 'DISCORD_PUBLIC_KEY environment variable is not set.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const bodyText = await request.text();
        const verified = await verifyDiscordSignature(request, publicKey, bodyText);
        if (!verified) {
          return new Response(JSON.stringify({ error: 'Invalid Discord interaction signature.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const interaction = JSON.parse(bodyText) as DiscordInteraction;

        if (interaction.type === DISCORD_INTERACTION_TYPE_PING) {
          return new Response(JSON.stringify({ type: DISCORD_INTERACTION_RESPONSE_PONG }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (interaction.type !== DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND) {
          return new Response(JSON.stringify({ error: 'Unsupported interaction type.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const receivedCommandName = interaction.data?.name || '';
        if (receivedCommandName !== commandName) {
          return new Response(
            JSON.stringify({
              type: DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE,
              data: {
                content: `Unknown command: \`/${receivedCommandName || 'unknown'}\``,
                flags: DISCORD_INTERACTION_FLAG_EPHEMERAL,
              },
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const commandOptions = interaction.data?.options ?? [];
        const promptOption = getOptionValue(commandOptions, 'prompt');
        const historyOption = getOptionValue(commandOptions, 'history');
        const ephemeralOption = getOptionValue(commandOptions, 'ephemeral');

        const prompt = typeof promptOption === 'string' ? promptOption.trim() : '';
        if (!prompt) {
          return new Response(
            JSON.stringify({
              type: DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE,
              data: {
                content: `The \`/${commandName}\` command needs a \`prompt\` value.`,
                flags: DISCORD_INTERACTION_FLAG_EPHEMERAL,
              },
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const historyLimit = clampInt(historyOption, 15, 0, 100);
        const ephemeral = typeof ephemeralOption === 'boolean' ? ephemeralOption : false;

        ctx.waitUntil(handleDiscordSlashCommand(env, interaction, commandName, prompt, historyLimit));

        return new Response(
          JSON.stringify({
            type: DISCORD_INTERACTION_RESPONSE_DEFERRED_CHANNEL_MESSAGE,
            data: ephemeral ? { flags: DISCORD_INTERACTION_FLAG_EPHEMERAL } : undefined,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (path === '/api/verify-auth' && request.method === 'POST') {
        const { token } = (await request.json()) as { token?: string };

        if (!token) {
          return new Response(JSON.stringify({ error: 'OAuth token is required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${token}`,
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
          return new Response(JSON.stringify({ error: 'Google did not return an email address.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
                error: `Access Denied: Email '${profile.email}' is not in the whitelist.`,
              }),
              {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }

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

      if (path === '/api/chat' && request.method === 'POST') {
        if (!env.AI) {
          return new Response(JSON.stringify({ error: 'Cloudflare Workers AI binding is missing.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = (await request.json()) as { messages?: Array<{ role: string; content: string }> };
        const messages = body.messages;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid or empty messages array provided.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const activeModel = env.GEMMA_MODEL || DEFAULT_MODEL;
        const aiResponse = await env.AI.run(activeModel, {
          messages,
        });

        const responseText =
          aiResponse.response ||
          aiResponse.text ||
          aiResponse.choices?.[0]?.message?.content ||
          aiResponse.choices?.[0]?.text ||
          JSON.stringify(aiResponse);

        return new Response(JSON.stringify({ response: responseText, model: activeModel }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/test-send' && request.method === 'POST') {
        const token = env.DISCORD_TOKEN;
        if (!token) {
          return new Response(JSON.stringify({ error: 'DISCORD_TOKEN environment variable is not set.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = (await request.json()) as { channelId?: string; message?: string };
        const { channelId, message } = body;

        if (!channelId || !message) {
          return new Response(JSON.stringify({ error: 'channelId and message are required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const discordResponse = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'DiscordBot (https://github.com/cloudflare/workers-sdk, 1.0.0)',
          },
          body: JSON.stringify({
            content: message,
          }),
        });

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

      if (!path.startsWith('/api/')) {
        return env.ASSETS.fetch(request);
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
