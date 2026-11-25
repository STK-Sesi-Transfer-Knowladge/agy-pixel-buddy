'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');
const { resolveEffectiveState, selectStateForWorkspace } = require('./stateMapper');
const { getWebviewHtml } = require('./webviewHtml');
const {
  DEFAULT_FLOATING_CONFIG_PATH,
  DEFAULT_FLOATING_PID_PATH,
  DEFAULT_WORKSPACES_PATH,
  isFloatingRunning,
  readFloatingConfig,
  updateFloatingConfig,
  syncFloatingCharacter,
  applyFloatingMode,
  toggleFloatingBuddy
} = require('./floatingLauncher');

const DEFAULT_STATE_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'buddy-state.json');

const STATUS_BAR_ICON_MAP = {
  idle: '$(sparkle)',
  thinking: '$(sync~spin)',
  coding: '$(code)',
  reading: '$(book)',
  terminal: '$(terminal)',
  searching: '$(search)',
  delegating: '$(organization)',
  working: '$(gear~spin)',
  done: '$(check)'
};

const STATUS_BAR_LABEL_MAP = {
  en: {
    idle: 'Idle',
    thinking: 'Thinking…',
    coding: 'Coding…',
    reading: 'Reading…',
    terminal: 'Running…',
    searching: 'Searching…',
    delegating: 'Delegating…',
    working: 'Working…',
    done: 'Done!'
  },
  id: {
    idle: 'Diam',
    thinking: 'Mikir…',
    coding: 'Ngoding…',
    reading: 'Baca…',
    terminal: 'Jalanin…',
    searching: 'Nyari…',
    delegating: 'Delegasi…',
    working: 'Kerja…',
    done: 'Selesai!'
  }
};

function getConfiguredStatusPath() {
  const config = vscode.workspace.getConfiguration('agyPixelBuddy');
  const custom = config.get('statusFile', '');
  return custom && custom.trim() ? custom.trim() : DEFAULT_STATE_PATH;
}

function hasCustomStatusFile() {
  const config = vscode.workspace.getConfiguration('agyPixelBuddy');
  const custom = config.get('statusFile', '');
  return Boolean(custom && custom.trim());
}

function getWindowWorkspacePaths() {
  const folders = vscode.workspace.workspaceFolders;
  if (!Array.isArray(folders)) return [];
  return folders.map((f) => f && f.uri && f.uri.fsPath).filter(Boolean);
}

function getIdleTimeoutMs() {
  const config = vscode.workspace.getConfiguration('agyPixelBuddy');
  const seconds = Number(config.get('idleTimeoutSeconds', 120));
  return Number.isFinite(seconds) && seconds >= 10 ? seconds * 1000 : 120000;
}

