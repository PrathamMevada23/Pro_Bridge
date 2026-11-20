# Pro_Bridge Browser Extension

Chrome Manifest V3 extension for linking a ChatGPT conversation to a local Pro_Bridge
project, syncing its messages manually, and optionally keeping linked conversations in sync
automatically.

## Stack

- TypeScript
- WXT
- Chrome Manifest V3
- React popup UI
- `@pro-bridge/conversation-parser` for the ChatGPT DOM adapter

## Development

Start the core API first:

```bash
pnpm dev
```

Then run the extension in watch mode:

```bash
pnpm --filter @pro-bridge/extension dev
```

WXT writes a development build to `apps/extension/.output/chrome-mv3-dev`. Load it with
**Load unpacked** on `chrome://extensions`.

For a production-style unpacked build:

```bash
pnpm --filter @pro-bridge/extension build
# Load apps/extension/.output/chrome-mv3
```

To create a zip package:

```bash
pnpm --filter @pro-bridge/extension zip
```

## Usage

1. Open a saved ChatGPT conversation (`https://chatgpt.com/c/<id>`).
2. Open the popup and click the settings button.
3. Enter the local API URL and `PRO_BRIDGE_LOCAL_TOKEN`, then save.
4. Select a project and click **Link conversation**.
5. Click **Sync messages** for a full manual sync.
6. Click **Extract context** to create proposed requirements, decisions and tasks.
7. Optionally enable **Auto-sync this conversation**.

Linking is always manual. Auto-sync is opt-in per conversation and only runs after the
conversation has been linked to a project. The extension does not modify ChatGPT pages or
send data to any origin other than the configured local API.

## Automatic incremental sync

When auto-sync is enabled for a linked conversation:

1. The content script observes the ChatGPT DOM with a `MutationObserver` and debounces
   changes for 1.2 seconds.
2. It parses the conversation and messages the background worker only when the parsed
   content changed.
3. The background worker looks up the linked conversation, reads
   `GET /api/conversations/:conversationId/sync-status`, and sends the last two synced
   messages plus all newer messages.
4. The server compares content hashes, so re-sent messages catch edits and regenerated
   responses without duplicating rows.
5. The last result is stored under `proBridgeLastAutoSync` and shown in the popup.

Updates are queued and serialized per conversation. The auto-sync preference is stored under
`proBridgeAutoSyncKeys` in `browser.storage.local`.

Auto-sync is browser-driven: it only runs while the ChatGPT tab is open. Closing the tab
pauses automatic synchronization until the conversation is opened again. The two-message
overlap only detects recent edits; use **Sync messages** for a full manual reconciliation.

## Context extraction

**Extract context** calls
`POST /api/conversations/:conversationId/extract-context` for the linked conversation. The
core runs the deterministic extractor in `@pro-bridge/context-engine` and stores new
requirements, decisions and tasks as suggestions. The popup reports how many items were
created.

Extraction is manual and never approves suggestions. Existing items with the same normalized
text are skipped, so pressing the button again is safe. Use the core API to confirm, reject
or update the extracted items.

## Permissions

- `storage` — local API URL, token and per-conversation auto-sync preferences.
- `activeTab` — read the active ChatGPT tab.
- `https://chatgpt.com/*`, `https://chat.openai.com/*` — content script and conversation
  extraction.
- `http://127.0.0.1:4317/*`, `http://localhost:4317/*` — local API requests.

In production, add `chrome-extension://<extension-id>` to `PRO_BRIDGE_ALLOWED_ORIGINS`.

## Tests

```bash
pnpm --filter @pro-bridge/extension test
```
