import personalitiesData from '../personalities.json';

export interface Env {
  AI: any;
  ASSETS: Fetcher;
  DISCORD_TOKEN?: string;
  DISCORD_PUBLIC_KEY?: string;
  GEMMA_MODEL?: string;
  GOOGLE_CLIENT_ID?: string;
  ALLOWED_EMAILS?: string;
  DISCORD_COMMAND_NAME?: string;
  DISCORD_SYSTEM_COMMAND_NAME?: string;
  DISCORD_PERSONALITIES_COMMAND_NAME?: string;
  DISCORD_USER_ALIASES?: string;
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

type DiscordMember = {
  nick?: string | null;
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
    bot?: boolean;
  };
};

const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const DEFAULT_COMMAND_NAME = 'chat';
const DEFAULT_SYSTEM_COMMAND_NAME = 'chat_system';
const DEFAULT_PERSONALITIES_COMMAND_NAME = 'personalities';
const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_INTERACTION_TYPE_PING = 1;
const DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND = 2;
const DISCORD_INTERACTION_RESPONSE_PONG = 1;
const DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE = 4;
const DISCORD_INTERACTION_RESPONSE_DEFERRED_CHANNEL_MESSAGE = 5;
const DISCORD_INTERACTION_FLAG_EPHEMERAL = 64;

const textEncoder = new TextEncoder();
const CONCISE_PERSONALITY_INSTRUCTION = 'Be concise.';
const DEFAULT_USER_ALIASES: Record<string, string> = {

};

type PromptPersonality = {
  id: string;
  name: string;
  prompt: string;
};

type RawPromptPersonality = {
  id?: unknown;
  name?: unknown;
  prompt?: unknown;
};

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

function normalizeCommandName(name: string | undefined, fallback = DEFAULT_COMMAND_NAME): string {
  const normalized = (name || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function normalizePersonalityId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizePromptPersonalities(rawPersonalities: RawPromptPersonality[]): PromptPersonality[] {
  return rawPersonalities.flatMap((rawPersonality) => {
    const name = typeof rawPersonality.name === 'string' ? rawPersonality.name.trim() : '';
    const prompt = typeof rawPersonality.prompt === 'string' ? rawPersonality.prompt.trim() : '';
    const rawId = typeof rawPersonality.id === 'string' ? rawPersonality.id.trim() : '';
    const id = rawId ? normalizePersonalityId(rawId) : normalizePersonalityId(name);

    if (!name || !prompt || !id) {
      return [];
    }

    return [{ id, name, prompt }];
  });
}

const PROMPT_PERSONALITIES = normalizePromptPersonalities(personalitiesData);

function pickRandomPersonality(): PromptPersonality {
  if (!PROMPT_PERSONALITIES.length) {
    throw new Error('No personalities were found in personalities.json.');
  }

  return PROMPT_PERSONALITIES[Math.floor(Math.random() * PROMPT_PERSONALITIES.length)];
}

function findPersonality(value: unknown): PromptPersonality | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const normalized = normalizePersonalityId(value);
  return PROMPT_PERSONALITIES.find(
    (personality) => personality.id === normalized || normalizePersonalityId(personality.name) === normalized
  );
}

function withConciseInstruction(prompt: string): string {
  return `${prompt.trim()}\n\n${CONCISE_PERSONALITY_INSTRUCTION}`;
}

function formatPersonalityList(commandName: string): string {
  const lines = PROMPT_PERSONALITIES.map((personality) => `- ${personality.name} (\`${personality.id}\`)`);
  const text = [
    `Available personalities:`,
    ...lines,
    '',
    `Use one by setting the \`personality\` option on \`/${commandName}\`.`,
  ].join('\n');

  return text.length > 2000 ? `${text.slice(0, 1995)}...` : text;
}

function getOptionValue(options: DiscordCommandOption[] | undefined, name: string): unknown {
  return options?.find((option) => option.name === name)?.value;
}

function normalizeUserLookupValue(value: string): string {
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_.-]+/gu, '');
}

