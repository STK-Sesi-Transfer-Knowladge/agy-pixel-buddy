'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const DEFAULT_FLOATING_CONFIG_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'buddy-floating-config.json');
const DEFAULT_FLOATING_PID_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'buddy-floating.pid');
const DEFAULT_FLOATING_LOCK_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'buddy-floating.lock');
const DEFAULT_WORKSPACES_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'buddy-workspaces.json');

const VALID_CHARS = new Set(['cat', 'bot', 'dev']);
const VALID_MODES = new Set(['random', 'sticky', 'hidden']);
const VALID_LANGS = new Set(['en', 'id']);
const VALID_TRIGGERS = new Set(['hook', 'prompt']);

function isProcessAlive(pid, killFn = process.kill) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    killFn(pid, 0);
    return true;
  } catch (err) {
    return Boolean(err && err.code === 'EPERM');
  }
}

function readFloatingPid(pidPath = DEFAULT_FLOATING_PID_PATH, fsMod = fs) {
  try {
    if (!fsMod.existsSync(pidPath)) return null;
    const raw = fsMod.readFileSync(pidPath, 'utf8').trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isFloatingRunning(pidPath = DEFAULT_FLOATING_PID_PATH, deps = {}) {
  const fsMod = deps.fs || fs;
  const killFn = deps.kill || process.kill;
  const pid = readFloatingPid(pidPath, fsMod);
  if (!pid) return null;
  return isProcessAlive(pid, killFn) ? pid : null;
}

function readFloatingConfig(configPath = DEFAULT_FLOATING_CONFIG_PATH, fsMod = fs) {
  try {
    if (!fsMod.existsSync(configPath)) return null;
    const raw = fsMod.readFileSync(configPath, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function updateFloatingConfig(configPath = DEFAULT_FLOATING_CONFIG_PATH, patch = {}, fsMod = fs) {
  try {
    const current = readFloatingConfig(configPath, fsMod) || {};
    const next = { ...current };
    let changed = false;

    if (typeof patch.character === 'string' && VALID_CHARS.has(patch.character) && next.character !== patch.character) {
      next.character = patch.character;
      changed = true;
    }
    if (typeof patch.moveMode === 'string' && VALID_MODES.has(patch.moveMode) && next.moveMode !== patch.moveMode) {
      next.moveMode = patch.moveMode;
      changed = true;
    }
    if (typeof patch.language === 'string' && VALID_LANGS.has(patch.language) && next.language !== patch.language) {
      next.language = patch.language;
      changed = true;
    }
    if (typeof patch.promptReaction === 'boolean' && next.promptReaction !== patch.promptReaction) {
      next.promptReaction = patch.promptReaction;
      changed = true;
    }
    if (typeof patch.reactionTrigger === 'string' && VALID_TRIGGERS.has(patch.reactionTrigger) && next.reactionTrigger !== patch.reactionTrigger) {
      next.reactionTrigger = patch.reactionTrigger;
      changed = true;
    }
    if (typeof patch.testReactionNonce === 'number' && next.testReactionNonce !== patch.testReactionNonce) {
      next.testReactionNonce = patch.testReactionNonce;
      changed = true;
    }

    if (!changed && fsMod.existsSync(configPath)) {
      return true;
    }

    const dir = path.dirname(configPath);
    fsMod.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.buddy-floating-config.${process.pid}.${Date.now()}.tmp`);
    fsMod.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fsMod.renameSync(tmp, configPath);
    return true;
  } catch {
    return false;
  }
}

function syncFloatingCharacter(configPath = DEFAULT_FLOATING_CONFIG_PATH, character, fsMod = fs) {
  if (!VALID_CHARS.has(character)) return false;
  return updateFloatingConfig(configPath, { character }, fsMod);
}

function startFloatingBuddy(options, deps = {}) {
  const fsMod = deps.fs || fs;
  const spawnFn = deps.spawn || childProcess.spawn;
  const killFn = deps.kill || process.kill;

  const {
    scriptPath,
    statePath,
    workspacesPath = DEFAULT_WORKSPACES_PATH,
    configPath = DEFAULT_FLOATING_CONFIG_PATH,
    pidPath = DEFAULT_FLOATING_PID_PATH,
    lockPath = DEFAULT_FLOATING_LOCK_PATH,
    character = 'cat',
    mode = 'random',
    language = 'id',
    promptReaction = true,
    reactionTrigger = 'hook',
    idleTimeoutMs = 120000,
    pythonBin = 'python3'
  } = options || {};

  if (mode === 'hidden') {
    return { started: false, alreadyRunning: false, running: false };
  }

  const safeMode = VALID_MODES.has(mode) ? mode : 'random';
  const safeLang = VALID_LANGS.has(language) ? language : 'id';
  const safeChar = VALID_CHARS.has(character) ? character : 'cat';
  const safeReaction = Boolean(promptReaction);
  const safeTrigger = VALID_TRIGGERS.has(reactionTrigger) ? reactionTrigger : 'hook';

  updateFloatingConfig(
    configPath,
    {
      character: safeChar,
      moveMode: safeMode,
      language: safeLang,
      promptReaction: safeReaction,
      reactionTrigger: safeTrigger
    },
    fsMod
  );

  const existingPid = isFloatingRunning(pidPath, { fs: fsMod, kill: killFn });
  if (existingPid) {
    return { started: false, alreadyRunning: true, running: true, pid: existingPid };
  }

  if (!scriptPath || !fsMod.existsSync(scriptPath)) {
    return { started: false, running: false, error: 'Floating buddy script not found.' };
  }

  const args = [
    scriptPath,
    '--state-file',
    statePath,
    '--workspaces-file',
    workspacesPath,
    '--config-file',
    configPath,
    '--pid-file',
    pidPath,
    '--lock-file',
    lockPath,
    '--character',
    safeChar,
    '--mode',
    safeMode,
    '--language',
    safeLang,
    safeReaction ? '--prompt-reaction' : '--no-prompt-reaction',
    '--reaction-trigger',
    safeTrigger,
    '--idle-timeout',
    String(idleTimeoutMs)
  ];

  const child = spawnFn(pythonBin, args, {
    detached: true,
    stdio: 'ignore'
  });
  if (child && typeof child.unref === 'function') {
    child.unref();
  }

  return {
    started: true,
    alreadyRunning: false,
    running: true,
    pid: child && child.pid ? child.pid : null
  };
}

function stopFloatingBuddy(pidPath = DEFAULT_FLOATING_PID_PATH, deps = {}) {
  const fsMod = deps.fs || fs;
  const killFn = deps.kill || process.kill;

  const pid = readFloatingPid(pidPath, fsMod);
  if (!pid) {
    return { stopped: false, running: false };
  }

  if (!isProcessAlive(pid, killFn)) {
    try {
      fsMod.unlinkSync(pidPath);
    } catch {
      // Ignore cleanup error
    }
    return { stopped: false, running: false };
  }

  try {
    killFn(pid, 'SIGTERM');
  } catch {
    return { stopped: false, running: isProcessAlive(pid, killFn) };
  }

  try {
    fsMod.unlinkSync(pidPath);
  } catch {
    // Process may clean up its own pid file
  }

  return { stopped: true, running: false, pid };
}

function applyFloatingMode(mode, options, deps = {}) {
  const fsMod = deps.fs || fs;
  const configPath = (options && options.configPath) || DEFAULT_FLOATING_CONFIG_PATH;
  const pidPath = (options && options.pidPath) || DEFAULT_FLOATING_PID_PATH;
  const safeMode = VALID_MODES.has(mode) ? mode : 'random';

  updateFloatingConfig(configPath, { moveMode: safeMode }, fsMod);

  if (safeMode === 'hidden') {
    const stopRes = stopFloatingBuddy(pidPath, deps);
    return { mode: 'hidden', running: stopRes.running, stopped: stopRes.stopped };
  }

  const startRes = startFloatingBuddy({ ...(options || {}), mode: safeMode }, deps);
  return {
    mode: safeMode,
    running: startRes.running,
    started: startRes.started,
    pid: startRes.pid || null,
    error: startRes.error || null
  };
}

function toggleFloatingBuddy(options, deps = {}) {
  const pidPath = (options && options.pidPath) || DEFAULT_FLOATING_PID_PATH;
  const existingPid = isFloatingRunning(pidPath, deps);
  if (existingPid) {
    const res = applyFloatingMode('hidden', options, deps);
    return { action: 'stopped', running: res.running, pid: existingPid };
  }
  const activeMode = options && options.mode && options.mode !== 'hidden' ? options.mode : 'random';
  const res = applyFloatingMode(activeMode, options, deps);
  return {
    action: res.started || res.running ? 'started' : 'failed',
    running: res.running,
    pid: res.pid || null,
    error: res.error || null
  };
}

module.exports = {
  DEFAULT_FLOATING_CONFIG_PATH,
  DEFAULT_FLOATING_PID_PATH,
  DEFAULT_FLOATING_LOCK_PATH,
  DEFAULT_WORKSPACES_PATH,
  isProcessAlive,
  readFloatingPid,
  isFloatingRunning,
  readFloatingConfig,
  updateFloatingConfig,
  syncFloatingCharacter,
  startFloatingBuddy,
  stopFloatingBuddy,
  applyFloatingMode,
  toggleFloatingBuddy
};
