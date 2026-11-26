'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isProcessAlive,
  readFloatingPid,
  isFloatingRunning,
  resolvePythonCommand,
  updateFloatingConfig,
  syncFloatingCharacter,
  startFloatingBuddy,
  applyFloatingMode,
  toggleFloatingBuddy
} = require('../src/floatingLauncher');

function createMockFs(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  return {
    files,
    existsSync(p) {
      return files.has(p);
    },
    readFileSync(p) {
      if (!files.has(p)) throw new Error('ENOENT');
      return files.get(p);
    },
    mkdirSync() {},
    writeFileSync(p, content) {
      files.set(p, content);
    },
    renameSync(from, to) {
      files.set(to, files.get(from));
      files.delete(from);
    },
    unlinkSync(p) {
      files.delete(p);
    }
  };
}

test('isProcessAlive and readFloatingPid validate process existence safely', () => {
  const mockFs = createMockFs({ '/tmp/buddy.pid': '4321\n' });
  assert.equal(readFloatingPid('/tmp/buddy.pid', mockFs), 4321);
  assert.equal(isProcessAlive(4321, () => {}), true);
  assert.equal(isProcessAlive(4321, () => {
    const err = new Error('ESRCH');
    err.code = 'ESRCH';
    throw err;
  }), false);
  assert.equal(isFloatingRunning('/tmp/buddy.pid', { fs: mockFs, kill: () => {} }), 4321);
});

test('updateFloatingConfig and syncFloatingCharacter preserve preferences while updating fields', () => {
  const cfgPath = '/tmp/buddy-floating-config.json';
  const mockFs = createMockFs({
    [cfgPath]: JSON.stringify({ character: 'cat', moveMode: 'sticky', language: 'id', scale: 4 })
  });

  assert.equal(syncFloatingCharacter(cfgPath, 'kyubi', mockFs), true);
  assert.equal(updateFloatingConfig(cfgPath, { language: 'en', moveMode: 'random', scale: 2, promptReaction: false, reactionTrigger: 'prompt', trainer: 'naruto' }, mockFs), true);

  const updated = JSON.parse(mockFs.files.get(cfgPath));
  assert.equal(updated.character, 'kyubi');
  assert.equal(updated.trainer, 'naruto');
  assert.equal(updated.moveMode, 'random');
  assert.equal(updated.language, 'en');
  assert.equal(updated.promptReaction, false);
  assert.equal(updated.reactionTrigger, 'prompt');
  assert.equal(updated.scale, 2);
  assert.equal(syncFloatingCharacter(cfgPath, 'invalid', mockFs), false);
  assert.equal(updateFloatingConfig(cfgPath, { trainer: 'unknown' }, mockFs), true);
  assert.equal(JSON.parse(mockFs.files.get(cfgPath)).trainer, 'naruto');
});

test('startFloatingBuddy spawns detached python process with mode and language flags', () => {
  const mockFs = createMockFs({ '/ext/companion/floating_buddy.py': '#!/usr/bin/env python3' });
  const calls = [];
  let unrefCalled = false;

  const res = startFloatingBuddy(
    {
      scriptPath: '/ext/companion/floating_buddy.py',
      statePath: '/tmp/buddy-state.json',
      configPath: '/tmp/buddy-cfg.json',
      pidPath: '/tmp/buddy.pid',
      lockPath: '/tmp/buddy.lock',
      character: 'dev',
      trainer: 'sensei',
      mode: 'sticky',
      language: 'id',
      idleTimeoutMs: 90000
    },
    {
      fs: mockFs,
      spawn(bin, args, opts) {
        calls.push({ bin, args, opts });
        return {
          pid: 9876,
          unref() {
            unrefCalled = true;
          }
        };
      }
    }
  );

  assert.equal(res.started, true);
  assert.equal(res.running, true);
  assert.equal(res.pid, 9876);
  assert.equal(unrefCalled, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bin, 'python3');
  assert.ok(calls[0].args.includes('dev'));
  assert.ok(calls[0].args.includes('sensei'));
  assert.ok(calls[0].args.includes('sticky'));
  assert.ok(calls[0].args.includes('id'));
  assert.equal(calls[0].opts.detached, true);
});

