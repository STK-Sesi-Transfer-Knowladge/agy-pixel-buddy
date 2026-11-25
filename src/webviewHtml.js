'use strict';

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 24; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function getWebviewHtml(
  webview,
  initialState,
  initialCharacter,
  initialFloatingMode = 'random',
  initialLanguage = 'id',
  initialPromptReaction = true,
  initialReactionTrigger = 'hook'
) {
  const nonce = getNonce();
  const safeStateJson = JSON.stringify(initialState || { state: 'idle', detail: 'Standing by' }).replace(/</g, '\\u003c');
  const safeChar = JSON.stringify(initialCharacter || 'cat').replace(/</g, '\\u003c');
  const safeFloatingMode = JSON.stringify(initialFloatingMode || 'random').replace(/</g, '\\u003c');
  const safeLang = JSON.stringify(initialLanguage === 'en' ? 'en' : 'id');
  const safePromptReaction = JSON.stringify(Boolean(initialPromptReaction));
  const safeReactionTrigger = JSON.stringify(initialReactionTrigger === 'prompt' ? 'prompt' : 'hook');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agy Pixel Buddy</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 10px;
      background: var(--vscode-sideBar-background, #181a20);
      color: var(--vscode-foreground, #e5e7eb);
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      user-select: none;
    }
    .stage-card {
      background: #12151f;
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.35);
    }
    canvas {
      width: 100%;
      max-width: 288px;
      aspect-ratio: 4 / 3;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border-radius: 6px;
      background: #0d1018;
    }
    .status-row {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 6px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 999px;
      background: #2b3245;
      color: #c7d2fe;
      flex-shrink: 0;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .badge[data-state="idle"] { background: #1e293b; color: #94a3b8; }
    .badge[data-state="thinking"] { background: #3b2f13; color: #fbbf24; }
    .badge[data-state="coding"] { background: #133829; color: #34d399; }
    .badge[data-state="reading"] { background: #172e4d; color: #60a5fa; }
    .badge[data-state="terminal"] { background: #222e18; color: #a3e635; }
    .badge[data-state="searching"] { background: #2f1f4a; color: #c084fc; }
    .badge[data-state="delegating"] { background: #3b1d36; color: #f472b6; }
    .badge[data-state="working"] { background: #1e3a3a; color: #2dd4bf; }
    .badge[data-state="done"] { background: #3a2d10; color: #fde047; }

    .detail-text {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #9ca3af);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: right;
      flex: 1;
    }
    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--vscode-descriptionForeground, #9ca3af);
      margin-bottom: 4px;
    }
    .pill-group {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    button {
      border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.12));
      background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.06));
      color: var(--vscode-button-secondaryForeground, #e5e7eb);
      border-radius: 5px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    button:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.14));
    }
    button.active {
      background: var(--vscode-button-background, #3b82f6);
      color: var(--vscode-button-foreground, #ffffff);
      border-color: transparent;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="stage-card">
    <canvas id="scene" width="96" height="72"></canvas>
    <div class="status-row">
      <span id="stateBadge" class="badge" data-state="idle">
        <span class="badge-dot"></span>
        <span id="stateLabel">IDLE</span>
      </span>
      <span id="detailText" class="detail-text">Standing by</span>
    </div>
  </div>

  <div>
    <div class="section-label" id="lblCharacter">Karakter</div>
    <div class="pill-group" id="charButtons">
      <button type="button" data-char="cat">Cat</button>
      <button type="button" data-char="bot">Bot</button>
      <button type="button" data-char="dev">Dev</button>
    </div>
  </div>

  <div>
    <div class="section-label" id="lblFloating">Mode Floating</div>
    <div class="pill-group" id="floatingModeButtons">
      <button type="button" data-float-mode="random">Random Move</button>
      <button type="button" data-float-mode="sticky">Sticky</button>
      <button type="button" data-float-mode="hidden">Hide (Off)</button>
    </div>
  </div>

  <div>
    <div class="section-label" id="lblLanguage">Bahasa</div>
    <div class="pill-group" id="langButtons">
      <button type="button" data-lang="id">Indonesia</button>
      <button type="button" data-lang="en">English</button>
    </div>
  </div>

  <div>
    <div class="section-label" id="lblReaction">Reaksi (Elus / Cambuk)</div>
    <div class="pill-group" id="reactionModeButtons">
      <button type="button" data-reaction="hook">Tiap Hook</button>
      <button type="button" data-reaction="prompt">Prompt Baru</button>
      <button type="button" data-reaction="off">Nonaktif</button>
      <button type="button" id="testReactionBtn">Tes Reaksi</button>
    </div>
  </div>

  <div>
    <div class="section-label" id="lblPreview">Preview / Mode</div>
    <div class="pill-group" id="previewButtons">
      <button type="button" data-preview="live" class="active">Live Hook</button>
      <button type="button" data-preview="thinking">Think</button>
      <button type="button" data-preview="coding">Code</button>
      <button type="button" data-preview="reading">Read</button>
      <button type="button" data-preview="terminal">Terminal</button>
      <button type="button" data-preview="done">Done</button>
    </div>
  </div>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const canvas = document.getElementById('scene');
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const stateBadge = document.getElementById('stateBadge');
      const stateLabel = document.getElementById('stateLabel');
      const detailText = document.getElementById('detailText');
      const charButtons = document.getElementById('charButtons');
      const floatingModeButtons = document.getElementById('floatingModeButtons');
      const langButtons = document.getElementById('langButtons');
      const previewButtons = document.getElementById('previewButtons');
      const lblCharacter = document.getElementById('lblCharacter');
      const lblFloating = document.getElementById('lblFloating');
      const lblLanguage = document.getElementById('lblLanguage');
      const lblReaction = document.getElementById('lblReaction');
      const lblPreview = document.getElementById('lblPreview');
      const reactionModeButtons = document.getElementById('reactionModeButtons');
      const testReactionBtn = document.getElementById('testReactionBtn');

      let liveState = ${safeStateJson};
      let previewMode = 'live';
      let currentChar = ${safeChar};
      let floatingMode = ${safeFloatingMode};
      let currentLang = ${safeLang};
      let promptReactionEnabled = ${safePromptReaction};
      let reactionTrigger = ${safeReactionTrigger};
      let reactionTicksLeft = 0;
      let tick = 0;

      const STATE_META = {
        idle: { en: 'IDLE', id: 'DIAM', accent: '#64748b' },
        thinking: { en: 'THINKING', id: 'MIKIR', accent: '#fbbf24' },
        coding: { en: 'CODING', id: 'NGODING', accent: '#34d399' },
        reading: { en: 'READING', id: 'BACA', accent: '#60a5fa' },
        terminal: { en: 'TERMINAL', id: 'TERMINAL', accent: '#a3e635' },
        searching: { en: 'SEARCHING', id: 'CARI', accent: '#c084fc' },
        delegating: { en: 'DELEGATING', id: 'DELEGASI', accent: '#f472b6' },
        working: { en: 'WORKING', id: 'KERJA', accent: '#2dd4bf' },
        done: { en: 'DONE!', id: 'SELESAI!', accent: '#fde047' }
      };

      const UI_COPY = {
        en: {
          lblCharacter: 'Character',
          lblFloating: 'Floating Mode',
          lblLanguage: 'Language',
          lblReaction: 'Reaction (Pet / Whip)',
          lblPreview: 'Preview / Mode',
          reactions: { hook: 'Every Hook', prompt: 'New Prompt', off: 'Off' },
          testReaction: 'Test',
          chars: { cat: 'Cat', bot: 'Bot', dev: 'Dev' },
          modes: { random: 'Random Move', sticky: 'Sticky', hidden: 'Hide (Off)' },
          previews: { live: 'Live Hook', thinking: 'Think', coding: 'Code', reading: 'Read', terminal: 'Terminal', done: 'Done' },
          previewDetails: {
            thinking: 'Preview: Thinking...',
            coding: 'Preview: Writing code...',
            reading: 'Preview: Reading files...',
            terminal: 'Preview: Running command...',
            done: 'Preview: Task complete!'
          }
        },
        id: {
          lblCharacter: 'Karakter',
          lblFloating: 'Mode Floating',
          lblLanguage: 'Bahasa',
          lblReaction: 'Reaksi (Elus / Cambuk)',
          lblPreview: 'Preview / Mode',
          reactions: { hook: 'Tiap Hook', prompt: 'Prompt Baru', off: 'Nonaktif' },
          testReaction: 'Tes Reaksi',
          chars: { cat: 'Kucing', bot: 'Bot', dev: 'Dev' },
          modes: { random: 'Gerak Acak', sticky: 'Sticky (Diam)', hidden: 'Sembunyikan' },
          previews: { live: 'Live Hook', thinking: 'Mikir', coding: 'Ngoding', reading: 'Baca', terminal: 'Terminal', done: 'Selesai' },
          previewDetails: {
            thinking: 'Preview: Lagi mikir...',
            coding: 'Preview: Lagi ngoding...',
            reading: 'Preview: Lagi baca file...',
            terminal: 'Preview: Jalanin perintah...',
            done: 'Preview: Tugas selesai!'
          }
        }
      };

      const DETAIL_EXACT_ID = {
        'Standing by': 'Standby',
        'Ready to help!': 'Siap bantu!',
        'Thinking...': 'Lagi mikir...',
        'Writing code...': 'Lagi ngoding...',
        'Reading code...': 'Lagi baca kode...',
        'Running command...': 'Jalanin perintah...',
        'Searching web...': 'Lagi nyari...',
        'Coordinating agents...': 'Koordinasi agen...',
        'Analyzing error...': 'Analisa error...',
        'Reviewing result...': 'Cek hasil...',
        'Wrapping up...': 'Merapikan...',
        'Task complete!': 'Tugas selesai!',
        'Stopped (error)': 'Berhenti (error)',
        'Paused by user': 'Dijeda user',
        'Working...': 'Lagi kerja...'
      };

      const DETAIL_PREFIX_ID = [
        ['Coding ', 'Ngoding '],
        ['Reading ', 'Baca '],
        ['Running ', 'Jalanin '],
        ['Searching ', 'Cari '],
        ['Exploring ', 'Telusuri '],
        ['Delegating: ', 'Delegasi: '],
        ['Using ', 'Pakai ']
      ];

      function localizeDetail(detail) {
        if (currentLang !== 'id' || !detail) return detail;
        if (DETAIL_EXACT_ID[detail]) return DETAIL_EXACT_ID[detail];
        for (const [src, dst] of DETAIL_PREFIX_ID) {
          if (detail.startsWith(src)) return dst + detail.slice(src.length);
        }
        return detail;
      }

      function activeDisplayState() {
        const copy = UI_COPY[currentLang] || UI_COPY.id;
        if (previewMode !== 'live') {
          return { state: previewMode, detail: copy.previewDetails[previewMode] || 'Preview' };
        }
        return liveState || { state: 'idle', detail: 'Standing by' };
      }

      function syncUiControls() {
        const lang = currentLang === 'en' ? 'en' : 'id';
        const copy = UI_COPY[lang];
        const display = activeDisplayState();
        const key = STATE_META[display.state] ? display.state : 'idle';
        const label = STATE_META[key][lang];
        stateBadge.setAttribute('data-state', key);
        stateLabel.textContent = label;
        detailText.textContent = previewMode !== 'live' ? display.detail : (localizeDetail(display.detail) || label);

        lblCharacter.textContent = copy.lblCharacter;
        lblFloating.textContent = copy.lblFloating;
        lblLanguage.textContent = copy.lblLanguage;
        lblReaction.textContent = copy.lblReaction;
        lblPreview.textContent = copy.lblPreview;

        const activeReactionKey = promptReactionEnabled ? reactionTrigger : 'off';
        if (reactionModeButtons) {
          reactionModeButtons.querySelectorAll('button[data-reaction]').forEach((btn) => {
            btn.textContent = copy.reactions[btn.dataset.reaction] || btn.textContent;
            btn.classList.toggle('active', btn.dataset.reaction === activeReactionKey);
          });
        }
        if (testReactionBtn) {
          testReactionBtn.textContent = copy.testReaction;
        }

        charButtons.querySelectorAll('button').forEach((btn) => {
          btn.textContent = copy.chars[btn.dataset.char] || btn.textContent;
          btn.classList.toggle('active', btn.dataset.char === currentChar);
        });
        floatingModeButtons.querySelectorAll('button').forEach((btn) => {
          btn.textContent = copy.modes[btn.dataset.floatMode] || btn.textContent;
          btn.classList.toggle('active', btn.dataset.floatMode === floatingMode);
        });
        langButtons.querySelectorAll('button').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
        previewButtons.querySelectorAll('button').forEach((btn) => {
          btn.textContent = copy.previews[btn.dataset.preview] || btn.textContent;
          btn.classList.toggle('active', btn.dataset.preview === previewMode);
        });
      }

      function px(x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      }

      function drawBackdrop(state, accent) {
        // Night studio room gradient bands
        px(0, 0, 96, 72, '#0d1018');
        px(0, 0, 96, 46, '#131826');
        // Pixel window on left wall
        px(6, 7, 20, 18, '#1f293d');
        px(8, 9, 7, 6, '#18243a');
        px(17, 9, 7, 6, '#18243a');
        px(8, 17, 7, 6, '#18243a');
        px(17, 17, 7, 6, '#18243a');
        // Twinkling pixel stars outside window
        if (tick % 24 < 18) px(10, 11, 1, 1, '#fef08a');
        if ((tick + 10) % 30 < 20) px(21, 12, 1, 1, '#93c5fd');
        px(12, 19, 1, 1, '#e2e8f0');

        // Wall shelf on right
        px(68, 14, 22, 2, '#47362b');
        px(71, 9, 3, 5, '#60a5fa');
        px(75, 8, 3, 6, '#f472b6');
        px(79, 10, 3, 4, '#34d399');

        // Wooden desk
        px(8, 49, 80, 4, '#6b4c35');
        px(8, 53, 80, 2, '#4a3323');
        px(12, 55, 4, 15, '#3b281b');
        px(80, 55, 4, 15, '#3b281b');
        // Floor shadow
        px(6, 70, 84, 2, '#090b10');

        // Cozy desk lamp / plant on right side of desk
        px(75, 43, 6, 6, '#9a4d36'); // pot
        px(74, 42, 8, 2, '#b85d43');
        px(77, 37, 2, 5, '#22c55e');
        px(74, 38, 3, 2, '#4ade80');
        px(79, 36, 3, 2, '#4ade80');

        // Coffee mug on left side of desk
        px(13, 44, 5, 5, '#e2e8f0');
        px(18, 45, 2, 3, '#cbd5e1');
        px(14, 44, 3, 1, '#78350f');
        // Coffee steam
        if (state === 'idle' || state === 'thinking') {
          const steamY = 41 - (Math.floor(tick / 6) % 3);
          px(14 + (Math.floor(tick / 8) % 2), steamY, 1, 2, 'rgba(226,232,240,0.45)');
          px(16, steamY - 2, 1, 2, 'rgba(226,232,240,0.3)');
        }

        // Monitor on center-left of desk (screen facing slightly right/front)
        px(24, 30, 22, 15, '#2d3548'); // monitor frame
        px(26, 32, 18, 11, '#0b1220'); // screen
        px(33, 45, 4, 3, '#3b4459'); // stand neck
        px(30, 48, 10, 1, '#4b5568'); // stand base

        // Soft monitor glow on desk
        px(22, 49, 26, 1, accent);

        // Screen content per state
        drawMonitorScreen(state, accent);
      }

      function drawMonitorScreen(state, accent) {
        const frame = Math.floor(tick / 3);
        if (state === 'coding') {
          const colors = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6'];
          for (let row = 0; row < 4; row += 1) {
            const lineIdx = (row + frame) % 4;
            const len = 5 + ((lineIdx * 3 + row * 2) % 9);
            px(28, 34 + row * 2, len, 1, colors[lineIdx]);
          }
          if (tick % 6 < 3) px(38, 40, 2, 1, '#ffffff');
        } else if (state === 'terminal') {
          px(28, 34, 2, 1, '#a3e635');
          px(29, 35, 1, 1, '#a3e635');
          px(28, 36, 2, 1, '#a3e635');
          const barW = 4 + (frame % 9);
          px(32, 35, barW, 1, '#4ade80');
          px(28, 39, 10, 1, '#22c55e');
          if (tick % 4 < 2) px(39, 39, 2, 2, '#bef264');
        } else if (state === 'thinking') {
          const pulse = Math.floor(tick / 5) % 3;
          px(30 + pulse * 3, 37, 2, 2, '#fbbf24');
          px(28, 34, 14, 1, '#334155');
          px(28, 40, 10, 1, '#334155');
        } else if (state === 'reading') {
          const scan = Math.floor(tick / 4) % 4;
          px(28, 34, 13, 1, '#93c5fd');
          px(28, 36, 10, 1, '#60a5fa');
          px(28, 38, 12, 1, '#93c5fd');
          px(28, 40, 8, 1, '#60a5fa');
          px(28, 34 + scan * 2, 14, 1, '#ffffff');
        } else if (state === 'searching') {
          const r = (frame % 4) + 1;
          px(34 - r, 37, 1, 1, '#c084fc');
          px(35 + r, 37, 1, 1, '#c084fc');
          px(34, 37 - Math.floor(r / 2), 2, 1, '#e879f9');
          px(34, 37 + Math.floor(r / 2), 2, 1, '#e879f9');
        } else if (state === 'done') {
          px(31, 38, 2, 2, '#fde047');
          px(33, 39, 2, 2, '#fde047');
          px(35, 37, 2, 2, '#fde047');
          px(37, 35, 2, 2, '#fde047');
        } else {
          // Idle screensaver dot
          const sx = 28 + (Math.floor(tick / 4) % 12);
          const sy = 34 + (Math.floor(tick / 7) % 6);
          px(sx, sy, 2, 2, accent);
        }
      }

      function drawCat(state, reacting) {
        const bob = reacting
          ? (tick % 4 < 2 ? 1 : 0)
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const cx = 50;
        const cy = 28 + bob;
        const blink = state === 'idle' && (tick % 48 > 44);
        const fastType = state === 'coding' || state === 'terminal';
        const leftPawUp = fastType && (tick % 4 < 2);
        const rightPawUp = fastType && (tick % 4 >= 2);

        // Tail wagging on the right
        const tailShift = Math.floor(tick / (reacting ? 3 : 8)) % 2;
        px(cx + 13, cy + 14 - tailShift, 3, 2, '#ea580c');
        px(cx + 15, cy + 11 - tailShift, 2, 4, '#f97316');

        // Body
        px(cx + 2, cy + 11, 11, 10, '#f97316');
        px(cx + 4, cy + 13, 7, 7, '#fed7aa'); // belly

        // Ears
        px(cx + 2, cy, 3, 4, '#ea580c');
        px(cx + 10, cy, 3, 4, '#ea580c');
        px(cx + 3, cy + 1, 1, 2, '#fda4af');
        px(cx + 11, cy + 1, 1, 2, '#fda4af');

        // Head
        px(cx + 1, cy + 3, 13, 9, '#fb923c');
        px(cx + 3, cy + 8, 9, 4, '#fed7aa'); // muzzle

        // Eyes
        if (reacting) {
          px(cx + 4, cy + 6, 2, 1, '#1e293b');
          px(cx + 5, cy + 5, 1, 1, '#1e293b');
          px(cx + 9, cy + 6, 2, 1, '#1e293b');
          px(cx + 10, cy + 5, 1, 1, '#1e293b');
          px(cx + 2, cy + 8, 2, 1, '#fda4af');
          px(cx + 11, cy + 8, 2, 1, '#fda4af');
        } else if (blink) {
          px(cx + 4, cy + 6, 2, 1, '#1e293b');
          px(cx + 9, cy + 6, 2, 1, '#1e293b');
        } else if (state === 'done') {
          px(cx + 4, cy + 5, 2, 1, '#1e293b');
          px(cx + 9, cy + 5, 2, 1, '#1e293b');
        } else {
          const lookOffset = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(cx + 4 + lookOffset, cy + 5, 2, 2, '#0f172a');
          px(cx + 9 + lookOffset, cy + 5, 2, 2, '#0f172a');
          px(cx + 4 + lookOffset, cy + 5, 1, 1, '#ffffff');
          px(cx + 9 + lookOffset, cy + 5, 1, 1, '#ffffff');
        }

        // Nose & mouth
        px(cx + 7, cy + 8, 1, 1, '#f43f5e');

        // Paws
        if (state === 'thinking') {
          px(cx + 1, cy + 11, 3, 3, '#fed7aa');
          px(cx + 10, cy + 17, 3, 3, '#fed7aa');
        } else {
          px(cx - 1, cy + 17 - (leftPawUp ? 2 : 0), 4, 3, '#fed7aa');
          px(cx + 4, cy + 18 - (rightPawUp ? 2 : 0), 4, 3, '#fed7aa');
        }

        // Keyboard on desk in front of cat
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawBot(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = state === 'done'
          ? (tick % 8 < 4 ? -2 : 0)
          : state === 'coding' || state === 'terminal'
            ? (tick % 4 < 2 ? -1 : 0)
            : (tick % 20 < 10 ? 0 : 1);
        const bx = 50 + (hit ? 2 : 0);
        const by = 27 + bob - (hit ? 1 : 0);

        // Antenna
        const antColor = hit
          ? '#fb7185'
          : state === 'thinking'
            ? (tick % 6 < 3 ? '#fbbf24' : '#f59e0b')
            : state === 'done'
              ? '#fde047'
              : '#38bdf8';
        px(bx + 7, by - 2, 1, 3, '#94a3b8');
        px(bx + 6, by - 4, 3, 2, antColor);

        // Head shell
        px(bx + 1, by + 1, 13, 10, '#334155');
        px(bx + 2, by + 2, 11, 8, '#0f172a'); // visor

        // Visor eyes
        if (reacting) {
          const ec = hit ? '#fde047' : '#fb7185';
          px(bx + 4, by + 5, 1, 1, ec);
          px(bx + 5, by + 6, 1, 1, ec);
          px(bx + 4, by + 7, 1, 1, ec);
          px(bx + 10, by + 5, 1, 1, ec);
          px(bx + 9, by + 6, 1, 1, ec);
          px(bx + 10, by + 7, 1, 1, ec);
        } else if (state === 'thinking') {
          const step = Math.floor(tick / 4) % 3;
          px(bx + 4 + step * 3, by + 5, 2, 2, '#fbbf24');
        } else if (state === 'done') {
          px(bx + 4, by + 5, 2, 1, '#fde047');
          px(bx + 9, by + 5, 2, 1, '#fde047');
          px(bx + 6, by + 7, 3, 1, '#fde047');
        } else if (state === 'idle' && tick % 40 > 37) {
          px(bx + 4, by + 6, 2, 1, '#38bdf8');
          px(bx + 9, by + 6, 2, 1, '#38bdf8');
        } else {
          const eyeColor = state === 'coding' ? '#34d399' : state === 'terminal' ? '#a3e635' : '#38bdf8';
          const shift = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 1) : 0;
          px(bx + 4 + shift, by + 5, 2, 2, eyeColor);
          px(bx + 9 + shift, by + 5, 2, 2, eyeColor);
        }

        // Body
        px(bx + 2, by + 12, 11, 9, '#475569');
        px(bx + 5, by + 14, 5, 4, '#1e293b');
        px(bx + 6, by + 15, 3, 2, antColor);

        // Arms
        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if (state === 'thinking' && !reacting) {
          px(bx, by + 11, 2, 4, '#64748b');
          px(bx + 13, by + 15, 2, 5, '#64748b');
        } else {
          px(bx - 1, by + 16 - lUp, 3, 3, '#64748b');
          px(bx + 12, by + 16 - rUp, 3, 3, '#64748b');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawDev(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = state === 'done'
          ? (tick % 8 < 4 ? -2 : 0)
          : state === 'coding' || state === 'terminal'
            ? (tick % 4 < 2 ? -1 : 0)
            : (tick % 24 < 12 ? 0 : 1);
        const dx = 50 + (hit ? 2 : 0);
        const dy = 27 + bob - (hit ? 1 : 0);
        const blink = state === 'idle' && (tick % 46 > 42);

        // Headphones & hair
        px(dx + 2, dy, 11, 4, '#312e81');
        px(dx + 1, dy + 3, 2, 6, '#ec4899');
        px(dx + 12, dy + 3, 2, 6, '#ec4899');

        // Face
        px(dx + 3, dy + 3, 9, 8, '#fde68a');
        px(dx + 3, dy + 2, 9, 2, '#1e1b4b');

        // Eyes
        if (reacting) {
          px(dx + 4, dy + 5, 2, 2, '#0f172a');
          px(dx + 9, dy + 5, 2, 2, '#0f172a');
          px(dx + 4, dy + 5, 1, 1, '#ffffff');
          px(dx + 9, dy + 5, 1, 1, '#ffffff');
          px(dx + 7, dy + 9, 2, 1, '#b45309');
        } else if (blink) {
          px(dx + 4, dy + 6, 2, 1, '#1e293b');
          px(dx + 9, dy + 6, 2, 1, '#1e293b');
        } else {
          const shift = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(dx + 4 + shift, dy + 5, 2, 2, '#0f172a');
          px(dx + 9 + shift, dy + 5, 2, 2, '#0f172a');
        }

        // Hoodie
        px(dx + 1, dy + 11, 13, 10, '#4f46e5');
        px(dx + 4, dy + 11, 7, 2, '#6366f1');

        // Hands
        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if (state === 'thinking' && !reacting) {
          px(dx + 1, dy + 11, 3, 3, '#fde68a');
          px(dx + 10, dy + 17, 3, 3, '#fde68a');
        } else {
          px(dx - 1, dy + 17 - lUp, 4, 3, '#fde68a');
          px(dx + 5, dy + 18 - rUp, 4, 3, '#fde68a');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawPromptReaction(char) {
        if (char === 'cat') {
          const hx = 53 + Math.round(Math.sin(tick * 0.9) * 3);
          const hy = 24 + (tick % 2);
          px(hx, hy, 7, 2, '#fde68a');
          px(hx + 1, hy + 2, 5, 1, '#f59e0b');
          px(hx + 6, hy - 1, 2, 2, '#fde68a');

          const lift = (18 - reactionTicksLeft) % 8;
          for (const [ox, oy, col] of [[68, 28 - lift, '#fb7185'], [72, 32 - ((lift + 4) % 8), '#f43f5e']]) {
            px(ox, oy, 1, 1, col);
            px(ox + 2, oy, 1, 1, col);
            px(ox, oy + 1, 3, 1, col);
            px(ox + 1, oy + 2, 1, 1, col);
          }
        } else {
          const phase = (18 - reactionTicksLeft) % 8;
          px(41, 39, 2, 4, '#78350f');
          px(42, 37, 1, 2, '#92400e');
          if (phase < 3) {
            px(41, 34, 2, 3, '#d97706');
            px(40, 31, 2, 3, '#f59e0b');
          } else if (phase < 6) {
            px(43, 36, 3, 1, '#b45309');
            px(45, 35, 4, 1, '#d97706');
            px(48, 36, 3, 1, '#f59e0b');
            if (phase === 3 || phase === 4) {
              px(50, 34, 1, 1, '#fef08a');
              px(52, 35, 2, 2, '#ffffff');
              px(50, 37, 1, 1, '#fb7185');
              px(53, 33, 1, 1, '#fde047');
            }
          } else {
            px(43, 38, 4, 1, '#b45309');
            px(46, 39, 3, 1, '#d97706');
          }
          px(68, 23, 2, 4, '#ef4444');
          px(68, 28, 2, 2, '#ef4444');
          px(71, 30 + (phase % 2), 2, 2, '#60a5fa');
        }
      }

      function drawOverlayParticles(state) {
        if (state === 'thinking') {
          // Thought bubble above character
          px(57, 23, 2, 2, '#f8fafc');
          px(60, 19, 3, 3, '#f8fafc');
          px(57, 8, 15, 9, '#f8fafc');
          px(58, 7, 13, 11, '#f8fafc');
          const phase = Math.floor(tick / 6) % 4;
          if (phase < 3) {
            for (let i = 0; i <= phase; i += 1) {
              px(60 + i * 3, 12, 2, 2, '#f59e0b');
            }
          } else {
            // Pixel question mark
            px(63, 9, 3, 1, '#d97706');
            px(65, 10, 1, 2, '#d97706');
            px(64, 12, 1, 1, '#d97706');
            px(64, 14, 1, 1, '#d97706');
          }
        } else if (state === 'coding') {
          const offset = tick % 12;
          px(33, 25 - offset, 2, 2, '#34d399');
          px(41, 22 - ((tick + 6) % 12), 2, 2, '#60a5fa');
          px(49, 20 - ((tick + 3) % 10), 2, 1, '#fbbf24');
        } else if (state === 'terminal') {
          const offset = tick % 10;
          px(31, 24 - offset, 2, 2, '#a3e635');
          px(39, 26 - ((tick + 5) % 10), 2, 2, '#4ade80');
        } else if (state === 'reading') {
          const floatY = 16 + (Math.floor(tick / 6) % 2);
          px(57, floatY, 7, 8, '#dbeafe');
          px(58, floatY + 2, 5, 1, '#3b82f6');
          px(58, floatY + 4, 4, 1, '#3b82f6');
        } else if (state === 'searching' || state === 'delegating') {
          const r = (Math.floor(tick / 4) % 5) + 1;
          px(57 + r * 2, 18 - r, 2, 2, state === 'searching' ? '#c084fc' : '#f472b6');
          px(55, 20, 2, 2, '#e879f9');
        } else if (state === 'done') {
          const lift = Math.floor(tick / 3) % 6;
          px(47, 16 - lift, 2, 2, '#fde047');
          px(63, 14 - ((lift + 3) % 6), 2, 2, '#34d399');
          px(55, 10 - ((lift + 1) % 6), 2, 2, '#f472b6');
        }
      }

      function render() {
        const display = activeDisplayState();
        const state = STATE_META[display.state] ? display.state : 'idle';
        const accent = STATE_META[state].accent;
        const reacting = reactionTicksLeft > 0;

        drawBackdrop(state, accent);
        if (currentChar === 'bot') {
          drawBot(state, reacting);
        } else if (currentChar === 'dev') {
          drawDev(state, reacting);
        } else {
          drawCat(state, reacting);
        }
        if (reacting) {
          drawPromptReaction(currentChar);
          reactionTicksLeft -= 1;
        } else {
          drawOverlayParticles(state);
        }

        tick = (tick + 1) % 10000;
      }

      charButtons.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-char]');
        if (!btn) return;
        currentChar = btn.dataset.char;
        syncUiControls();
        vscode.postMessage({ type: 'setCharacter', character: currentChar });
      });

      previewButtons.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-preview]');
        if (!btn) return;
        previewMode = btn.dataset.preview;
        syncUiControls();
      });

      floatingModeButtons.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-float-mode]');
        if (!btn) return;
        floatingMode = btn.dataset.floatMode;
        syncUiControls();
        vscode.postMessage({ type: 'setFloatingMode', mode: floatingMode });
      });

      langButtons.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-lang]');
        if (!btn) return;
        currentLang = btn.dataset.lang;
        syncUiControls();
        vscode.postMessage({ type: 'setLanguage', language: currentLang });
      });

      if (reactionModeButtons) {
        reactionModeButtons.addEventListener('click', (event) => {
          const btn = event.target.closest('button[data-reaction]');
          if (!btn) return;
          const choice = btn.dataset.reaction;
          if (choice === 'off') {
            promptReactionEnabled = false;
            syncUiControls();
            vscode.postMessage({ type: 'setReactionSetting', enabled: false });
          } else {
            promptReactionEnabled = true;
            reactionTrigger = choice === 'prompt' ? 'prompt' : 'hook';
            syncUiControls();
            vscode.postMessage({ type: 'setReactionSetting', enabled: true, trigger: reactionTrigger });
          }
        });
      }

      if (testReactionBtn) {
        testReactionBtn.addEventListener('click', () => {
          reactionTicksLeft = 18;
          vscode.postMessage({ type: 'testReaction' });
        });
      }

      canvas.addEventListener('click', () => {
        const display = activeDisplayState();
        if (display && display.state === 'idle') {
          reactionTicksLeft = 18;
        }
      });

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'stateUpdate') {
          liveState = msg.payload || liveState;
          syncUiControls();
        } else if (msg.type === 'characterUpdate' && msg.character) {
          currentChar = msg.character;
          syncUiControls();
        } else if (msg.type === 'floatingModeUpdate' && msg.mode) {
          floatingMode = msg.mode;
          syncUiControls();
        } else if (msg.type === 'languageUpdate' && msg.language) {
          currentLang = msg.language;
          syncUiControls();
        } else if (msg.type === 'reactionSettingUpdate') {
          promptReactionEnabled = Boolean(msg.enabled);
          reactionTrigger = msg.trigger === 'prompt' ? 'prompt' : 'hook';
          syncUiControls();
        } else if (msg.type === 'triggerPromptReaction') {
          reactionTicksLeft = msg.trigger === 'hook' ? 12 : 18;
        }
      });

      syncUiControls();
      render();
      setInterval(render, 125);
      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  getWebviewHtml
};
