import type { MessageRole, RequirementKind } from '@pro-bridge/shared-types';

/**
 * Minimal message shape needed for extraction. The core API maps database rows to this
 * shape, keeping the engine independent of storage and transport concerns.
 */
export interface ContextMessage {
  id: string;
  role: MessageRole;
  content: string;
  sequence: number;
}

export interface ExtractedRequirement {
  kind: RequirementKind;
  text: string;
  sourceMessageId: string;
  sourceSequence: number;
}

export interface ExtractedDecision {
  text: string;
  rationale: string | null;
  sourceMessageId: string;
  sourceSequence: number;
}

export interface ExtractedTask {
  title: string;
  description: string;
  sourceMessageId: string;
  sourceSequence: number;
}

export interface ExtractedContext {
  requirements: ExtractedRequirement[];
  decisions: ExtractedDecision[];
  tasks: ExtractedTask[];
}

type Section = RequirementKind | 'decision' | 'task';
type Category = RequirementKind | 'decision' | 'task';

const MIN_TEXT_LENGTH = 8;
const MAX_TEXT_LENGTH = 1000;
const TASK_TITLE_LENGTH = 200;

const SECTION_PATTERNS: ReadonlyArray<readonly [RegExp, Section]> = [
  [/^(?:requirements?|functional requirements?|acceptance criteria|must haves?)$/i, 'requirement'],
  [/^(?:constraints?|limitations?|non-goals?|guardrails?|boundaries)$/i, 'constraint'],
  [/^(?:dependencies|dependency|tech stack|stack|libraries|packages|tools)$/i, 'dependency'],
  [/^(?:decisions?|architecture decisions?|design decisions?)$/i, 'decision'],
  [/^(?:tasks?|todo|to-do|next steps?|action items?|implementation plan|work items?)$/i, 'task'],
  [/^(?:open questions?|questions?|clarifications?|unknowns?|open issues?)$/i, 'clarification'],
];