test('applyFloatingMode hidden stops running buddy and persists hidden mode', () => {
  const pidPath = '/tmp/buddy.pid';
  const cfgPath = '/tmp/buddy-cfg.json';
  const mockFs = createMockFs({
    [pidPath]: '5555',
    [cfgPath]: JSON.stringify({ character: 'cat', moveMode: 'random' }),
    '/ext/companion/floating_buddy.py': '#!/usr/bin/env python3'
  });
  const signals = [];

  const res = applyFloatingMode(
    'hidden',
    {
      scriptPath: '/ext/companion/floating_buddy.py',
      statePath: '/tmp/buddy-state.json',
      configPath: cfgPath,
      pidPath
    },
    {
      fs: mockFs,
      kill(pid, sig) {
        signals.push({ pid, sig });
      }
    }
  );

  assert.equal(res.mode, 'hidden');
  assert.equal(res.running, false);
  assert.equal(res.stopped, true);
  assert.deepEqual(signals, [
    { pid: 5555, sig: 0 },
    { pid: 5555, sig: 'SIGTERM' }
  ]);
  assert.equal(JSON.parse(mockFs.files.get(cfgPath)).moveMode, 'hidden');
});

test('toggleFloatingBuddy switches between stopped and started cleanly', () => {
  const pidPath = '/tmp/buddy.pid';
  const cfgPath = '/tmp/buddy-cfg.json';
  const mockFs = createMockFs({
    [pidPath]: '5555',
    '/ext/companion/floating_buddy.py': '#!/usr/bin/env python3'
  });

  const res = toggleFloatingBuddy(
    {
      scriptPath: '/ext/companion/floating_buddy.py',
      statePath: '/tmp/buddy-state.json',
      configPath: cfgPath,
      pidPath
    },
    {
      fs: mockFs,
      kill() {}
    }
  );

  assert.equal(res.action, 'stopped');
  assert.equal(res.running, false);
  assert.equal(mockFs.existsSync(pidPath), false);
});

test('resolvePythonCommand and startFloatingBuddy support Windows python/py launchers and windowsHide', () => {
  const probed = [];
  const winCmd = resolvePythonCommand('', {
    platform: 'win32',
    execFileSync(bin, args) {
      probed.push({ bin, args });
      if (bin === 'py') throw new Error('missing py');
    }
  });
  assert.deepEqual(winCmd, { bin: 'python', prefixArgs: [] });
  assert.equal(probed[0].bin, 'py');

  const mockFs = createMockFs({ 'C:\\ext\\companion\\floating_buddy.py': '#!/usr/bin/env python3' });
  const calls = [];
  const res = startFloatingBuddy(
    {
      scriptPath: 'C:\\ext\\companion\\floating_buddy.py',
      statePath: 'C:\\tmp\\buddy-state.json',
      configPath: 'C:\\tmp\\buddy-cfg.json',
      pidPath: 'C:\\tmp\\buddy.pid',
      lockPath: 'C:\\tmp\\buddy.lock',
      character: 'cat',
      trainer: 'girl',
      mode: 'random'
    },
    {
      platform: 'win32',
      fs: mockFs,
      execFileSync(bin, args) {
        if (bin === 'py' && args.includes('import PyQt5')) {
          return;
        }
        throw new Error('not found');
      },
      spawn(bin, args, opts) {
        calls.push({ bin, args, opts });
        return { pid: 2468, unref() {} };
      }
    }
  );

  assert.equal(res.started, true);
  assert.equal(calls[0].bin, 'py');
  assert.equal(calls[0].args[0], '-3');
  assert.equal(calls[0].opts.detached, true);
  assert.equal(calls[0].opts.windowsHide, true);
});
