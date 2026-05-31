import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Bot, 
  Cpu, 
  Terminal, 
  Settings, 
  Send, 
  Activity, 
  Layers, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Copy,
  Info,
  LogOut,
  Lock,
  UserCheck
} from 'lucide-react';

const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:8787' 
  : window.location.origin;

interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

// Navigation Sidebar
function Sidebar({ user, onLogout }: { user: UserProfile | null; onLogout: () => void }) {
  const location = useLocation();
  
  const links = [
    { to: '/', label: 'Overview', icon: Bot },
    { to: '/console', label: 'Test Console', icon: Terminal },
    { to: '/config', label: 'Setup Guide', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#1e1f22] border-r border-[#2b2d31] flex flex-col h-screen shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#2b2d31] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-discord-blurple to-indigo-400 flex items-center justify-center text-white shadow-lg glow-blurple">
          <Bot size={22} className="animate-pulse-slow" />
        </div>
        <div>
          <h1 className="font-semibold text-white tracking-wide font-sans text-sm">GEMMA BOT</h1>
          <span className="text-[10px] text-discord-blurple font-bold uppercase tracking-wider">AI Assistant</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-discord-blurple text-white shadow-md glow-blurple' 
                  : 'text-slate-400 hover:bg-[#2b2d31] hover:text-slate-100'
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User Session Info & Logout */}
      {user && (
        <div className="p-4 border-t border-[#2b2d31] bg-[#1a1b1e] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-[#2b2d31]" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-discord-blurple/20 flex items-center justify-center text-discord-blurple font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate">{user.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-discord-red hover:bg-discord-red/10 rounded-lg transition-all"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-[#2b2d31] text-[11px] text-slate-600 text-center flex flex-col gap-0.5">
        <span>Powered by Cloudflare Workers AI</span>
        <span>Google Gemma 2 9B</span>
      </div>
    </aside>
  );
}

// Header
interface HeaderProps {
  status: any;
  loading: boolean;
  onRefresh: () => void;
}

function Header({ status, loading, onRefresh }: HeaderProps) {
  return (
    <header className="h-16 bg-[#1a1b1e] border-b border-[#2b2d31] flex items-center justify-between px-8">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-400">Backend System Status:</span>
        {loading ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium">
            <RefreshCw size={12} className="animate-spin" />
            Checking...
          </span>
        ) : status?.status === 'online' ? (
          <span className="flex items-center gap-1.5 text-xs text-discord-green bg-discord-green/10 px-2.5 py-1 rounded-full border border-discord-green/20 font-medium relative">
            <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-ping absolute left-2.5" />
            <span className="w-1.5 h-1.5 rounded-full bg-discord-green" />
            Online
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-discord-red bg-discord-red/10 px-2.5 py-1 rounded-full border border-discord-red/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-discord-red" />
            Offline
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-slate-400 font-medium">Active AI Model</div>
          <div className="text-xs text-slate-200 font-semibold">{status?.model || 'Gemma 2 9B'}</div>
        </div>
        <button 
          onClick={onRefresh}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#2b2d31] rounded-lg transition-all"
          title="Refresh Status"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </header>
  );
}

// Overview
function Overview({ status }: { status: any }) {
  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-discord-blurple/20 via-indigo-950/20 to-[#1e1f22] border border-[#2b2d31] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-4 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-discord-blurple/15 border border-discord-blurple/30 text-discord-blurple text-xs font-semibold">
            <Sparkles size={12} />
            Edge AI Powered
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white font-sans tracking-tight">
            Google Gemma Discord Bot
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            A state-of-the-art conversational Discord assistant powered by Cloudflare Workers AI. 
            The bot reads the message history context in channels and threads (capped for latency and cost) 
            to respond intelligently whenever tagged.
          </p>
        </div>
        <div className="shrink-0 w-32 h-32 rounded-2xl bg-[#232428] border border-[#2b2d31] flex items-center justify-center glow-blurple">
          <Cpu size={64} className="text-discord-blurple animate-pulse-slow" />
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-xl p-6 space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Workers AI</span>
            <Cpu size={16} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Gemma-2-9b-it</h3>
          <p className="text-xs text-slate-400">
            Running Google Gemma instruction-tuned model directly at Cloudflare's network edge.
          </p>
          <div className="flex items-center gap-2 pt-2 text-xs font-semibold">
            <span className={status?.config?.workersAIConfigured ? "text-discord-green animate-pulse" : "text-discord-red"}>
              {status?.config?.workersAIConfigured ? "● Binding Connected" : "○ Missing Binding"}
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6 space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Discord Interactions</span>
            <Activity size={16} className="text-discord-green" />
          </div>
          <h3 className="text-lg font-bold text-white">Slash Command Endpoint</h3>
          <p className="text-xs text-slate-400">
            Verifies Discord interactions, optionally fetches channel history, and replies through the webhook response path.
          </p>
          <div className="flex items-center gap-2 pt-2 text-xs font-semibold">
            <span className={status?.config?.discordPublicKeyConfigured ? "text-discord-green" : "text-discord-red"}>
              {status?.config?.discordPublicKeyConfigured ? "● Public Key Configured" : "○ Public Key Missing"}
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6 space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Worker Latency</span>
            <Layers size={16} className="text-discord-yellow" />
          </div>
          <h3 className="text-lg font-bold text-white">Edge Execution</h3>
          <p className="text-xs text-slate-400">
            Zero-cold-start serverless API returning structured replies with a customizable message cap.
          </p>
          <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
            <span>Context Capped: 15 messages</span>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1e1f22] rounded-xl p-6 border border-[#2b2d31] space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Info size={16} className="text-discord-blurple" /> How it Works
          </h3>
          <ul className="space-y-3 text-xs text-slate-400">
            <li className="flex gap-2">
              <ChevronRight size={14} className="shrink-0 text-discord-blurple mt-0.5" />
              <span><strong>Slash Command:</strong> When users run <code>/gemma prompt:...</code>, Discord sends an interaction to your Worker.</span>
            </li>
            <li className="flex gap-2">
              <ChevronRight size={14} className="shrink-0 text-discord-blurple mt-0.5" />
              <span><strong>Context Fetching:</strong> The Worker can pull the last 15 channel messages over the Discord REST API for extra context.</span>
            </li>
            <li className="flex gap-2">
              <ChevronRight size={14} className="shrink-0 text-discord-blurple mt-0.5" />
              <span><strong>Edge Inference:</strong> The Worker forwards the prompt and context to `/api/chat`, which queries Google Gemma.</span>
            </li>
            <li className="flex gap-2">
              <ChevronRight size={14} className="shrink-0 text-discord-blurple mt-0.5" />
              <span><strong>Discord Response:</strong> The Worker defers the interaction, then edits the original slash-command reply when the model finishes.</span>
            </li>
          </ul>
        </div>

        <div className="bg-[#1e1f22] rounded-xl p-6 border border-[#2b2d31] flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal size={16} className="text-discord-green" /> Discord REST Quick Test
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Want to make sure your Worker can still send REST messages to Discord? Use the Test Console to push a custom text notification directly to a server channel.
            </p>
          </div>
          <Link
            to="/console"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-discord-blurple hover:bg-indigo-600 text-white font-medium text-xs shadow-md glow-blurple transition-all duration-200"
          >
            Open Test Console
            <Send size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// Test Console
function TestConsole() {
  const [channelId, setChannelId] = useState('');
  const [message, setMessage] = useState('Hello from the Gemma Bot Dashboard! 🚀');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [responseLog, setResponseLog] = useState<string[]>([]);

  const addLog = (text: string) => {
    setResponseLog((prev) => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId.trim() || !message.trim()) return;

    setStatus('sending');
    addLog(`Initiating test send to channel ${channelId}...`);

    try {
      const res = await fetch(`${API_BASE}/api/test-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelId, message }),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to send message');
      }

      setStatus('success');
      addLog(`Success! Message delivered. Message ID: ${data.messageId}`);
    } catch (error: any) {
      setStatus('error');
      addLog(`Error: ${error.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Interactive Test Console</h2>
        <p className="text-slate-400 text-xs">Verify your bot's authorization and manually send messages directly to your servers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Card */}
        <div className="glass-panel rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-semibold text-white">Trigger Discord Message</h3>
          
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="channel-id" className="text-xs font-semibold text-slate-400">
                Discord Channel ID
              </label>
              <input
                id="channel-id"
                type="text"
                placeholder="e.g. 122456789012345678"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                required
                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-lg px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-discord-blurple focus:ring-1 focus:ring-discord-blurple transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="message-content" className="text-xs font-semibold text-slate-400">
                Message Content
              </label>
              <textarea
                id="message-content"
                rows={4}
                placeholder="Type the message you want to send..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-lg px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-discord-blurple focus:ring-1 focus:ring-discord-blurple transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-discord-blurple hover:bg-indigo-600 disabled:bg-discord-blurple/50 text-white font-semibold text-xs shadow-md glow-blurple transition-all"
            >
              {status === 'sending' ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Sending Message...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Send Test Message
                </>
              )}
            </button>
          </form>

          {/* Form Status Banner */}
          {status === 'success' && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-discord-green/10 border border-discord-green/20 text-discord-green text-xs">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Message sent successfully!</span> Check the specified Discord channel to see the bot response.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-discord-red/10 border border-discord-red/20 text-discord-red text-xs">
              <XCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Failed to send message.</span> Ensure your <code>DISCORD_TOKEN</code> is valid and the bot has permission to post in that channel.
              </div>
            </div>
          )}
        </div>

        {/* Logs Card */}
        <div className="bg-[#1e1f22] rounded-xl p-6 border border-[#2b2d31] flex flex-col h-[350px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-2">
              <Terminal size={14} className="text-discord-green" /> Console Output Log
            </h3>
            <button 
              onClick={() => setResponseLog([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-semibold"
            >
              Clear Log
            </button>
          </div>
          <div className="flex-1 bg-[#151618] border border-[#2b2d31] rounded-lg p-4 font-mono text-[11px] text-slate-300 overflow-y-auto space-y-2.5 select-text">
            {responseLog.length === 0 ? (
              <span className="text-slate-600 italic">No events logged yet. Trigger a send to see console outputs.</span>
            ) : (
              responseLog.map((log, index) => (
                <div 
                  key={index}
                  className={
                    log.includes('Success') ? 'text-discord-green' : 
                    log.includes('Error') ? 'text-discord-red' : 
                    'text-slate-400'
                  }
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Setup Guide
function SetupGuide({ status }: { status: any }) {
  const [clientId, setClientId] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    if (clientId.trim()) {
      const url = `https://discord.com/oauth2/authorize?client_id=${clientId.trim()}&permissions=68608&scope=bot%20applications.commands`;
      setInviteUrl(url);
    } else {
      setInviteUrl('');
    }
  }, [clientId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Slash Command Setup Guide</h2>
        <p className="text-slate-400 text-xs">Steps to register, authorize, and run your Google Gemma Discord Bot.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step-by-step Setup */}
        <div className="space-y-6">
          <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-discord-blurple/20 text-discord-blurple text-xs flex items-center justify-center font-bold">1</span>
              Register Discord Application
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-discord-blurple hover:underline inline-flex items-center gap-0.5">Discord Developer Portal <ExternalLink size={10} /></a>. 
              Click <strong>New Application</strong>, choose a name, and go to the <strong>Bot</strong> tab. Click <strong>Add Bot</strong>.
            </p>
            <div className="p-3 bg-[#151618] border border-[#2b2d31] rounded-lg space-y-2">
              <span className="text-[10px] font-bold text-discord-yellow uppercase tracking-wider block">Important Settings:</span>
              <ul className="list-disc pl-4 text-[11px] text-slate-400 space-y-1">
                <li>Copy the <strong>Bot Token</strong>. You will use it for REST history fetches and the one-time slash-command registration script.</li>
                <li>Copy the <strong>Application ID</strong> and <strong>Public Key</strong>. The Application ID is used for command registration; the Public Key is used by the Worker to verify Discord interactions.</li>
                <li>You do <strong>not</strong> need Message Content Intent for slash commands.</li>
              </ul>
            </div>
          </div>

          <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-discord-blurple/20 text-discord-blurple text-xs flex items-center justify-center font-bold">2</span>
              Generate Invite URL
            </h3>
            <p className="text-xs text-slate-400">
              Paste your application's <strong>Client ID</strong> (found in the General Information tab) to generate the authorization link.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Paste Application Client ID here..."
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-[#151618] border border-[#2b2d31] rounded-lg px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-discord-blurple"
              />
              {inviteUrl && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="flex-1 bg-[#151618]/50 border border-[#2b2d31] rounded-lg px-3 py-2 text-[10px] text-slate-400 font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(inviteUrl)}
                    className="px-3 bg-discord-blurple hover:bg-indigo-600 text-white rounded-lg flex items-center justify-center transition-all"
                    title="Copy to Clipboard"
                  >
                    <Copy size={14} />
                  </button>
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 bg-[#2b2d31] hover:bg-[#383a40] text-slate-200 rounded-lg flex items-center justify-center border border-[#2b2d31]"
                    title="Open Invite Link"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Environment Configuration */}
        <div className="space-y-6">
          <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-discord-blurple/20 text-discord-blurple text-xs flex items-center justify-center font-bold">3</span>
              Worker Configuration
            </h3>
            <p className="text-xs text-slate-400">
              For local development, create a <code>.dev.vars</code> file in the root directory:
            </p>
            <pre className="p-4 bg-[#151618] border border-[#2b2d31] rounded-lg font-mono text-[10px] text-slate-300 overflow-x-auto">
{`# .dev.vars
DISCORD_TOKEN="your_bot_token"
DISCORD_PUBLIC_KEY="your_discord_public_key"
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
ALLOWED_EMAILS="your.email@gmail.com,another@gmail.com"
DISCORD_COMMAND_NAME="gemma"`}
            </pre>
            <p className="text-xs text-slate-400">
              To upload secrets to your Cloudflare Worker production deployment:
            </p>
            <pre className="p-3 bg-[#151618] border border-[#2b2d31] rounded-lg font-mono text-[10px] text-slate-300 space-y-1">
              <div>npx wrangler secret put DISCORD_TOKEN</div>
              <div>npx wrangler secret put DISCORD_PUBLIC_KEY</div>
              <div>npx wrangler secret put GOOGLE_CLIENT_ID</div>
              <div>npx wrangler secret put ALLOWED_EMAILS</div>
            </pre>
          </div>

          <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-discord-blurple/20 text-discord-blurple text-xs flex items-center justify-center font-bold">4</span>
              Register Slash Commands
            </h3>
            <p className="text-xs text-slate-400">
              Create a <code>.env</code> file in the root directory for the one-time command registration script:
            </p>
            <pre className="p-4 bg-[#151618] border border-[#2b2d31] rounded-lg font-mono text-[10px] text-slate-300 overflow-x-auto">
{`# .env
DISCORD_TOKEN="your_bot_token"
DISCORD_APPLICATION_ID="your_application_id"
DISCORD_COMMAND_NAME="gemma"
# Optional: register faster in a single guild while testing
DISCORD_GUILD_ID="your_guild_id"`}
            </pre>
            <p className="text-xs text-slate-400">
              Register or refresh the slash command definition:
            </p>
            <pre className="p-3 bg-[#151618] border border-[#2b2d31] rounded-lg font-mono text-[10px] text-slate-300">
npm run register:commands
            </pre>
            <p className="text-xs text-slate-400">
              Set your Discord application's <strong>Interactions Endpoint URL</strong> to your Worker route, typically <code>https://your-worker.workers.dev/api/discord/interactions</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Google Login Screen component
interface LoginScreenProps {
  status: any;
  loading: boolean;
  onBypass: () => void;
  onLoginStart: () => void;
  verifying: boolean;
  error: string;
}

function LoginScreen({ status, loading, onBypass, onLoginStart, verifying, error }: LoginScreenProps) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="min-screen w-screen h-screen flex items-center justify-center bg-[#141517] relative overflow-hidden select-none">
      {/* Decorative animated glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-discord-blurple/10 blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      <div className="w-full max-w-md p-8 rounded-2xl glass-panel text-center space-y-6 z-10 glow-blurple relative">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-discord-blurple to-indigo-400 flex items-center justify-center text-white shadow-xl glow-blurple mb-2">
            <Bot size={36} className="animate-pulse-slow" />
          </div>
          <h2 className="text-2xl font-bold text-white font-sans tracking-tight">Gemma Control Center</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
            A secured configuration dashboard for your Google Gemma edge-inferred Discord bot.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-discord-red/10 border border-discord-red/20 rounded-xl text-discord-red text-xs flex gap-2 items-start justify-center">
            <XCircle size={16} className="shrink-0 mt-0.5" />
            <div className="text-left font-medium">{error}</div>
          </div>
        )}

        {status?.config?.googleAuthConfigured === false && (
          <div className="p-3.5 bg-discord-yellow/10 border border-discord-yellow/20 rounded-xl text-discord-yellow text-xs flex gap-2.5 items-start text-left">
            <Info size={18} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Google Auth Unconfigured</span>
              Please add your <code>GOOGLE_CLIENT_ID</code> inside the Cloudflare Worker to enable OAuth Sign-In.
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {status?.config?.googleAuthConfigured && (
            <button
              onClick={onLoginStart}
              disabled={verifying || loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 disabled:bg-slate-200 text-slate-800 font-semibold text-sm shadow-lg transition-all duration-200"
            >
              {verifying ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-slate-600" />
                  Verifying account...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
          )}

          {/* Admin bypass — backend still enforces email whitelist */}
          <button
            onClick={onBypass}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2b2d31] hover:bg-[#383a40] text-slate-300 font-semibold text-sm border border-[#383a40] transition-all"
          >
            <UserCheck size={16} className="text-discord-green" />
            Continue as Admin
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 pt-2 border-t border-[#2b2d31]">
          <Lock size={12} className="text-slate-600" />
          <span>
            {status?.config?.whitelistActive 
              ? "Access restricted to whitelisted accounts." 
              : "Google Login portal active."}
          </span>
        </div>
      </div>
    </div>
  );
}

// App Wrapper
export default function App() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  
  // Auth states
  const [verifyingAuth, setVerifyingAuth] = useState(false);
  const [authError, setAuthError] = useState('');

  // Fetch status of the backend
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error("Worker status offline or inaccessible.", e);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Check saved user session
  useEffect(() => {
    fetchStatus();
    const savedUser = localStorage.getItem('gemma_bot_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Handle Google Login Callback (extract token from hash redirection)
  useEffect(() => {
    const hash = window.location.hash;
    // We search the entire URL string for access_token parameter
    const hashParams = new URLSearchParams(hash.replace(/^#\/?/, ''));
    const accessToken = hashParams.get('access_token');
    
    // Also check query params just in case of different routing configuration
    const queryParams = new URLSearchParams(window.location.search);
    const queryAccessToken = queryParams.get('access_token');

    const token = accessToken || queryAccessToken;

    if (token) {
      // Clean URL hash parameters to preserve neat routing
      window.location.hash = '';
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      
      verifyTokenWithBackend(token);
    }
  }, []);

  const verifyTokenWithBackend = async (token: string) => {
    setVerifyingAuth(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/verify-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json() as any;
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate.');
      }
      
      localStorage.setItem('gemma_bot_user', JSON.stringify(data.user));
      localStorage.setItem('gemma_bot_token', token);
      setUser(data.user);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setVerifyingAuth(false);
    }
  };

  const handleLoginStart = () => {
    if (!status?.config?.googleClientId) {
      setAuthError('Google Client ID is missing on the server.');
      return;
    }

    const clientId = status.config.googleClientId;
    const redirectUri = window.location.origin + window.location.pathname;
    
    // Direct Google Implicit OAuth flow link
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=email%20profile`;
    
    window.location.href = oauthUrl;
  };

  const handleDevBypass = () => {
    const demoUser = {
      email: 'dev@localhost',
      name: 'Developer Bypass',
      picture: ''
    };
    localStorage.setItem('gemma_bot_user', JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('gemma_bot_user');
    localStorage.removeItem('gemma_bot_token');
    setUser(null);
  };

  // If not logged in, show login portal
  if (!user) {
    return (
      <LoginScreen
        status={status}
        loading={loading}
        onBypass={handleDevBypass}
        onLoginStart={handleLoginStart}
        verifying={verifyingAuth}
        error={authError}
      />
    );
  }

  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-[#1a1b1e] text-slate-100 font-sans select-none">
        <Sidebar user={user} onLogout={handleLogout} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header status={status} loading={loading} onRefresh={fetchStatus} />
          
          <main className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto select-none">
            <Routes>
              <Route path="/" element={<Overview status={status} />} />
              <Route path="/console" element={<TestConsole />} />
              <Route path="/config" element={<SetupGuide status={status} />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
