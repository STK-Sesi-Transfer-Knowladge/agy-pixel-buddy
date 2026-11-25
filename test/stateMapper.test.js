'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyTool,
  extractWorkspacePath,
  mapHookEventToBuddyState,
  getHookResponse,
  resolveEffectiveState,
  mergeWorkspaceState,
  selectStateForWorkspace
} = require('../src/stateMapper');
const { getWebviewHtml } = require('../src/webviewHtml');

test('mapHookEventToBuddyState maps PreInvocation to thinking', () => {
  const result = mapHookEventToBuddyState({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-1',
    modelName: 'gemini'
  }, 1000);

  assert.equal(result.state, 'thinking');
  assert.equal(result.event, 'PreInvocation');
  assert.equal(result.detail, 'Thinking...');
  assert.equal(result.updatedAt, 1000);
});

test('mapHookEventToBuddyState maps PreToolUse coding, reading, terminal, searching, and delegating tools', () => {
  const editRes = mapHookEventToBuddyState({
    hookEventName: 'PreToolUse',
    toolCall: { name: 'edit_file', args: { Path: '/tmp/app/index.js' } }
  }, 2000);
  assert.equal(editRes.state, 'coding');
  assert.equal(editRes.detail, 'Coding index.js');

  const readRes = mapHookEventToBuddyState({
    hookEventName: 'PreToolUse',
    toolCall: { name: 'read_file', args: { Path: '/tmp/app/README.md' } }
  }, 2000);
  assert.equal(readRes.state, 'reading');
  assert.equal(readRes.detail, 'Reading README.md');

  const cmdRes = mapHookEventToBuddyState({
    hookEventName: 'PreToolUse',
    toolCall: { name: 'run_command', args: { toolSummary: 'Unit test run' } }
  }, 2000);
  assert.equal(cmdRes.state, 'terminal');
  assert.equal(cmdRes.detail, 'Running Unit test run');

  const searchRes = mapHookEventToBuddyState({
    hookEventName: 'PreToolUse',
    toolCall: { name: 'search_web', args: { query: 'vscode webview' } }
  }, 2000);
  assert.equal(searchRes.state, 'searching');
  assert.equal(searchRes.detail, 'Searching "vscode webview"');

  const subagentRes = mapHookEventToBuddyState({
    hookEventName: 'PreToolUse',
    toolCall: { name: 'invoke_subagent', args: { Role: 'Codebase Researcher' } }
  }, 2000);
  assert.equal(subagentRes.state, 'delegating');
  assert.equal(subagentRes.detail, 'Delegating: Codebase Researcher');
});

test('classifyTool falls back cleanly on unknown or missing tool names', () => {
  assert.deepEqual(classifyTool('', {}), { state: 'working', detail: 'Working...' });
  assert.deepEqual(classifyTool('custom_tool', {}), { state: 'working', detail: 'Using custom_tool' });
});

test('mapHookEventToBuddyState maps Stop reasons appropriately', () => {
  const okStop = mapHookEventToBuddyState({ hookEventName: 'Stop', terminationReason: 'NO_TOOL_CALL' }, 3000);
  assert.equal(okStop.state, 'done');

  const errStop = mapHookEventToBuddyState({ hookEventName: 'Stop', terminationReason: 'ERROR' }, 3000);
  assert.equal(errStop.state, 'idle');
  assert.equal(errStop.detail, 'Stopped (error)');

  const cancelStop = mapHookEventToBuddyState({ hookEventName: 'Stop', terminationReason: 'USER_CANCELED' }, 3000);
  assert.equal(cancelStop.state, 'idle');
  assert.equal(cancelStop.detail, 'Paused by user');
});

test('getHookResponse never overrides PreToolUse permission decisions', () => {
  assert.equal(getHookResponse('PreToolUse'), '');
  assert.equal(getHookResponse('PostToolUse'), '{}\n');
  assert.equal(getHookResponse('PreInvocation'), '{}\n');
  assert.equal(getHookResponse('Stop'), '{"decision":"allow"}\n');
});

test('resolveEffectiveState transitions done -> idle after 5s and active -> idle after timeout', () => {
  const doneFresh = resolveEffectiveState({ state: 'done', detail: 'Task complete!', updatedAt: 10000 }, 12000, 120000, 5000);
  assert.equal(doneFresh.state, 'done');

  const doneExpired = resolveEffectiveState({ state: 'done', detail: 'Task complete!', updatedAt: 10000 }, 16000, 120000, 5000);
  assert.equal(doneExpired.state, 'idle');

  const staleCoding = resolveEffectiveState({ state: 'coding', detail: 'Coding a.js', updatedAt: 10000 }, 150000, 120000, 5000);
  assert.equal(staleCoding.state, 'idle');
});

test('getWebviewHtml embeds CSP, canvas stage, and safely escapes initial state', () => {
  const fakeWebview = { cspSource: 'vscode-webview://unit-test' };
  const html = getWebviewHtml(fakeWebview, { state: 'coding', detail: '<script>x</script>' }, 'bot');

  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /vscode-webview:\/\/unit-test/);
  assert.match(html, /<canvas id="scene"/);
  assert.ok(!html.includes('<script>x</script>'));
});

test('mergeWorkspaceState and selectStateForWorkspace isolate state per workspace', () => {
  const s1 = mapHookEventToBuddyState({
    hookEventName: 'PreToolUse',
    workspacePaths: ['/mnt/project/alpha'],
    toolCall: { name: 'edit_file', args: { Path: '/mnt/project/alpha/app.js' } }
  }, 5000);
  const s2 = mapHookEventToBuddyState({
    hookEventName: 'Stop',
    terminationReason: 'NO_TOOL_CALL',
    cwd: '/mnt/project/beta'
  }, 6000);

  let store = mergeWorkspaceState(null, s1, 5000);
  store = mergeWorkspaceState(store, s2, 6000);

  assert.equal(extractWorkspacePath({ workspacePaths: ['/mnt/project/alpha'] }), '/mnt/project/alpha');
  assert.equal(selectStateForWorkspace(store, ['/mnt/project/alpha']).state, 'coding');
  assert.equal(selectStateForWorkspace(store, ['/mnt/project/beta']).state, 'done');
  // Unseen workspace window stays idle (null), never leaking alpha or beta
  assert.equal(selectStateForWorkspace(store, ['/mnt/project/gamma']), null);
});
