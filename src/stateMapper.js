'use strict';

const path = require('path');

const CODING_TOOLS = new Set([
  'edit_file',
  'write_file',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content',
  'dart_fix',
  'dart_format'
]);

const READING_TOOLS = new Set([
  'read_file',
  'view_file',
  'list_resources',
  'read_resource',
  'codegraph_explore',
  'query_graph',
  'get_node',
  'get_neighbors',
  'shortest_path',
  'grep_search',
  'find_by_name',
  'list_dir'
]);

const TERMINAL_TOOLS = new Set([
  'run_command',
  'run_tests',
  'manage_task',
  'ctx_execute',
  'ctx_batch_execute',
  'ctx_execute_file'
]);

const SEARCHING_TOOLS = new Set([
  'search_web',
  'search_marketplace',
  'ctx_search',
  'ctx_fetch_and_index'
]);

const DELEGATING_TOOLS = new Set([
  'invoke_subagent',
  'send_message',
  'run_workflow',
  'swarm',
  'define_subagent'
]);

function truncate(text, maxLen = 36) {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

function classifyTool(toolName, args) {
  if (!toolName || typeof toolName !== 'string') {
    return { state: 'working', detail: 'Working...' };
  }

  const lower = toolName.toLowerCase();
  const safeArgs = args && typeof args === 'object' ? args : {};

  if (CODING_TOOLS.has(lower)) {
    const filePath = safeArgs.Path || safeArgs.TargetFile || safeArgs.file || '';
    const label = filePath ? `Coding ${path.basename(String(filePath))}` : 'Writing code...';
    return { state: 'coding', detail: truncate(label) };
  }

  if (READING_TOOLS.has(lower) || lower.startsWith('codegraph')) {
    const filePath = safeArgs.Path || safeArgs.AbsolutePath || '';
    const label = filePath
      ? `Reading ${path.basename(String(filePath))}`
      : safeArgs.query
        ? `Exploring "${safeArgs.query}"`
        : 'Reading code...';
    return { state: 'reading', detail: truncate(label) };
  }

  if (TERMINAL_TOOLS.has(lower)) {
    const cmd = safeArgs.toolSummary || safeArgs.CommandLine || '';
    const label = cmd ? `Running ${cmd}` : 'Running command...';
    return { state: 'terminal', detail: truncate(label) };
  }

  if (SEARCHING_TOOLS.has(lower) || lower.startsWith('browser_') || lower.startsWith('playwright')) {
    const q = safeArgs.query || '';
    const label = q ? `Searching "${q}"` : 'Searching web...';
    return { state: 'searching', detail: truncate(label) };
  }

  if (DELEGATING_TOOLS.has(lower)) {
    const role = safeArgs.Role || safeArgs.Description || '';
    const label = role ? `Delegating: ${role}` : 'Coordinating agents...';
    return { state: 'delegating', detail: truncate(label) };
  }

  return { state: 'working', detail: truncate(`Using ${toolName}`) };
}

function extractWorkspacePath(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (Array.isArray(payload.workspacePaths)) {
    for (const wp of payload.workspacePaths) {
      if (typeof wp === 'string' && wp.trim()) {
        return path.resolve(wp.trim());
      }
    }
  }
  if (typeof payload.cwd === 'string' && payload.cwd.trim()) {
    return path.resolve(payload.cwd.trim());
  }
  return '';
}

/**
 * Maps an Antigravity hook stdin payload into a normalized buddy state object.
 */
function mapHookEventToBuddyState(payload, nowMs = Date.now()) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const event = typeof data.hookEventName === 'string' ? data.hookEventName : 'Unknown';
  const workspacePath = extractWorkspacePath(data);
  const workspaceName = workspacePath ? path.basename(workspacePath) : '';
  const base = {
    event,
    tool: '',
    conversationId: typeof data.conversationId === 'string' ? data.conversationId : '',
    modelName: typeof data.modelName === 'string' ? data.modelName : '',
    workspacePath,
    workspaceName,
    updatedAt: nowMs
  };

  switch (event) {
    case 'SessionStart':
      return { ...base, state: 'idle', detail: 'Ready to help!' };
    case 'PreInvocation':
      return { ...base, state: 'thinking', detail: 'Thinking...' };
    case 'PreToolUse': {
      const toolName = data.toolCall && typeof data.toolCall.name === 'string' ? data.toolCall.name : '';
      const toolArgs = data.toolCall && data.toolCall.args ? data.toolCall.args : {};
      const classified = classifyTool(toolName, toolArgs);
      return {
        ...base,
        tool: toolName,
        state: classified.state,
        detail: classified.detail
      };
    }
    case 'PostToolUse': {
      const toolName = data.toolCall && typeof data.toolCall.name === 'string' ? data.toolCall.name : '';
      const hasError = Boolean(data.error);
      return {
        ...base,
        tool: toolName,
        state: 'thinking',
        detail: hasError ? 'Analyzing error...' : 'Reviewing result...'
      };
    }
    case 'PostInvocation':
      return { ...base, state: 'thinking', detail: 'Wrapping up...' };
    case 'Stop': {
      const reason = typeof data.terminationReason === 'string' ? data.terminationReason : '';
      if (reason === 'ERROR') {
        return { ...base, state: 'idle', detail: 'Stopped (error)' };
      }
      if (reason === 'USER_CANCELED') {
        return { ...base, state: 'idle', detail: 'Paused by user' };
      }
      return { ...base, state: 'done', detail: 'Task complete!' };
    }
    default:
      return { ...base, state: 'idle', detail: 'Standing by' };
  }
}