const DECISION_PATTERNS: readonly RegExp[] = [
  /\bwe\s+(?:have\s+)?decided\b/i,
  /\bdecision\s*:/i,
  /\bwe(?:'ll|\s+will)\s+(?:use|adopt|go with|standardize on)\b/i,
  /\blet'?s\s+(?:use|adopt|go with)\b/i,
  /\b(?:i|we)\s+chose\b/i,
  /\bchosen\s+(?:approach|stack|option|design)\b/i,
  /\bgoing\s+with\b/i,
  /\bwe\s+agreed\b/i,
  /\bsettled\s+on\b/i,
];

const CONSTRAINT_PATTERNS: readonly RegExp[] = [
  /\b(?:must not|must never|should not|shouldn't|cannot|can't|do not|don't|never)\b/i,
  /\b(?:not allowed|prohibited|forbidden)\b/i,
  /\b(?:only|exclusively)\b/i,
  /\b(?:offline|local-only|privacy|security|budget|deadline)\b/i,
  /\b(?:limited to|at most|at least|no more than)\b/i,
  /\b(?:must|should)\s+(?:stay|remain|run)\s+(?:local|offline|on localhost)\b/i,
  /\bno\s+(?:external|cloud|network|public|third-party|additional|new)\b/i,
];

const DEPENDENCY_PATTERNS: readonly RegExp[] = [
  /\bdepends?\s+on\b/i,
  /\bdependenc(?:y|ies)\b/i,
  /\bbuilt\s+(?:with|on)\b/i,
  /\bpowered\s+by\b/i,
  /\b(?:pnpm|npm|yarn)\s+(?:add|install)\b/i,
  /\binstall(?:ed|ing)?\s+(?:the\s+)?[\w@/.-]+\s+(?:package|library)\b/i,
  /\b(?:uses|using)\s+(?:the\s+)?(?:package|library|framework)\b/i,
  /\brequires?\s+(?:the\s+)?(?:package|library|framework|dependency)\b/i,
];

const REQUIREMENT_PATTERNS: readonly RegExp[] = [
  /\b(?:must|should|shall)\b/i,
  /\b(?:required|requirement|requirements|acceptance criteria)\b/i,
  /\b(?:needs?|has|have)\s+to\b/i,
  /\b(?:needs?|requires?)\s+support\b/i,
];

const TASK_PATTERNS: readonly RegExp[] = [
  /^(?:please\s+)?(?:todo|to-do|task|action item)\s*:/i,
  /^(?:please\s+)?(?:implement|add|create|build|fix|update|refactor|write|remove|delete|migrate|configure|set up|ensure|test|document|review|verify|deploy|replace|rename|move|extract|store|persist|expose|support|handle|validate|return|use|install|upgrade|run|start|stop)\b/i,
  /^(?:i|we)(?:'ll|\s+will)\s+(?:add|implement|create|build|fix|update|refactor|write|remove|delete|migrate|configure|set up|ensure|test|document|review|verify|deploy|replace|rename|move|extract|store|persist|expose|support|handle|validate)\b/i,
];

const QUESTION_START_PATTERN =
  /^(?:what|which|how|when|where|who|why|should|do|does|did|can|could|would|will|is|are|was|were|may|might|has|have)\b/i;

const UNCERTAINTY_PATTERN =
  /\b(?:clarify|clarification|unclear|unknown|confirm|decide|open question)\b/i;

const META_LINE_PATTERN =
  /^(?:the following|below|here (?:are|is)|these (?:are|tasks|requirements)|this (?:section|document|plan)|overview|summary)\b/i;

const IGNORED_LINE_PATTERNS: readonly RegExp[] = [
  /^\|/,
  /^[-:| ]+$/,
  /^https?:\/\//i,
  /^```/,
  /^~~~$/,
  /^<[^>]+>$/,
  /^[-=]{3,}$/,
];

const CODE_LINE_PATTERN =
  /^(?:import|export|const|let|var|function|class|interface|type|enum|def|from|return|if|for|while|try|catch|await|async)\b/;

/**
 * Normalizes text for duplicate detection. Extraction is intentionally deterministic, so
 * callers can compare existing stored items with new candidates using this same function.
 */
export function normalizeTextForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_>#]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function matches(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isClarification(text: string): boolean {
  if (/\?\s*$/.test(text)) {
    return true;
  }

  return UNCERTAINTY_PATTERN.test(text) && QUESTION_START_PATTERN.test(text);
}

function classify(text: string): Category | null {
  if (isClarification(text)) {
    return 'clarification';
  }

  if (matches(DECISION_PATTERNS, text)) {
    return 'decision';
  }

  if (matches(CONSTRAINT_PATTERNS, text)) {
    return 'constraint';
  }

  if (matches(DEPENDENCY_PATTERNS, text)) {
    return 'dependency';
  }

  if (matches(REQUIREMENT_PATTERNS, text)) {
    return 'requirement';
  }

  if (matches(TASK_PATTERNS, text)) {
    return 'task';
  }

  return null;
}

function sectionForHeading(heading: string): Section | null {
  const normalized = heading.replace(/[*_`]/g, '').replace(/:\s*$/, '').trim();

  for (const [pattern, section] of SECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return section;
    }
  }

  return null;
}

function headingText(line: string): string | null {
  const markdownHeading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
  const boldHeading = line.match(/^\*\*(.+?)\*\*:?\s*$/);

  return markdownHeading?.[1] ?? boldHeading?.[1] ?? null;
}

function stripListMarker(line: string): string {
  let text = line.trim();

  text = text.replace(/^>\s*/, '');
  text = text.replace(/^[-*+]\s+/, '');
  text = text.replace(/^\d+[.)]\s+/, '');
  text = text.replace(/^\[[ xX]\]\s*/, '');
  text = text.replace(
    /^\*\*(?:requirement|constraint|dependency|decision|task|todo|question)\s*:?\*\*\s*:?\s*/i,
    '',
  );
  text = text.replace(
    /^(?:requirement|constraint|dependency|decision|task|todo|action item|q|question)\s*:\s*/i,
    '',
  );

  return text.replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'([])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function isUsefulText(text: string): boolean {
  if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH) {
    return false;
  }

  if (!/\p{L}/u.test(text)) {
    return false;
  }

  if (CODE_LINE_PATTERN.test(text) || /[{};]$/.test(text)) {
    return false;
  }

  return true;
}