function readRawState(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

class BuddyViewProvider {
  constructor(context, getStateFn) {
    this.context = context;
    this.getStateFn = getStateFn;
    this.view = null;
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };

    const config = vscode.workspace.getConfiguration('agyPixelBuddy');
    const character = config.get('character', 'cat');
    const trainer = config.get('trainer', 'boss');
    const floatingMode = config.get('floatingMode', 'random');
    const language = config.get('language', 'id');
    const promptReaction = config.get('promptReaction', true);
    const reactionTrigger = config.get('reactionTrigger', 'hook');
    webviewView.webview.html = getWebviewHtml(
      webviewView.webview,
      this.getStateFn(),
      character,
      floatingMode,
      language,
      promptReaction,
      reactionTrigger,
      trainer
    );

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ready') {
        const cfg = vscode.workspace.getConfiguration('agyPixelBuddy');
        this.postState(this.getStateFn());
        this.postTrainer(cfg.get('trainer', 'boss'));
        this.postFloatingMode(cfg.get('floatingMode', 'random'));
        this.postLanguage(cfg.get('language', 'id'));
        this.postReactionSetting(cfg.get('promptReaction', true), cfg.get('reactionTrigger', 'hook'));
      } else if (msg.type === 'setCharacter' && typeof msg.character === 'string') {
        await vscode.workspace
          .getConfiguration('agyPixelBuddy')
          .update('character', msg.character, vscode.ConfigurationTarget.Global);
      } else if (msg.type === 'setTrainer' && typeof msg.trainer === 'string') {
        await vscode.workspace
          .getConfiguration('agyPixelBuddy')
          .update('trainer', msg.trainer, vscode.ConfigurationTarget.Global);
      } else if (msg.type === 'setFloatingMode' && typeof msg.mode === 'string') {
        await vscode.workspace
          .getConfiguration('agyPixelBuddy')
          .update('floatingMode', msg.mode, vscode.ConfigurationTarget.Global);
      } else if (msg.type === 'setLanguage' && typeof msg.language === 'string') {
        await vscode.workspace
          .getConfiguration('agyPixelBuddy')
          .update('language', msg.language, vscode.ConfigurationTarget.Global);
      } else if (msg.type === 'setReactionSetting') {
        const cfg = vscode.workspace.getConfiguration('agyPixelBuddy');
        if (typeof msg.enabled === 'boolean') {
          await cfg.update('promptReaction', msg.enabled, vscode.ConfigurationTarget.Global);
        }
        if (msg.trigger === 'hook' || msg.trigger === 'prompt') {
          await cfg.update('reactionTrigger', msg.trigger, vscode.ConfigurationTarget.Global);
        }
      } else if (msg.type === 'testReaction') {
        const cfg = vscode.workspace.getConfiguration('agyPixelBuddy');
        this.postPromptReactionTrigger(cfg.get('reactionTrigger', 'hook'));
        updateFloatingConfig(DEFAULT_FLOATING_CONFIG_PATH, { testReactionNonce: Date.now() });
      }
    });

    webviewView.onDidDispose(() => {
      this.view = null;
    });
  }

  postState(stateObj) {
    if (this.view) {
      this.view.webview.postMessage({ type: 'stateUpdate', payload: stateObj });
    }
  }

  postCharacter(character) {
    if (this.view) {
      this.view.webview.postMessage({ type: 'characterUpdate', character });
    }
  }

  postTrainer(trainer) {
    if (this.view) {
      this.view.webview.postMessage({ type: 'trainerUpdate', trainer });
    }
  }

  postFloatingMode(mode) {
    if (this.view) {
      this.view.webview.postMessage({ type: 'floatingModeUpdate', mode });
    }
  }

  postLanguage(language) {
    if (this.view) {
      this.view.webview.postMessage({ type: 'languageUpdate', language });
    }
  }

  postReactionSetting(enabled, trigger) {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'reactionSettingUpdate',
        enabled: Boolean(enabled),
        trigger: trigger === 'prompt' ? 'prompt' : 'hook'
      });
    }
  }

  postPromptReactionTrigger(trigger = 'hook') {
    if (this.view) {
      this.view.webview.postMessage({ type: 'triggerPromptReaction', trigger });
    }
  }
}