/**
 * Returns the exact stdout string required by Antigravity hooks so our observer
 * never blocks tools or bypasses tool permission checks.
 */
function getHookResponse(hookEventName) {
  if (hookEventName === 'PreToolUse') {
    return '';
  }
  if (hookEventName === 'Stop') {
    return '{"decision":"allow"}\n';
  }
  return '{}\n';
}

/**
 * Resolves time-based transitions (e.g. "done" -> "idle" after 5s, stale active -> "idle").
 */
function resolveEffectiveState(rawState, nowMs = Date.now(), idleTimeoutMs = 120000, doneDurationMs = 5000) {
  if (!rawState || typeof rawState !== 'object') {
    return { state: 'idle', detail: 'Standing by', tool: '', updatedAt: 0 };
  }

  const updatedAt = typeof rawState.updatedAt === 'number' ? rawState.updatedAt : 0;
  const age = Math.max(0, nowMs - updatedAt);
  const state = typeof rawState.state === 'string' ? rawState.state : 'idle';

  if (state === 'done' && age >= doneDurationMs) {
    return {
      ...rawState,
      state: 'idle',
      detail: 'Standing by'
    };
  }

  if (state !== 'idle' && state !== 'done' && updatedAt > 0 && age >= idleTimeoutMs) {
    return {
      ...rawState,
      state: 'idle',
      detail: 'Standing by'
    };
  }

  return {
    ...rawState,
    state,
    detail: typeof rawState.detail === 'string' ? rawState.detail : ''
  };
}

/**
 * Merges a new buddyState into the per-workspace store and prunes entries older than 24h.
 */
function mergeWorkspaceState(existingStore, buddyState, nowMs = Date.now(), maxAgeMs = 24 * 60 * 60 * 1000) {
  const prevWorkspaces =
    existingStore && typeof existingStore === 'object' && existingStore.workspaces && typeof existingStore.workspaces === 'object'
      ? existingStore.workspaces
      : {};
  const workspaces = {};
  for (const [key, entry] of Object.entries(prevWorkspaces)) {
    if (!entry || typeof entry !== 'object') continue;
    const ts = typeof entry.updatedAt === 'number' ? entry.updatedAt : 0;
    if (ts > 0 && nowMs - ts <= maxAgeMs) {
      workspaces[key] = entry;
    }
  }
  const key = buddyState && buddyState.workspacePath ? buddyState.workspacePath : '__global__';
  workspaces[key] = buddyState;
  return {
    workspaces,
    lastUpdatedWorkspace: key,
    updatedAt: nowMs
  };
}

/**
 * Selects the buddy state belonging to the current IDE window's workspace folders.
 */
function selectStateForWorkspace(workspacesStore, workspaceFolderPaths, fallbackRawState = null) {
  const folders = Array.isArray(workspaceFolderPaths)
    ? workspaceFolderPaths.filter((p) => typeof p === 'string' && p.trim()).map((p) => path.resolve(p.trim()))
    : [];

  if (!workspacesStore || typeof workspacesStore !== 'object' || !workspacesStore.workspaces) {
    return folders.length === 0 ? fallbackRawState : null;
  }

  const map = workspacesStore.workspaces;
  if (folders.length === 0) {
    return map.__global__ || null;
  }

  let best = null;
  for (const folder of folders) {
    if (map[folder]) {
      if (!best || (map[folder].updatedAt || 0) > (best.updatedAt || 0)) {
        best = map[folder];
      }
      continue;
    }
    for (const [wsKey, entry] of Object.entries(map)) {
      if (wsKey === '__global__' || !entry) continue;
      if (folder.startsWith(wsKey + path.sep) || wsKey.startsWith(folder + path.sep)) {
        if (!best || (entry.updatedAt || 0) > (best.updatedAt || 0)) {
          best = entry;
        }
      }
    }
  }
  return best;
}

module.exports = {
  classifyTool,
  extractWorkspacePath,
  mapHookEventToBuddyState,
  getHookResponse,
  resolveEffectiveState,
  mergeWorkspaceState,
  selectStateForWorkspace
};