function parseUserAliases(rawAliases: string | undefined): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const [alias, lookup] of Object.entries(DEFAULT_USER_ALIASES)) {
    aliases.set(normalizeUserLookupValue(alias), lookup);
  }

  if (!rawAliases?.trim()) {
    return aliases;
  }

  const trimmedAliases = rawAliases.trim();

  try {
    const parsed = JSON.parse(trimmedAliases) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [alias, lookup] of Object.entries(parsed)) {
        if (typeof lookup === 'string' && alias.trim() && lookup.trim()) {
          aliases.set(normalizeUserLookupValue(alias), lookup.trim());
        }
      }
      return aliases;
    }
  } catch {
    // Fall through to comma/newline parsing.
  }

  const objectEntries = trimmedAliases.matchAll(/['"]?([\p{L}\p{N}_.-]+)['"]?\s*:\s*['"]([^'"]+)['"]/gu);
  for (const entry of objectEntries) {
    const alias = entry[1]?.trim();
    const lookup = entry[2]?.trim();
    if (alias && lookup) {
      aliases.set(normalizeUserLookupValue(alias), lookup);
    }
  }

  for (const entry of trimmedAliases.split(/[,\n;]/)) {
    const [alias, lookup] = entry.split('=').map((part) => part?.trim());
    if (alias && lookup) {
      aliases.set(normalizeUserLookupValue(alias), lookup);
    }
  }

  return aliases;
}

function extractTellRequest(prompt: string): { target: string; message: string } | undefined {
  const match = prompt.match(/^\s*(?:tell|ask|ping|message|msg)\s+(<@!?\d+>|@?[\p{L}\p{N}_.-]+)\s*[:,]?\s+([\s\S]+)$/iu);
  if (!match) {
    return undefined;
  }

  const target = match[1].trim();
  const message = match[2].trim();
  const normalizedTarget = normalizeUserLookupValue(target);
  if (!target || !message || normalizedTarget === 'me') {
    return undefined;
  }

  return { target, message };
}

function getMemberNames(member: DiscordMember): string[] {
  return [member.user?.username, member.user?.global_name || undefined, member.nick || undefined]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeUserLookupValue);
}

async function resolveMentionTarget(
  env: Env,
  guildId: string | undefined,
  target: string
): Promise<{ id: string; name: string } | undefined> {
  const mentionMatch = target.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return { id: mentionMatch[1], name: target };
  }

  const token = env.DISCORD_TOKEN;
  if (!token || !guildId) {
    return undefined;
  }

  const aliases = parseUserAliases(env.DISCORD_USER_ALIASES);
  const normalizedTarget = normalizeUserLookupValue(target);
  const lookup = aliases.get(normalizedTarget) || target.replace(/^@+/, '').trim();
  const normalizedLookup = normalizeUserLookupValue(lookup);

  if (!normalizedLookup) {
    return undefined;
  }

  const response = await fetch(
    `${DISCORD_API_BASE}/guilds/${guildId}/members/search?query=${encodeURIComponent(lookup)}&limit=10`,
    {
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': 'DiscordBot (https://github.com/cloudflare/workers-sdk, 1.0.0)',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search Discord members: ${response.status} ${await response.text()}`);
  }

  const members = (await response.json()) as DiscordMember[];
  const exactMatch = members.find((member) => getMemberNames(member).includes(normalizedLookup));
  const selectedMember = exactMatch || members[0];
  const selectedUser = selectedMember?.user;

  if (!selectedUser?.id) {
    return undefined;
  }

  return {
    id: selectedUser.id,
    name: selectedMember.nick || selectedUser.global_name || selectedUser.username || lookup,
  };
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

async function fetchChannelContext(
  env: Env,
  channelId: string,
  historyLimit: number,
  botUserId?: string,
  includeAssistantMessages = true
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
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

    if (!content || (isBot && !includeAssistantMessages)) {
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

async function editDiscordOriginalResponse(
  applicationId: string,
  interactionToken: string,
  content: string,
  allowedUserIds: string[] = []
): Promise<void> {
  const response = await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/cloudflare/workers-sdk, 1.0.0)',
    },
    body: JSON.stringify({
      content,
      allowed_mentions: {
        parse: [],
        users: allowedUserIds,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to edit Discord interaction response: ${response.status} ${await response.text()}`);
  }
}

async function handleDiscordSlashCommand(
  env: Env,
  interaction: DiscordInteraction,
  commandName: string,
  prompt: string,
  historyLimit: number,
  systemPrompt: string,
  includeAssistantHistory: boolean,
  speakingAs?: string
): Promise<void> {
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  const channelId = interaction.channel_id;
  const guildId = interaction.guild_id;

  let responseText = '';
  let mentionTarget: { id: string; name: string } | undefined;

  try {
    const tellRequest = extractTellRequest(prompt);
    if (tellRequest) {
      mentionTarget = await resolveMentionTarget(env, guildId, tellRequest.target);
    }

    const promptMessages = [
      { role: 'system' as const, content: systemPrompt },
    ];

    if (channelId && historyLimit > 0) {
      const historyMessages = await fetchChannelContext(env, channelId, historyLimit, undefined, includeAssistantHistory);
      promptMessages.push(...historyMessages);
    }

    promptMessages.push({
      role: 'user',
      content: mentionTarget
        ? `Write a message to ${mentionTarget.name}. Message request: ${tellRequest?.message || prompt}`
        : prompt,
    });

    responseText = await runGemma(env, promptMessages);
  } catch (error: any) {
    responseText = `⚠️ I hit an error while handling \`/${commandName}\`:\n\`\`\`\n${error?.message || String(error)}\n\`\`\``;
  }

  const trimmedResponse = responseText.trim();
  const responseWithMention = mentionTarget ? `<@${mentionTarget.id}> ${trimmedResponse}` : trimmedResponse;
  const responseWithSpeaker = speakingAs ? `**${speakingAs}:**\n${responseWithMention}` : responseWithMention;
  const finalText = trimmedResponse.length > 0
    ? responseWithSpeaker.length > 2000
      ? `${responseWithSpeaker.slice(0, 1995)}...`
      : responseWithSpeaker
    : "I processed your request but didn't generate any text. Please try again!";

  try {
    await editDiscordOriginalResponse(
      applicationId,
      interactionToken,
      finalText,
      mentionTarget ? [mentionTarget.id] : []
    );
  } catch (error) {
    console.error('Failed to edit Discord interaction response:', error);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const commandName = normalizeCommandName(env.DISCORD_COMMAND_NAME);
    const systemCommandName = normalizeCommandName(env.DISCORD_SYSTEM_COMMAND_NAME, DEFAULT_SYSTEM_COMMAND_NAME);
    const personalitiesCommandName = normalizeCommandName(
      env.DISCORD_PERSONALITIES_COMMAND_NAME,
      DEFAULT_PERSONALITIES_COMMAND_NAME
    );

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
              discordSystemCommandName: systemCommandName,
              discordPersonalitiesCommandName: personalitiesCommandName,
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
        const isChatCommand = receivedCommandName === commandName;
        const isSystemChatCommand = receivedCommandName === systemCommandName;
        const isPersonalitiesCommand = receivedCommandName === personalitiesCommandName;
        if (!isChatCommand && !isSystemChatCommand && !isPersonalitiesCommand) {
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

        if (isPersonalitiesCommand) {
          return new Response(
            JSON.stringify({
              type: DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE,
              data: {
                content: formatPersonalityList(commandName),
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
        const systemPromptOption = getOptionValue(commandOptions, 'system_prompt');
        const personalityOption = getOptionValue(commandOptions, 'personality');
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

        let systemPrompt = '';
        let speakingAs: string | undefined;
        if (isSystemChatCommand) {
          systemPrompt = typeof systemPromptOption === 'string' ? systemPromptOption.trim() : '';
          if (!systemPrompt) {
            return new Response(
              JSON.stringify({
                type: DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE,
                data: {
                  content: `The \`/${systemCommandName}\` command needs a \`system_prompt\` value.`,
                  flags: DISCORD_INTERACTION_FLAG_EPHEMERAL,
                },
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        } else {
          const selectedPersonality = findPersonality(personalityOption) || pickRandomPersonality();
          systemPrompt = withConciseInstruction(selectedPersonality.prompt);
          speakingAs = selectedPersonality.name;
        }

        const historyLimit = clampInt(historyOption, 15, 0, 100);
        const ephemeral = typeof ephemeralOption === 'boolean' ? ephemeralOption : false;

        ctx.waitUntil(
          handleDiscordSlashCommand(
            env,
            interaction,
            receivedCommandName,
            prompt,
            historyLimit,
            systemPrompt,
            !isSystemChatCommand,
            speakingAs
          )
        );

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
