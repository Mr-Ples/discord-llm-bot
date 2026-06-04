import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const rawCommandName = process.env.DISCORD_COMMAND_NAME || 'chat';
const rawSystemCommandName = process.env.DISCORD_SYSTEM_COMMAND_NAME || 'chat_system';

function normalizeCommandName(rawName) {
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePersonalityId(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parsePromptPersonalities(markdown) {
  const personalities = [];
  let currentName = '';
  let currentPromptLines = [];

  const flush = () => {
    const prompt = currentPromptLines.join('\n').trim();
    if (currentName && prompt) {
      personalities.push({
        name: currentName,
        value: normalizePersonalityId(currentName),
      });
    }
    currentName = '';
    currentPromptLines = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed || /^-{3,}$/.test(trimmed)) {
      continue;
    }

    const isHeading = !/^\s/.test(line) && (trimmed.endsWith(':') || /^The\b/.test(trimmed));
    if (isHeading) {
      flush();
      currentName = trimmed.replace(/:$/, '').trim();
      continue;
    }

    currentPromptLines.push(trimmed);
  }

  flush();
  return personalities.slice(0, 25);
}

const commandName = normalizeCommandName(rawCommandName);
const systemCommandName = normalizeCommandName(rawSystemCommandName);
const commandDescription = process.env.DISCORD_COMMAND_DESCRIPTION || 'Chat with a prompted AI personality';
const systemCommandDescription = process.env.DISCORD_SYSTEM_COMMAND_DESCRIPTION || 'Chat with your own system prompt';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsPath = path.resolve(__dirname, '..', 'prompts.md');
const personalityChoices = parsePromptPersonalities(fs.readFileSync(promptsPath, 'utf8'));

if (!token) {
  console.error('Missing DISCORD_TOKEN.');
  process.exit(1);
}

if (!applicationId) {
  console.error('Missing DISCORD_APPLICATION_ID.');
  process.exit(1);
}

if (!commandName || commandName.length > 32) {
  console.error('DISCORD_COMMAND_NAME must resolve to a valid command name between 1 and 32 characters.');
  process.exit(1);
}

if (!systemCommandName || systemCommandName.length > 32) {
  console.error('DISCORD_SYSTEM_COMMAND_NAME must resolve to a valid command name between 1 and 32 characters.');
  process.exit(1);
}

if (commandName === systemCommandName) {
  console.error('DISCORD_COMMAND_NAME and DISCORD_SYSTEM_COMMAND_NAME must be different.');
  process.exit(1);
}

const sharedOptions = [
  {
    name: 'prompt',
    description: 'What you want the AI to answer',
    type: 3,
    required: true,
  },
  {
    name: 'history',
    description: 'How many recent channel messages to include',
    type: 4,
    required: false,
    min_value: 0,
    max_value: 100,
  },
  {
    name: 'ephemeral',
    description: 'Only show the response to you',
    type: 5,
    required: false,
  },
];

const chatCommand = {
  name: commandName,
  description: commandDescription,
  type: 1,
  dm_permission: true,
  options: [
    sharedOptions[0],
    {
      name: 'personality',
      description: 'Use a specific personality instead of a random one',
      type: 3,
      required: false,
      choices: personalityChoices,
    },
    ...sharedOptions.slice(1),
  ],
};

const systemChatCommand = {
  name: systemCommandName,
  description: systemCommandDescription,
  type: 1,
  dm_permission: true,
  options: [
    sharedOptions[0],
    {
      name: 'system_prompt',
      description: 'System prompt to use for this chat',
      type: 3,
      required: true,
    },
    ...sharedOptions.slice(1),
  ],
};

const targetPath = guildId
  ? `/applications/${applicationId}/guilds/${guildId}/commands`
  : `/applications/${applicationId}/commands`;

const response = await fetch(`https://discord.com/api/v10${targetPath}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([chatCommand, systemChatCommand]),
});

if (!response.ok) {
  const errorText = await response.text();
  console.error(`Failed to register commands: ${response.status} ${errorText}`);
  process.exit(1);
}

const registeredCommands = await response.json();
console.log(`Registered ${Array.isArray(registeredCommands) ? registeredCommands.length : 0} slash command(s).`);
console.log(`Command name: /${commandName}`);
console.log(`System command name: /${systemCommandName}`);
console.log(`Personality choices: ${personalityChoices.length}`);
if (guildId) {
  console.log(`Scope: guild ${guildId}`);
} else {
  console.log('Scope: global');
  console.log('Global command propagation can take up to an hour.');
}
