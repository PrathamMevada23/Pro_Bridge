# @pro-bridge/conversation-parser

Provider-specific conversation DOM adapters for Pro_Bridge. Phase 3 implements ChatGPT;
Claude and Gemini adapters are planned for Phase 9.

## ChatGPT

`parseChatGptConversation({ document, url })` returns a `ParsedConversation` containing:

- the provider conversation ID from a `/c/<id>` or `/g/<gpt-id>/c/<id>` URL;
- the canonical conversation URL and cleaned page title;
- visible user, assistant and system messages in page order.

Message IDs use ChatGPT's `data-message-id` when present, then the conversation turn
`data-testid`, then a turn-index fallback. Messages with unknown roles or empty content are
skipped. Parsing throws `ConversationParseError` when the URL is not a saved ChatGPT
conversation or no visible messages are found.

The parser only reads the DOM. It never clicks, submits, edits or approves anything in the
ChatGPT UI. It captures messages currently rendered in the page, so older messages must be
loaded by scrolling before parsing a long conversation.

```ts
import { parseChatGptConversation } from '@pro-bridge/conversation-parser';

const conversation = parseChatGptConversation({
  document,
  url: window.location.href,
});
```

## Tests

```bash
pnpm --filter @pro-bridge/conversation-parser test
```

Tests use happy-dom fixtures and cover message extraction, role filtering, ID fallbacks,
custom GPT URLs and error cases.
