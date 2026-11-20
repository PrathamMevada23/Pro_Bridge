# @pro-bridge/context-engine

Deterministic, rule-based extraction of project context from captured conversations. The
engine recognizes explicit cues and common Markdown headings; it does not call a model and
does not approve anything.

## Extracted categories

- **Requirements** — explicit `must`, `should`, `shall`, `required`, `need to` statements.
- **Constraints** — prohibitions and limits such as `must not`, `cannot`, `only`, offline or
  local-only requirements.
- **Dependencies** — `depends on`, `built with`, package installs and similar cues.
- **Clarification questions** — questions that start with an interrogative word or contain
  explicit uncertainty cues.
- **Decisions** — `we decided`, `we'll use`, `chose`, `going with` and related phrases.
  A trailing `because` or `since` clause is stored as the decision rationale.
- **Tasks** — imperative lines such as `Add ...`, `Implement ...`, `Fix ...`, plus `TODO`,
  `Task` and `Action item` labels.

Markdown headings such as `## Requirements`, `## Constraints`, `## Decisions`, `## Tasks`
and `## Open questions` classify the bullet list below them. Fenced code blocks, table rows,
URLs, headings and short meta lines are ignored.

## Usage

```ts
import { extractContext } from '@pro-bridge/context-engine';

const result = extractContext([
  {
    id: 'message-id',
    role: 'user',
    content: 'The app must run offline. Add a health endpoint.',
    sequence: 0,
  },
]);

// result.requirements -> [{ kind: 'constraint', text: 'The app must run offline.', ... }]
// result.tasks        -> [{ title: 'Add a health endpoint.', description: '', ... }]
```

Extraction is idempotent within a single call: repeated text is emitted once, in message and
line order, and the first source message is retained. Callers can use
`normalizeTextForComparison` to deduplicate against already stored project items.

The engine returns suggestions only. Persistence, status changes and approval are handled by
the core API, which stores every extracted item as `proposed`.
