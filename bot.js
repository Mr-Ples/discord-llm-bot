console.error(
  'The gateway bot has been retired. Use the Discord slash-command flow instead: /chat on your Cloudflare Worker.'
);
console.error('Register commands with: npm run register:commands');
process.exit(1);
