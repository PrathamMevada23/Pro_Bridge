import { describe, expect, it } from 'vitest';
import { extractContext, normalizeTextForComparison } from '../src/index.js';

function message(content: string, sequence = 0, role: 'user' | 'assistant' = 'user') {
  return {
    id: `message-${sequence}`,
    role,
    content,
    sequence,
  };
}

describe('extractContext', () => {
  it('extracts explicit requirements, constraints, dependencies, decisions, tasks and questions', () => {
    const result = extractContext([
      message(
        [
          'The app must run offline.',
          'It must not call a cloud service.',
          'We decided to use SQLite because it is local-first.',
          'Add a health endpoint.',
          'Which database should we use?',
          'It depends on better-sqlite3.',
        ].join(' '),
      ),
    ]);

    expect(result.requirements).toEqual([
      expect.objectContaining({ kind: 'constraint', text: 'The app must run offline.' }),
      expect.objectContaining({
        kind: 'constraint',
        text: 'It must not call a cloud service.',
      }),
      expect.objectContaining({ kind: 'clarification', text: 'Which database should we use?' }),
      expect.objectContaining({
        kind: 'dependency',
        text: 'It depends on better-sqlite3.',
      }),
    ]);
    expect(result.decisions).toEqual([
      expect.objectContaining({
        text: 'We decided to use SQLite',
        rationale: 'it is local-first.',
      }),
    ]);
    expect(result.tasks).toEqual([
      expect.objectContaining({ title: 'Add a health endpoint.', description: '' }),
    ]);
  });

  it('uses Markdown headings to classify bullet lists', () => {
    const result = extractContext([
      message(
        [
          '## Requirements',
          '- Must support multiple projects',
          '- Should keep data local',
          '',
          '## Decisions',
          '- Use SQLite for storage',
          '',
          '## Tasks',
          '- Add migration tests',
          '',
          '## Open questions',
          '- Which provider should come next?',
        ].join('\n'),
      ),
    ]);

    expect(result.requirements.map((item) => [item.kind, item.text])).toEqual([
      ['requirement', 'Must support multiple projects'],
      ['requirement', 'Should keep data local'],
      ['clarification', 'Which provider should come next?'],
    ]);
    expect(result.decisions.map((item) => item.text)).toEqual(['Use SQLite for storage']);
    expect(result.tasks.map((item) => item.title)).toEqual(['Add migration tests']);
  });

  it('splits task titles from descriptions', () => {
    const result = extractContext([
      message('Implement the sync endpoint: accept batches of up to 1,000 messages'),
    ]);

    expect(result.tasks[0]).toMatchObject({
      title: 'Implement the sync endpoint',
      description: 'accept batches of up to 1,000 messages',
    });
  });

  it('deduplicates repeated items and keeps the first source message', () => {
    const result = extractContext([
      message('The API must authenticate every request.', 0),
      message('The API must authenticate every request.', 1, 'assistant'),
    ]);

    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0]).toMatchObject({
      text: 'The API must authenticate every request.',
      sourceMessageId: 'message-0',
      sourceSequence: 0,
    });
  });

  it('ignores code fences, headings and meta lines', () => {
    const result = extractContext([
      message(
        [
          '## Overview',
          'The following requirements describe the project.',
          '```ts',
          'const mustValidate = true;',
          '```',
          '## Requirements',
          '```',
          'must not be captured',
          '```',
        ].join('\n'),
      ),
    ]);

    expect(result).toEqual({ requirements: [], decisions: [], tasks: [] });
  });

  it('skips system messages and orders output by message sequence', () => {
    const result = extractContext([
      message('Add the second task.', 2),
      {
        id: 'system-message',
        role: 'system',
        content: 'The system must ignore this.',
        sequence: 1,
      },
      message('Add the first task.', 0),
    ]);

    expect(result.tasks.map((item) => item.title)).toEqual([
      'Add the first task.',
      'Add the second task.',
    ]);
    expect(result.requirements).toEqual([]);
  });

  it('normalizes text for duplicate comparisons', () => {
    expect(normalizeTextForComparison('  The API MUST validate input! ')).toBe(
      'the api must validate input',
    );
  });
});