function categoryFor(text: string, section: Section | null): Category | null {
  if (section === 'clarification') {
    return 'clarification';
  }

  const classified = classify(text);

  if (classified === 'clarification') {
    return 'clarification';
  }

  return section ?? classified;
}

function splitDecision(text: string): { text: string; rationale: string | null } {
  const match = text.match(/^(.*?)\s+(?:because|since)\s+(.+)$/i);
  const decisionText = match?.[1]?.trim();
  const rationale = match?.[2]?.trim();

  if (!decisionText || !rationale || decisionText.length < MIN_TEXT_LENGTH) {
    return { text, rationale: null };
  }

  return { text: decisionText, rationale };
}

function taskFields(text: string): { title: string; description: string } {
  const separated = text.match(/^(.{8,120}?)(?:\s+-\s+|\s*:\s+)(.{8,})$/);

  if (separated?.[1] && separated[2]) {
    return {
      title: separated[1].trim(),
      description: separated[2].trim(),
    };
  }

  if (text.length <= TASK_TITLE_LENGTH) {
    return { title: text, description: '' };
  }

  return {
    title: `${text.slice(0, TASK_TITLE_LENGTH - 3).trimEnd()}...`,
    description: text,
  };
}

/**
 * Extracts proposed requirements, decisions and tasks from captured messages.
 *
 * The extractor is deliberately rule-based and conservative: it recognizes explicit cues
 * and common Markdown section headings, never calls a model, and never approves anything.
 */
export function extractContext(messages: readonly ContextMessage[]): ExtractedContext {
  const requirements: ExtractedRequirement[] = [];
  const decisions: ExtractedDecision[] = [];
  const tasks: ExtractedTask[] = [];
  const seen = new Set<string>();

  const ordered = [...messages]
    .filter((message) => message.role !== 'system')
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));

  function addRequirement(kind: RequirementKind, text: string, message: ContextMessage): void {
    const key = `requirement:${kind}:${normalizeTextForComparison(text)}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    requirements.push({
      kind,
      text,
      sourceMessageId: message.id,
      sourceSequence: message.sequence,
    });
  }

  function addDecision(text: string, message: ContextMessage): void {
    const key = `decision:${normalizeTextForComparison(text)}`;

    if (seen.has(key)) {
      return;
    }

    const split = splitDecision(text);

    if (!isUsefulText(split.text)) {
      return;
    }

    seen.add(key);
    decisions.push({
      text: split.text,
      rationale: split.rationale,
      sourceMessageId: message.id,
      sourceSequence: message.sequence,
    });
  }

  function addTask(text: string, message: ContextMessage): void {
    const fields = taskFields(text);
    const key = `task:${normalizeTextForComparison(fields.title)}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    tasks.push({
      ...fields,
      sourceMessageId: message.id,
      sourceSequence: message.sequence,
    });
  }

  for (const message of ordered) {
    let section: Section | null = null;
    let inCodeFence = false;

    for (const rawLine of message.content.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (/^(?:```|~~~)/.test(line)) {
        inCodeFence = !inCodeFence;
        continue;
      }

      if (inCodeFence || line.length === 0) {
        continue;
      }

      const heading = headingText(line);

      if (heading !== null) {
        section = sectionForHeading(heading);
        continue;
      }

      if (
        META_LINE_PATTERN.test(line) ||
        IGNORED_LINE_PATTERNS.some((pattern) => pattern.test(line))
      ) {
        continue;
      }

      const isListItem = /^(?:[-*+]|\d+[.)])\s+/.test(line) || /^\[[ xX]\]\s+/.test(line);
      const cleaned = stripListMarker(line);

      if (!cleaned || cleaned.endsWith(':')) {
        continue;
      }

      const candidates = isListItem ? [cleaned] : splitSentences(cleaned);

      for (const candidate of candidates) {
        const text = stripListMarker(candidate);

        if (!isUsefulText(text)) {
          continue;
        }

        const category = categoryFor(text, section);

        if (category === null) {
          continue;
        }

        if (category === 'decision') {
          addDecision(text, message);
        } else if (category === 'task') {
          addTask(text, message);
        } else {
          addRequirement(category, text, message);
        }
      }
    }
  }

  return { requirements, decisions, tasks };
}
