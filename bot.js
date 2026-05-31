import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const workerApiUrl = (process.env.WORKER_API_URL || 'https://gemma-discord-worker.sidenotes.workers.dev').replace(/\/$/, '');
const messageCap = parseInt(process.env.MESSAGE_CAP || '15', 10);

if (!token) {
  console.error('❌ Error: DISCORD_TOKEN is not defined in the environment variables.');
  console.error('Please create a .env file with your Discord Bot Token.');
  process.exit(1);
}

// Initialize the Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}!`);
  console.log(`⚡ Connected to Discord Gateway`);
  console.log(`🔗 Worker API Target: ${workerApiUrl}`);
  console.log(`📊 Message Context Cap: ${messageCap} messages`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if this bot was mentioned
  const isMentioned = message.mentions.has(client.user) || message.content.includes(`<@${client.user.id}>`);

  if (!isMentioned) return;

  console.log(`💬 Mentioned by ${message.author.username} in #${message.channel.name || 'Thread'}`);

  try {
    // Show typing status on Discord while we process
    await message.channel.sendTyping();

    // Fetch channel history
    const fetched = await message.channel.messages.fetch({ limit: messageCap });
    const messageList = Array.from(fetched.values()).reverse();

    // System prompt setup
    const promptMessages = [
      {
        role: 'system',
        content: `You are a helpful, smart, and friendly Discord bot named Gemma. 
You are powered by the Google Gemma-2-9b-it model running on Cloudflare Workers AI. 
You are chatting in a Discord server channel or thread. Keep your responses engaging, clear, and well-formatted in Discord markdown. 
Ensure you directly address the queries from users in a conversational manner. Keep replies relatively concise.`,
      },
    ];

    // Format message history
    for (const msg of messageList) {
      // Ignore system messages
      if (msg.system) continue;

      const isBot = msg.author.id === client.user.id;
      const role = isBot ? 'assistant' : 'user';

      // Clean the content (strip out the bot mention text)
      let cleanContent = msg.content
        .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
        .trim();

      // If the content is empty (e.g. was just the mention or an image) and it's not a bot message, skip or use fallback
      if (!cleanContent) {
        if (!isBot) continue;
        cleanContent = "Hello!";
      }

      promptMessages.push({
        role: role,
        content: isBot ? cleanContent : `${msg.author.username}: ${cleanContent}`,
      });
    }

    console.log(`🧠 Sending context of ${promptMessages.length - 1} messages to Cloudflare Worker AI...`);

    // Fetch response from Cloudflare Worker
    const response = await fetch(`${workerApiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: promptMessages }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudflare Worker returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let replyText = data.response;

    if (!replyText || replyText.trim().length === 0) {
      replyText = "I processed your request but didn't generate any text. Please try again!";
    }

    // Split or truncate if it exceeds Discord's 2000 character limit
    if (replyText.length > 2000) {
      console.log(`⚠️ Warning: Response length (${replyText.length}) exceeds 2000 chars. Truncating...`);
      replyText = replyText.substring(0, 1995) + '...';
    }

    // Reply to the user's message
    await message.reply({
      content: replyText,
      allowedMentions: { repliedUser: true },
    });

    console.log(`✅ Replied successfully`);
  } catch (error) {
    console.error('❌ Error handling message:', error);
    try {
      await message.reply(`⚠️ Sorry, I encountered an error processing that request:\n\`\`\`\n${error.message}\n\`\`\``);
    } catch (replyErr) {
      console.error('Failed to send error reply:', replyErr);
    }
  }
});

// Login to Discord
client.login(token);
