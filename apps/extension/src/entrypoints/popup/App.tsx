import { isSupportedConversationUrl } from '@pro-bridge/conversation-parser';
import type {
  Conversation,
  ConversationProvider,
  ParsedConversation,
  Project,
} from '@pro-bridge/shared-types';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { ProBridgeClient } from '../../lib/api.js';
import type { LastAutoSync } from '../../lib/auto-sync.js';
import {
  isAutoSyncEnabled,
  LAST_AUTO_SYNC_STORAGE_KEY,
  loadLastAutoSync,
  setAutoSyncEnabled,
} from '../../lib/auto-sync-storage.js';
import {
  GET_CONVERSATION,
  parseGetConversationResponse,
  type GetConversationRequest,
} from '../../lib/messages.js';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type ExtensionSettings,
} from '../../lib/settings.js';

type Status =
  { kind: 'idle' } | { kind: 'info'; message: string } | { kind: 'error'; message: string };

type StorageChangeListener = Parameters<typeof browser.storage.onChanged.addListener>[0];

function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 'an unknown time' : date.toLocaleTimeString();
}

function providerDisplayName(provider: ConversationProvider): string {
  switch (provider) {
    case 'chatgpt':
      return 'ChatGPT';
    case 'claude':
      return 'Claude';
    case 'gemini':
      return 'Gemini';
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes('Receiving end does not exist') ||
      error.message.includes('Could not establish connection')
    ) {
      return 'Reload the conversation tab after installing or updating the extension, then try again.';
    }

    return error.message;
  }

  return 'Something went wrong.';
}

function createClient(settings: ExtensionSettings): ProBridgeClient {
  return new ProBridgeClient({
    baseUrl: settings.apiBaseUrl,
    token: settings.token,
  });
}