function activate(context) {
  let rawState = null;
  let lastSerialized = '';
  let lastFloatingConfigMtime = 0;
  let lastPromptTs = 0;

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
  statusBarItem.command = 'agyPixelBuddy.focus';
  statusBarItem.show();

  const getEffective = () => resolveEffectiveState(rawState, Date.now(), getIdleTimeoutMs());
  const getFloatingOptions = () => {
    const config = vscode.workspace.getConfiguration('agyPixelBuddy');
    return {
      scriptPath: path.join(context.extensionPath, 'companion', 'floating_buddy.py'),
      statePath: getConfiguredStatusPath(),
      workspacesPath: DEFAULT_WORKSPACES_PATH,
      configPath: DEFAULT_FLOATING_CONFIG_PATH,
      pidPath: DEFAULT_FLOATING_PID_PATH,
      character: config.get('character', 'cat'),
      trainer: config.get('trainer', 'boss'),
      mode: config.get('floatingMode', 'random'),
      language: config.get('language', 'id'),
      promptReaction: config.get('promptReaction', true),
      reactionTrigger: config.get('reactionTrigger', 'hook'),
      idleTimeoutMs: getIdleTimeoutMs()
    };
  };

  const provider = new BuddyViewProvider(context, getEffective);
  const registration = vscode.window.registerWebviewViewProvider('agyPixelBuddy.buddyView', provider, {
    webviewOptions: { retainContextWhenHidden: true }
  });

  async function syncFromFloatingConfigDisk() {
    try {
      if (!fs.existsSync(DEFAULT_FLOATING_CONFIG_PATH)) return;
      const stat = fs.statSync(DEFAULT_FLOATING_CONFIG_PATH);
      if (stat.mtimeMs === lastFloatingConfigMtime) return;
      lastFloatingConfigMtime = stat.mtimeMs;

      const diskCfg = readFloatingConfig(DEFAULT_FLOATING_CONFIG_PATH);
      if (!diskCfg) return;

      const vsCfg = vscode.workspace.getConfiguration('agyPixelBuddy');
      if (typeof diskCfg.character === 'string' && diskCfg.character !== vsCfg.get('character')) {
        await vsCfg.update('character', diskCfg.character, vscode.ConfigurationTarget.Global);
      }
      if (typeof diskCfg.trainer === 'string' && diskCfg.trainer !== vsCfg.get('trainer')) {
        await vsCfg.update('trainer', diskCfg.trainer, vscode.ConfigurationTarget.Global);
      }
      if (typeof diskCfg.moveMode === 'string' && diskCfg.moveMode !== vsCfg.get('floatingMode')) {
        await vsCfg.update('floatingMode', diskCfg.moveMode, vscode.ConfigurationTarget.Global);
      }
      if (typeof diskCfg.language === 'string' && diskCfg.language !== vsCfg.get('language')) {
        await vsCfg.update('language', diskCfg.language, vscode.ConfigurationTarget.Global);
      }
      if (typeof diskCfg.promptReaction === 'boolean' && diskCfg.promptReaction !== vsCfg.get('promptReaction')) {
        await vsCfg.update('promptReaction', diskCfg.promptReaction, vscode.ConfigurationTarget.Global);
      }
      if (typeof diskCfg.reactionTrigger === 'string' && diskCfg.reactionTrigger !== vsCfg.get('reactionTrigger')) {
        await vsCfg.update('reactionTrigger', diskCfg.reactionTrigger, vscode.ConfigurationTarget.Global);
      }
    } catch {
      // Ignore sync errors
    }
  }

  function updateUi(force = false) {
    const effective = getEffective();
    const lang = vscode.workspace.getConfiguration('agyPixelBuddy').get('language', 'id') === 'en' ? 'en' : 'id';
    const serialized = `${effective.state}|${effective.detail}|${effective.updatedAt}|${lang}`;
    if (!force && serialized === lastSerialized) {
      return;
    }
    lastSerialized = serialized;

    const icon = STATUS_BAR_ICON_MAP[effective.state] || '$(sparkle)';
    const labelMap = STATUS_BAR_LABEL_MAP[lang] || STATUS_BAR_LABEL_MAP.id;
    const label = labelMap[effective.state] || labelMap.idle;
    statusBarItem.text = `${icon} Agy: ${label}`;
    statusBarItem.tooltip = effective.detail ? `Agy Pixel Buddy — ${effective.detail}` : 'Agy Pixel Buddy';

    provider.postState(effective);
  }

  function refreshFromDisk(force = false) {
    const filePath = getConfiguredStatusPath();
    const prevRaw = rawState;
    const prevEffectiveState = getEffective().state;
    const fallbackRaw = readRawState(filePath);
    let nextRaw = fallbackRaw;
    if (!hasCustomStatusFile()) {
      const wsStore = readRawState(DEFAULT_WORKSPACES_PATH);
      if (wsStore && wsStore.workspaces) {
        nextRaw = selectStateForWorkspace(wsStore, getWindowWorkspacePaths(), fallbackRaw);
      }
    }
    rawState = nextRaw;

    const nowMs = Date.now();
    const cfg = vscode.workspace.getConfiguration('agyPixelBuddy');
    const reactionEnabled = cfg.get('promptReaction', true);
    const triggerMode = cfg.get('reactionTrigger', 'hook');
    if (
      !force &&
      reactionEnabled &&
      nextRaw &&
      typeof nextRaw.updatedAt === 'number' &&
      nextRaw.updatedAt > 0 &&
      nextRaw.updatedAt !== lastPromptTs &&
      nowMs - nextRaw.updatedAt < 10000
    ) {
      if (triggerMode === 'hook') {
        lastPromptTs = nextRaw.updatedAt;
        provider.postPromptReactionTrigger('hook');
      } else if (nextRaw.event === 'PreInvocation') {
        const prevEv = prevRaw && typeof prevRaw.event === 'string' ? prevRaw.event : null;
        if (prevEv === null || prevEv === 'Stop' || prevEv === 'SessionStart' || prevEffectiveState === 'idle' || prevEffectiveState === 'done') {
          lastPromptTs = nextRaw.updatedAt;
          provider.postPromptReactionTrigger('prompt');
        }
      }
    }

    updateUi(force);
    syncFromFloatingConfigDisk();
  }

  let dirWatcher = null;
  function startWatcher() {
    if (dirWatcher) {
      dirWatcher.close();
      dirWatcher = null;
    }
    const targetPath = getConfiguredStatusPath();
    const parentDir = path.dirname(targetPath);
    const targetBase = path.basename(targetPath);
    const workspacesBase = path.basename(DEFAULT_WORKSPACES_PATH);
    try {
      fs.mkdirSync(parentDir, { recursive: true });
      dirWatcher = fs.watch(parentDir, (eventType, filename) => {
        if (!filename || filename === targetBase || filename === workspacesBase) {
          refreshFromDisk();
        }
      });
    } catch {
      // Fallback polling timer still keeps UI updated
    }
  }

  const pollTimer = setInterval(() => {
    refreshFromDisk();
  }, 800);

  const focusCmd = vscode.commands.registerCommand('agyPixelBuddy.focus', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.agy-pixel-buddy');
  });

  const cycleCmd = vscode.commands.registerCommand('agyPixelBuddy.cycleCharacter', async () => {
    const order = ['cat', 'bot', 'dev'];
    const config = vscode.workspace.getConfiguration('agyPixelBuddy');
    const current = config.get('character', 'cat');
    const next = order[(order.indexOf(current) + 1) % order.length];
    await config.update('character', next, vscode.ConfigurationTarget.Global);
    syncFloatingCharacter(DEFAULT_FLOATING_CONFIG_PATH, next);
    provider.postCharacter(next);
  });

  const toggleFloatingCmd = vscode.commands.registerCommand('agyPixelBuddy.toggleFloating', async () => {
    const config = vscode.workspace.getConfiguration('agyPixelBuddy');
    const currentMode = config.get('floatingMode', 'random');
    const nextMode = currentMode === 'hidden' ? 'random' : 'hidden';
    await config.update('floatingMode', nextMode, vscode.ConfigurationTarget.Global);
  });

  function applyModeToOverlay(mode) {
    if (process.platform !== 'linux' || !process.env.DISPLAY) {
      if (mode !== 'hidden') {
        vscode.window.showWarningMessage('Agy Pixel Buddy floating overlay requires Linux X11 (DISPLAY).');
      }
      return;
    }
    const res = applyFloatingMode(mode, getFloatingOptions());
    try {
      if (fs.existsSync(DEFAULT_FLOATING_CONFIG_PATH)) {
        lastFloatingConfigMtime = fs.statSync(DEFAULT_FLOATING_CONFIG_PATH).mtimeMs;
      }
    } catch {
      // ignore
    }
    if (res.error) {
      vscode.window.showWarningMessage(`Agy Pixel Buddy: ${res.error}`);
    }
  }

  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    const cfg = vscode.workspace.getConfiguration('agyPixelBuddy');
    if (e.affectsConfiguration('agyPixelBuddy.statusFile')) {
      startWatcher();
      refreshFromDisk(true);
    }
    if (e.affectsConfiguration('agyPixelBuddy.character')) {
      const ch = cfg.get('character', 'cat');
      syncFloatingCharacter(DEFAULT_FLOATING_CONFIG_PATH, ch);
      provider.postCharacter(ch);
    }
    if (e.affectsConfiguration('agyPixelBuddy.trainer')) {
      const tr = cfg.get('trainer', 'boss');
      updateFloatingConfig(DEFAULT_FLOATING_CONFIG_PATH, { trainer: tr });
      provider.postTrainer(tr);
    }
    if (e.affectsConfiguration('agyPixelBuddy.floatingMode')) {
      const mode = cfg.get('floatingMode', 'random');
      applyModeToOverlay(mode);
      provider.postFloatingMode(mode);
    }
    if (e.affectsConfiguration('agyPixelBuddy.language')) {
      const lang = cfg.get('language', 'id');
      updateFloatingConfig(DEFAULT_FLOATING_CONFIG_PATH, { language: lang });
      provider.postLanguage(lang);
      updateUi(true);
    }
    if (e.affectsConfiguration('agyPixelBuddy.promptReaction') || e.affectsConfiguration('agyPixelBuddy.reactionTrigger')) {
      const enabled = cfg.get('promptReaction', true);
      const trigger = cfg.get('reactionTrigger', 'hook');
      updateFloatingConfig(DEFAULT_FLOATING_CONFIG_PATH, { promptReaction: enabled, reactionTrigger: trigger });
      provider.postReactionSetting(enabled, trigger);
    }
  });

  const wsFolderListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    refreshFromDisk(true);
  });

  startWatcher();
  refreshFromDisk(true);

  const initialMode = vscode.workspace.getConfiguration('agyPixelBuddy').get('floatingMode', 'random');
  if (process.platform === 'linux' && process.env.DISPLAY) {
    if (initialMode !== 'hidden') {
      applyModeToOverlay(initialMode);
    } else if (isFloatingRunning(DEFAULT_FLOATING_PID_PATH)) {
      applyFloatingMode('hidden', getFloatingOptions());
    }
  }

  context.subscriptions.push(
    statusBarItem,
    registration,
    focusCmd,
    cycleCmd,
    toggleFloatingCmd,
    configListener,
    wsFolderListener,
    {
      dispose: () => {
        clearInterval(pollTimer);
        if (dirWatcher) {
          dirWatcher.close();
        }
      }
    }
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
