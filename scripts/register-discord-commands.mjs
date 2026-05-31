import 'dotenv/config';

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const rawCommandName = process.env.DISCORD_COMMAND_NAME || 'gemma';
const commandName = rawCommandName
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '');
const commandDescription = process.env.DISCORD_COMMAND_DESCRIPTION || 'Ask Gemma a question';

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

const command = {
  name: commandName,
  description: commandDescription,
  type: 1,
  dm_permission: true,
  options: [
    {
      name: 'prompt',
      description: 'What you want Gemma to answer',
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
  body: JSON.stringify([command]),
});

if (!response.ok) {
  const errorText = await response.text();
  console.error(`Failed to register commands: ${response.status} ${errorText}`);
  process.exit(1);
}

const registeredCommands = await response.json();
console.log(`Registered ${Array.isArray(registeredCommands) ? registeredCommands.length : 0} slash command(s).`);
console.log(`Command name: /${commandName}`);
if (guildId) {
  console.log(`Scope: guild ${guildId}`);
} else {
  console.log('Scope: global');
  console.log('Global command propagation can take up to an hour.');
}
