import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Pro_Bridge',
    description: 'Link ChatGPT, Claude, and Gemini conversations to a local Pro_Bridge project.',
    permissions: ['storage', 'activeTab'],
    host_permissions: [
      'http://127.0.0.1:4317/*',
      'http://localhost:4317/*',
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
    ],
  },
});
