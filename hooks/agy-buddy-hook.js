#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { mapHookEventToBuddyState, getHookResponse, mergeWorkspaceState } = require('../src/stateMapper');

const DEFAULT_STATE_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'buddy-state.json');
const DEFAULT_WORKSPACES_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'buddy-workspaces.json');

function readStdinSafe(timeoutMs = 300) {
  return new Promise((resolve) => {
    let raw = '';
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(raw);
    };

    const timer = setTimeout(finish, timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);

    if (process.stdin.readableEnded) {
      finish();
    }
  });
}

function writeJsonAtomic(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpFile = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpFile, JSON.stringify(obj), 'utf8');
  fs.renameSync(tmpFile, filePath);
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function main() {
  const statePath = process.env.AGY_BUDDY_STATE_FILE || DEFAULT_STATE_PATH;
  const workspacesPath = process.env.AGY_BUDDY_WORKSPACES_FILE || DEFAULT_WORKSPACES_PATH;
  let payload = {};
  try {
    const raw = await readStdinSafe();
    if (raw.trim()) {
      payload = JSON.parse(raw);
    }
  } catch {
    payload = {};
  }

  try {
    const nowMs = Date.now();
    const buddyState = mapHookEventToBuddyState(payload, nowMs);
    writeJsonAtomic(statePath, buddyState);
    const existingStore = readJsonSafe(workspacesPath);
    const updatedStore = mergeWorkspaceState(existingStore, buddyState, nowMs);
    writeJsonAtomic(workspacesPath, updatedStore);
  } catch {
    // Never break the agent loop if state file write fails
  }

  const response = getHookResponse(payload && payload.hookEventName);
  if (response) {
    process.stdout.write(response);
  }
}

main().catch(() => {
  process.exit(0);
});