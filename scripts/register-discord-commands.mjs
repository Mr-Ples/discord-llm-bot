import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const rawCommandName = process.env.DISCORD_COMMAND_NAME || 'chat';
const rawSystemCommandName = process.env.DISCORD_SYSTEM_COMMAND_NAME || 'chat_system';
const rawPersonalitiesCommandName = process.env.DISCORD_PERSONALITIES_COMMAND_NAME || 'personalities';

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

function readPersonalityChoices(json) {
  return JSON.parse(json)
    .flatMap((personality) => {
      const name = typeof personality.name === 'string' ? personality.name.trim() : '';
      const rawValue = typeof personality.id === 'string' ? personality.id.trim() : '';
      const value = rawValue ? normalizePersonalityId(rawValue) : normalizePersonalityId(name);

      if (!name || !value) {
        return [];
      }

      return [{ name, value }];
    })
    .slice(0, 25);
}

const commandName = normalizeCommandName(rawCommandName);
const systemCommandName = normalizeCommandName(rawSystemCommandName);
const personalitiesCommandName = normalizeCommandName(rawPersonalitiesCommandName);
const commandDescription = process.env.DISCORD_COMMAND_DESCRIPTION || 'Chat with a prompted AI personality';
const systemCommandDescription = process.env.DISCORD_SYSTEM_COMMAND_DESCRIPTION || 'Chat with your own system prompt';
const personalitiesCommandDescription =
  process.env.DISCORD_PERSONALITIES_COMMAND_DESCRIPTION || 'List available AI personalities';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const personalitiesPath = path.resolve(__dirname, '..', 'personalities.json');
const personalityChoices = readPersonalityChoices(fs.readFileSync(personalitiesPath, 'utf8'));

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

if (!personalitiesCommandName || personalitiesCommandName.length > 32) {
  console.error('DISCORD_PERSONALITIES_COMMAND_NAME must resolve to a valid command name between 1 and 32 characters.');
  process.exit(1);
}

if (new Set([commandName, systemCommandName, personalitiesCommandName]).size !== 3) {
  console.error('DISCORD_COMMAND_NAME, DISCORD_SYSTEM_COMMAND_NAME, and DISCORD_PERSONALITIES_COMMAND_NAME must be different.');
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
    max_value: 300,
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

const personalitiesCommand = {
  name: personalitiesCommandName,
  description: personalitiesCommandDescription,
  type: 1,
  dm_permission: true,
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
  body: JSON.stringify([chatCommand, systemChatCommand, personalitiesCommand]),
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
console.log(`Personalities command name: /${personalitiesCommandName}`);
console.log(`Personality choices: ${personalityChoices.length}`);
if (guildId) {
  console.log(`Scope: guild ${guildId}`);
} else {
  console.log('Scope: global');
  console.log('Global command propagation can take up to an hour.');
}