async function findConversationTab(): Promise<{ id: number; url: string } | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (typeof tab?.id !== 'number' || !tab.url || !isSupportedConversationUrl(tab.url)) {
    return null;
  }

  return { id: tab.id, url: tab.url };
}

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [snapshot, setSnapshot] = useState<ParsedConversation | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(false);
  const [lastAutoSync, setLastAutoSync] = useState<LastAutoSync | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    const listener: StorageChangeListener = (changes, areaName) => {
      if (areaName !== 'local' || !changes[LAST_AUTO_SYNC_STORAGE_KEY]) {
        return;
      }

      void loadLastAutoSync().then(setLastAutoSync);
    };

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  async function initialize(): Promise<void> {
    const stored = await loadSettings();
    setSettings(stored);
    setDraftSettings(stored);
    setSettingsOpen(stored.token.length === 0);
    setSettingsLoaded(true);
    setLastAutoSync(await loadLastAutoSync());

    const tab = await findConversationTab();

    if (!tab) {
      setStatus({
        kind: 'info',
        message: 'Open a saved ChatGPT, Claude, or Gemini conversation to begin.',
      });
      return;
    }

    await refreshFromTab(tab.id, stored);
  }

  async function refreshFromTab(id: number, currentSettings: ExtensionSettings): Promise<void> {
    setBusy(true);
    setStatus({ kind: 'idle' });

    try {
      const response = await browser.tabs.sendMessage<GetConversationRequest, unknown>(id, {
        type: GET_CONVERSATION,
      });
      const parsed = parseGetConversationResponse(response);

      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      setSnapshot(parsed.conversation);
      setAutoSyncEnabledState(
        await isAutoSyncEnabled(
          parsed.conversation.provider,
          parsed.conversation.providerConversationId,
        ),
      );

      if (currentSettings.token.length === 0) {
        setProjects([]);
        setConversation(null);
        return;
      }

      try {
        const client = createClient(currentSettings);
        const [loadedProjects, linkedConversation] = await Promise.all([
          client.listProjects(),
          client.findConversation(
            parsed.conversation.provider,
            parsed.conversation.providerConversationId,
          ),
        ]);

        setProjects(loadedProjects);
        setConversation(linkedConversation);

        if (linkedConversation?.projectId) {
          setProjectId(linkedConversation.projectId);
        } else if (loadedProjects.length === 1) {
          setProjectId(loadedProjects[0]?.id ?? '');
        }
      } catch (clientError) {
        setProjects([]);
        setConversation(null);
        setStatus({ kind: 'error', message: errorMessage(clientError) });
      }
    } catch (error) {
      setSnapshot(null);
      setConversation(null);
      setAutoSyncEnabledState(false);
      setStatus({ kind: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh(): Promise<void> {
    const tab = await findConversationTab();

    if (!tab) {
      setSnapshot(null);
      setConversation(null);
      setAutoSyncEnabledState(false);
      setStatus({
        kind: 'info',
        message: 'Open a saved ChatGPT, Claude, or Gemini conversation to begin.',
      });
      return;
    }

    await refreshFromTab(tab.id, settings);
  }

  async function handleSaveSettings(): Promise<void> {
    setBusy(true);
    setStatus({ kind: 'idle' });

    try {
      const saved = await saveSettings(draftSettings);
      setSettings(saved);
      setDraftSettings(saved);
      setSettingsOpen(false);
      setStatus({ kind: 'info', message: 'Settings saved.' });

      const tab = await findConversationTab();

      if (tab) {
        await refreshFromTab(tab.id, saved);
      }
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleLink(): Promise<void> {
    if (!snapshot) {
      return;
    }

    if (projectId.length === 0) {
      setStatus({ kind: 'error', message: 'Select a project first.' });
      return;
    }

    setBusy(true);
    setStatus({ kind: 'idle' });

    try {
      const result = await createClient(settings).linkConversation(snapshot, projectId);
      setConversation(result.conversation);
      setStatus({
        kind: 'info',
        message: result.created ? 'Conversation linked.' : 'Conversation link updated.',
      });
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSync(): Promise<void> {
    if (!snapshot || !conversation) {
      return;
    }

    setBusy(true);
    setStatus({ kind: 'idle' });

    try {
      const summary = await createClient(settings).syncMessages(conversation.id, snapshot.messages);
      setStatus({
        kind: 'info',
        message: `Synced ${summary.receivedMessages} messages (${summary.createdMessages} new, ${summary.updatedMessages} updated).`,
      });
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleExtract(): Promise<void> {
    if (!conversation) {
      return;
    }

    setBusy(true);
    setStatus({ kind: 'idle' });

    try {
      const result = await createClient(settings).extractContext(conversation.id);
      const created = result.requirementsCreated + result.decisionsCreated + result.tasksCreated;

      setStatus({
        kind: 'info',
        message:
          created === 0
            ? 'No new context items found.'
            : `Extracted ${result.requirementsCreated} requirements, ${result.decisionsCreated} decisions and ${result.tasksCreated} tasks.`,
      });
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAutoSync(enabled: boolean): Promise<void> {
    if (!snapshot) {
      return;
    }

    setAutoSyncEnabledState(enabled);

    try {
      await setAutoSyncEnabled(snapshot.provider, snapshot.providerConversationId, enabled);
      setStatus({
        kind: 'info',
        message: enabled
          ? 'Auto-sync enabled for this conversation.'
          : 'Auto-sync disabled for this conversation.',
      });
    } catch (error) {
      setAutoSyncEnabledState(!enabled);
      setStatus({ kind: 'error', message: errorMessage(error) });
    }
  }

  if (!settingsLoaded) {
    return <main className="popup">Loading…</main>;
  }

  return (
    <main className="popup">
      <header className="header">
        <div>
          <h1>Pro_Bridge</h1>
          <p className="subtitle">AI conversation synchronization</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Settings"
          title="Settings"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          ⚙
        </button>
      </header>

      {settingsOpen ? (
        <section className="panel">
          <label className="field">
            <span>Local API URL</span>
            <input
              type="url"
              value={draftSettings.apiBaseUrl}
              onChange={(event) =>
                setDraftSettings((current) => ({
                  ...current,
                  apiBaseUrl: event.target.value,
                }))
              }
              placeholder="http://127.0.0.1:4317"
            />
          </label>
          <label className="field">
            <span>Local API token</span>
            <input
              type="password"
              value={draftSettings.token}
              onChange={(event) =>
                setDraftSettings((current) => ({ ...current, token: event.target.value }))
              }
              placeholder="PRO_BRIDGE_LOCAL_TOKEN"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              void handleSaveSettings();
            }}
          >
            Save settings
          </button>
          <p className="hint">The token is stored in this browser profile only.</p>
        </section>
      ) : null}

      {settings.token.length === 0 && !settingsOpen ? (
        <p className="status error">Add your local API token in settings to sync.</p>
      ) : null}

      {snapshot ? (
        <section className="panel">
          <div className="conversation-header">
            <div>
              <h2>{snapshot.title}</h2>
              <p className="meta">
                {providerDisplayName(snapshot.provider)} · {snapshot.messages.length}{' '}
                {snapshot.messages.length === 1 ? 'message' : 'messages'}
              </p>
            </div>
            {conversation ? <span className="badge">Linked</span> : null}
          </div>

          <label className="field">
            <span>Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={projects.length === 0}
            >
              <option value="">Select a project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          {projects.length === 0 ? (
            <p className="hint">
              No projects found. Create one with the local API, then refresh this popup.
            </p>
          ) : null}

          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              disabled={busy || !conversation}
              onChange={(event) => {
                void handleToggleAutoSync(event.target.checked);
              }}
            />
            <span>Auto-sync this conversation</span>
          </label>

          {!conversation ? (
            <p className="hint">Link the conversation to enable auto-sync.</p>
          ) : null}

          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={busy || !projectId || settings.token.length === 0}
              onClick={() => {
                void handleLink();
              }}
            >
              Link conversation
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy || !conversation || settings.token.length === 0}
              onClick={() => {
                void handleSync();
              }}
            >
              {busy ? 'Working…' : 'Sync messages'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || !conversation || settings.token.length === 0}
              onClick={() => {
                void handleExtract();
              }}
            >
              Extract context
            </button>
          </div>

          <button
            type="button"
            className="link-button"
            disabled={busy}
            onClick={() => {
              void handleRefresh();
            }}
          >
            Refresh from {providerDisplayName(snapshot.provider)}
          </button>
        </section>
      ) : (
        <section className="panel empty-state">
          <p>
            {status.kind === 'error'
              ? status.message
              : 'Open a saved ChatGPT, Claude, or Gemini conversation.'}
          </p>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              void handleRefresh();
            }}
          >
            {busy ? 'Reading…' : 'Read current tab'}
          </button>
        </section>
      )}

      {status.kind !== 'idle' && snapshot ? (
        <p className={`status ${status.kind}`}>{status.message}</p>
      ) : null}

      {lastAutoSync &&
      snapshot &&
      lastAutoSync.provider === snapshot.provider &&
      lastAutoSync.providerConversationId === snapshot.providerConversationId ? (
        <p className={`status ${lastAutoSync.status === 'error' ? 'error' : 'info'}`}>
          {lastAutoSync.status === 'error'
            ? `Auto-sync failed: ${lastAutoSync.message}`
            : `${lastAutoSync.message} Last checked at ${formatTime(lastAutoSync.syncedAt)}.`}
        </p>
      ) : null}

      <footer className="footer">
        Synced conversations stay in your local Pro_Bridge database.
      </footer>
    </main>
  );
}
