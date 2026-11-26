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
  initialReactionTrigger = 'hook',
  initialTrainer = 'boss',
  initialFloatingScale = 3
) {
  const nonce = getNonce();
  const safeStateJson = JSON.stringify(initialState || { state: 'idle', detail: 'Standing by' }).replace(/</g, '\\u003c');
  const safeChar = JSON.stringify(initialCharacter || 'cat').replace(/</g, '\\u003c');
  const safeTrainer = JSON.stringify(['boss', 'girl', 'sensei', 'naruto', 'jokowi', 'prabowo', 'trump', 'putin', 'kim', 'fufufafa'].includes(initialTrainer) ? initialTrainer : 'boss');
  const safeFloatingMode = JSON.stringify(initialFloatingMode || 'random').replace(/</g, '\\u003c');
  const safeFloatingScale = JSON.stringify([2, 3, 4].includes(Number(initialFloatingScale)) ? Number(initialFloatingScale) : 3);
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
      <button type="button" data-char="kyubi">Kyubi</button>
      <button type="button" data-char="jokowi">Bapak Fufufafa</button>
      <button type="button" data-char="prabowo">El Gemoy</button>
      <button type="button" data-char="trump">Mr. Tariff</button>
      <button type="button" data-char="putin">Bos Meja Panjang</button>
      <button type="button" data-char="kim">Rocket Man</button>
      <button type="button" data-char="fufufafa">Fufufafa</button>
    </div>
  </div>

  <div>
    <div class="section-label" id="lblTrainer">Pengasuh / Bos</div>
    <div class="pill-group" id="trainerButtons">
      <button type="button" data-trainer="boss">Bos</button>
      <button type="button" data-trainer="girl">Cewek</button>
      <button type="button" data-trainer="sensei">Sensei</button>
      <button type="button" data-trainer="naruto">Naruto</button>
      <button type="button" data-trainer="jokowi">Bapak Fufufafa</button>
      <button type="button" data-trainer="prabowo">El Gemoy</button>
      <button type="button" data-trainer="trump">Mr. Tariff</button>
      <button type="button" data-trainer="putin">Bos Meja Panjang</button>
      <button type="button" data-trainer="kim">Rocket Man</button>
      <button type="button" data-trainer="fufufafa">Fufufafa</button>
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
    <div class="section-label" id="lblFloatingScale">Ukuran Floating</div>
    <div class="pill-group" id="floatingScaleButtons">
      <button type="button" data-float-scale="2">2x</button>
      <button type="button" data-float-scale="3">3x</button>
      <button type="button" data-float-scale="4">4x</button>
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
      const trainerButtons = document.getElementById('trainerButtons');
      const floatingModeButtons = document.getElementById('floatingModeButtons');
      const floatingScaleButtons = document.getElementById('floatingScaleButtons');
      const langButtons = document.getElementById('langButtons');
      const previewButtons = document.getElementById('previewButtons');
      const lblCharacter = document.getElementById('lblCharacter');
      const lblTrainer = document.getElementById('lblTrainer');
      const lblFloating = document.getElementById('lblFloating');
      const lblFloatingScale = document.getElementById('lblFloatingScale');
      const lblLanguage = document.getElementById('lblLanguage');
      const lblReaction = document.getElementById('lblReaction');
      const lblPreview = document.getElementById('lblPreview');
      const reactionModeButtons = document.getElementById('reactionModeButtons');
      const testReactionBtn = document.getElementById('testReactionBtn');

      let liveState = ${safeStateJson};
      let previewMode = 'live';
      let currentChar = ${safeChar};
      let currentTrainer = ${safeTrainer};
      let floatingMode = ${safeFloatingMode};
      let floatingScale = ${safeFloatingScale};
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
          lblTrainer: 'Caretaker / Whipper',
          lblFloating: 'Floating Mode',
          lblFloatingScale: 'Floating Size',
          lblLanguage: 'Language',
          lblReaction: 'Reaction (Pet / Whip)',
          lblPreview: 'Preview / Mode',
          reactions: { hook: 'Every Hook', prompt: 'New Prompt', off: 'Off' },
          testReaction: 'Test',
          chars: { cat: 'Cat', bot: 'Bot', dev: 'Dev', kyubi: 'Kyubi', jokowi: 'Father of Fufufafa', prabowo: 'El Gemoy', trump: 'Mr. Tariff', putin: 'Mr. Long Table', kim: 'Rocket Man', fufufafa: 'Fufufafa' },
          trainers: { boss: 'Boss', girl: 'Girl', sensei: 'Sensei', naruto: 'Naruto', jokowi: 'Father of Fufufafa', prabowo: 'El Gemoy', trump: 'Mr. Tariff', putin: 'Mr. Long Table', kim: 'Rocket Man', fufufafa: 'Fufufafa' },
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
          lblTrainer: 'Pengasuh / Pencambuk',
          lblFloating: 'Mode Floating',
          lblFloatingScale: 'Ukuran Floating',
          lblLanguage: 'Bahasa',
          lblReaction: 'Reaksi (Elus / Cambuk)',
          lblPreview: 'Preview / Mode',
          reactions: { hook: 'Tiap Hook', prompt: 'Prompt Baru', off: 'Nonaktif' },
          testReaction: 'Tes Reaksi',
          chars: { cat: 'Kucing', bot: 'Bot', dev: 'Dev', kyubi: 'Kyubi', jokowi: 'Bapak Fufufafa', prabowo: 'El Gemoy', trump: 'Mr. Tariff', putin: 'Bos Meja Panjang', kim: 'Rocket Man', fufufafa: 'Fufufafa' },
          trainers: { boss: 'Bos', girl: 'Cewek', sensei: 'Sensei', naruto: 'Naruto', jokowi: 'Bapak Fufufafa', prabowo: 'El Gemoy', trump: 'Mr. Tariff', putin: 'Bos Meja Panjang', kim: 'Rocket Man', fufufafa: 'Fufufafa' },
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
        if (lblTrainer) lblTrainer.textContent = copy.lblTrainer;
        lblFloating.textContent = copy.lblFloating;
        if (lblFloatingScale) lblFloatingScale.textContent = copy.lblFloatingScale;
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
        if (trainerButtons) {
          trainerButtons.querySelectorAll('button').forEach((btn) => {
            btn.textContent = copy.trainers[btn.dataset.trainer] || btn.textContent;
            btn.classList.toggle('active', btn.dataset.trainer === currentTrainer);
          });
        }
        floatingModeButtons.querySelectorAll('button').forEach((btn) => {
          btn.textContent = copy.modes[btn.dataset.floatMode] || btn.textContent;
          btn.classList.toggle('active', btn.dataset.floatMode === floatingMode);
        });
        if (floatingScaleButtons) {
          floatingScaleButtons.querySelectorAll('button').forEach((btn) => {
            btn.classList.toggle('active', Number(btn.dataset.floatScale) === Number(floatingScale));
          });
        }
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
        if (currentChar === 'prabowo') {
          // Perkebunan sawit background for El Gemoy
          px(0, 0, 96, 34, '#0284c7');
          px(0, 14, 96, 20, '#38bdf8');
          px(0, 24, 96, 12, '#7dd3fc');
          // Tropical sun & clouds
          px(10, 6, 7, 7, '#fde047');
          px(11, 7, 5, 5, '#fef08a');
          px(64, 8, 12, 3, '#e0f2fe');
          px(66, 6, 7, 2, '#f8fafc');
          // Green plantation hills
          px(0, 32, 96, 17, '#166534');
          px(0, 36, 96, 13, '#15803d');
          // Rows of oil palm trees (pohon sawit)
          const sway = Math.floor(tick / 10) % 2;
          for (const [tx, ty, h] of [[8, 22, 16], [26, 26, 14], [46, 25, 14], [70, 21, 17], [86, 25, 14]]) {
            px(tx, ty, 2, h, '#78350f');
            px(tx - 1, ty, 1, 2, '#ea580c');
            px(tx - 4 + sway, ty - 2, 5, 1, '#16a34a');
            px(tx - 5 + sway, ty - 1, 2, 1, '#22c55e');
            px(tx + 1 + sway, ty - 2, 5, 1, '#16a34a');
            px(tx + 5 + sway, ty - 1, 2, 1, '#22c55e');
            px(tx - 2, ty - 4, 3, 2, '#22c55e');
            px(tx + 1, ty - 4, 3, 2, '#15803d');
            px(tx - 1, ty - 5, 4, 2, '#4ade80');
          }
        } else if (currentChar === 'jokowi') {
          // Gedung IKN (Istana Garuda) yang lebih mirip aslinya
          px(0, 0, 96, 20, '#0f172a');
          px(0, 16, 96, 14, '#1e1b4b');
          px(0, 26, 96, 12, '#92400e');
          px(0, 35, 96, 14, '#14532d');
          if (tick % 24 < 18) px(8, 6, 1, 1, '#fef08a');
          if ((tick + 8) % 28 < 20) px(86, 7, 1, 1, '#93c5fd');
          // Wide sweeping dark-bronze & oxidized-teal Garuda wings across skyline
          for (let i = 0; i < 6; i += 1) {
            const w = 8 + i * 2;
            px(8 + i * 5, 11 + i * 3, w, 3, i % 2 === 0 ? '#1e293b' : '#334155');
            px(9 + i * 5, 12 + i * 3, w - 3, 1, '#0f766e');
            px(80 - i * 5, 11 + i * 3, w, 3, i % 2 === 0 ? '#1e293b' : '#334155');
            px(81 - i * 5, 12 + i * 3, w - 3, 1, '#0f766e');
          }
          // Garuda torso & proud crested head facing slightly left
          px(42, 13, 12, 14, '#1e293b');
          px(44, 15, 8, 10, '#334155');
          px(45, 7, 6, 6, '#334155');
          px(46, 5, 4, 2, '#475569'); // crown crest
          px(43, 9, 2, 2, '#64748b'); // curved beak
          // Monumental white-granite terraced palace podium & warm floodlights
          px(26, 27, 44, 11, '#e2e8f0');
          px(22, 34, 52, 6, '#cbd5e1');
          for (let c = 28; c <= 66; c += 4) {
            px(c, 28, 1, 9, '#475569');
            px(c + 2, 30, 1, 4, '#fde047');
          }
          // Merah Putih flagpole & Kalimantan green lawn
          px(18, 28, 1, 14, '#cbd5e1');
          px(19, 28, 5, 2, '#ef4444');
          px(19, 30, 5, 2, '#f8fafc');
          px(0, 40, 96, 9, '#166534');
        } else if (currentChar === 'trump') {
          // Satire: Gold Tower, "THE WALL" bricks & giant $ sign
          px(0, 0, 96, 28, '#1e3a8a');
          px(0, 26, 96, 23, '#b45309'); // brick wall base
          for (let wy = 28; wy < 48; wy += 4) {
            px(0, wy, 96, 1, '#78350f');
            for (let wx = (wy % 8 === 0 ? 0 : 4); wx < 96; wx += 8) {
              px(wx, wy, 1, 4, '#78350f');
            }
          }
          // Golden Trump Tower silhouette on left
          px(8, 6, 16, 22, '#ca8a04');
          px(10, 8, 12, 18, '#facc15');
          px(12, 10, 8, 14, '#fef08a');
          px(14, 3, 4, 3, '#fde047');
          // Red MAGA cap & gold "$" trophy on right shelf
          px(70, 14, 20, 2, '#78350f');
          px(73, 10, 6, 4, '#dc2626');
          px(71, 13, 4, 1, '#991b1b');
          px(82, 8, 5, 6, '#facc15');
          px(84, 9, 1, 4, '#16a34a');
        } else if (currentChar === 'putin') {
          // Satire: Kremlin onion domes + snowy window + ultra-long white table
          px(0, 0, 96, 49, '#1e293b');
          // Frosty window showing Kremlin red star & onion domes
          px(6, 5, 28, 22, '#0f172a');
          px(8, 7, 24, 18, '#bae6fd');
          px(12, 14, 4, 11, '#991b1b');
          px(13, 10, 2, 4, '#dc2626');
          px(13, 8, 2, 2, '#ef4444'); // red star
          px(21, 16, 5, 9, '#f59e0b');
          px(22, 13, 3, 3, '#fbbf24');
          // Ultra-long white conference table silhouette across wall
          px(38, 24, 52, 4, '#f8fafc');
          px(40, 28, 3, 14, '#cbd5e1');
          px(85, 28, 3, 14, '#cbd5e1');
          // Red "TOP SECRET" folder on shelf
          px(70, 12, 18, 2, '#47362b');
          px(74, 8, 8, 4, '#dc2626');
          px(76, 9, 4, 1, '#fef08a');
        } else if (currentChar === 'kim') {
          // Satire: Rocket launchpad + red star propaganda banner
          px(0, 0, 96, 49, '#1f161b');
          // Red banner & gold star on wall
          px(36, 4, 26, 10, '#991b1b');
          px(47, 6, 4, 4, '#facc15');
          px(48, 5, 2, 6, '#fde047');
          // Rocket launch window on left
          px(6, 6, 22, 24, '#0f172a');
          px(8, 8, 18, 20, '#1e293b');
          // Giant striped rocket
          const rumble = tick % 4 < 2 ? 0 : 1;
          px(15, 10 + rumble, 4, 12, '#f8fafc');
          px(16, 8 + rumble, 2, 2, '#dc2626');
          px(13, 19 + rumble, 2, 3, '#dc2626');
          px(19, 19 + rumble, 2, 3, '#dc2626');
          px(14, 22, 6, 4, '#f97316');
          px(15, 24, 4, 3, '#fde047');
          // Big red launch button on right shelf
          px(70, 14, 18, 2, '#47362b');
          px(75, 11, 8, 3, '#334155');
          px(77, 9, 4, 2, '#ef4444');
        } else if (currentChar === 'fufufafa') {
          // Kaskus forum background for Fufufafa
          px(0, 0, 96, 49, '#0f294a');
          // Kaskus top navbar (blue + orange stripe)
          px(0, 0, 96, 7, '#1d4ed8');
          px(0, 7, 96, 2, '#f97316');
          // Kaskus "K" pixel badge on left wall
          px(6, 12, 14, 14, '#1e40af');
          px(8, 14, 3, 10, '#f8fafc');
          px(11, 18, 2, 2, '#f97316');
          px(13, 15, 3, 3, '#f97316');
          px(13, 20, 3, 4, '#f97316');
          // Forum thread cards on wall
          px(24, 12, 46, 8, '#163a66');
          px(26, 14, 18, 2, '#f97316');
          px(26, 17, 32, 1, '#93c5fd');
          px(24, 22, 46, 8, '#163a66');
          px(26, 24, 22, 2, '#38bdf8');
          px(26, 27, 28, 1, '#cbd5e1');
          // Cendol shelf on right
          px(72, 14, 20, 2, '#47362b');
          px(75, 9, 4, 5, '#22c55e');
          px(76, 8, 2, 1, '#dcfce7');
          px(81, 9, 4, 5, '#22c55e');
          px(82, 8, 2, 1, '#dcfce7');
        } else {
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
        }
        // Dark floor below desk
        px(0, 49, 96, 23, '#0d1018');

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

        if (currentChar === 'kyubi' && state === 'idle') {
          // Glowing Kyubi chakra aura on desk instead of coffee mug
          const pulse = Math.floor(tick / 4) % 2;
          px(14, 46 - pulse, 3, 3, 'rgba(249,115,22,0.55)');
          px(15, 45 - pulse, 1, 1, '#fef08a');
        } else if (currentChar === 'prabowo') {
          // Mini pohon sawit (oil palm tree) on left side of desk instead of coffee mug
          const sway = Math.floor(tick / 10) % 2;
          px(14, 47, 5, 2, '#92400e');
          px(16, 41, 2, 6, '#78350f');
          px(15, 43, 1, 1, '#a16207');
          px(18, 44, 1, 1, '#a16207');
          px(15, 40, 2, 2, '#ea580c');
          px(17, 40, 1, 1, '#f97316');
          px(11 + sway, 39, 5, 1, '#16a34a');
          px(10 + sway, 40, 2, 1, '#22c55e');
          px(17 + sway, 39, 5, 1, '#16a34a');
          px(21 + sway, 40, 2, 1, '#22c55e');
          px(13, 37, 3, 2, '#22c55e');
          px(17, 37, 3, 2, '#15803d');
          px(15, 36, 3, 2, '#4ade80');
        } else {
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
        const bx = 50 - (hit ? 2 : 0);
        const by = 27 + bob + (hit ? 1 : 0);

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

      function drawJokowi(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = reacting
          ? 0
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const jx = 50 - (hit ? 2 : 0);
        const jy = 26 + (hit ? 1 : 0) + bob;
        const blink = state === 'idle' && (tick % 46 > 42);

        // Sleek side-parted black hair with higher forehead & slight volume on left
        px(jx + 4, jy, 7, 2, '#0f172a');
        px(jx + 3, jy + 1, 9, 2, '#1e293b');
        px(jx + 5, jy + 1, 2, 1, '#475569');
        px(jx + 3, jy + 3, 1, 3, '#0f172a');
        px(jx + 11, jy + 3, 1, 3, '#0f172a');

        // Slimmer oval face with warm tan skin & cheekbones
        px(jx + 4, jy + 3, 7, 8, '#dfa670');
        px(jx + 3, jy + 5, 9, 4, '#dfa670');
        px(jx + 5, jy + 11, 5, 1, '#c98a55');
        px(jx + 3, jy + 7, 1, 2, '#c98a55');
        px(jx + 11, jy + 7, 1, 2, '#c98a55');

        // Subtle eyebrows & nose bridge
        px(jx + 4, jy + 5, 2, 1, '#1e293b');
        px(jx + 9, jy + 5, 2, 1, '#1e293b');
        px(jx + 7, jy + 7, 1, 2, '#c98a55');

        // Eyes & signature warm grin
        if (reacting) {
          px(jx + 4, jy + 6, 2, 2, '#0f172a');
          px(jx + 9, jy + 6, 2, 2, '#0f172a');
          px(jx + 4, jy + 6, 1, 1, '#ffffff');
          px(jx + 9, jy + 6, 1, 1, '#ffffff');
          px(jx + 6, jy + 10, 3, 1, '#7c2d12');
        } else if (blink || state === 'idle') {
          px(jx + 4, jy + 7, 2, 1, '#1e293b');
          px(jx + 9, jy + 7, 2, 1, '#1e293b');
          px(jx + 6, jy + 10, 3, 1, '#ffffff');
        } else {
          const shift = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(jx + 4 + shift, jy + 6, 2, 2, '#0f172a');
          px(jx + 9 + shift, jy + 6, 2, 2, '#0f172a');
          px(jx + 6, jy + 10, 3, 1, '#ffffff');
        }

        // Slimmer white shirt with collar, front placket, chest pocket & rolled-up sleeves
        px(jx + 2, jy + 12, 11, 8, '#f8fafc');
        px(jx + 4, jy + 12, 7, 2, '#e2e8f0');
        px(jx + 7, jy + 14, 1, 6, '#cbd5e1');
        px(jx + 9, jy + 15, 3, 2, '#e2e8f0');
        // Rolled sleeve cuffs + exposed forearms
        px(jx + 1, jy + 13, 2, 3, '#e2e8f0');
        px(jx + 12, jy + 13, 2, 3, '#e2e8f0');
        px(jx + 1, jy + 16, 2, 2, '#dfa670');
        px(jx + 12, jy + 16, 2, 2, '#dfa670');
        // Black belt/trousers
        px(jx + 2, jy + 20, 11, 2, '#0f172a');

        // Hands
        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if (state === 'thinking' && !reacting) {
          px(jx + 1, jy + 12, 3, 3, '#dfa670');
          px(jx + 10, jy + 18, 3, 3, '#dfa670');
        } else {
          px(jx - 1, jy + 18 - lUp, 4, 3, '#dfa670');
          px(jx + 5, jy + 19 - rUp, 4, 3, '#dfa670');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawPrabowo(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = reacting
          ? 0
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const px0 = 50 - (hit ? 2 : 0);
        const py0 = 26 + (hit ? 1 : 0) + bob;
        const blink = state === 'idle' && (tick % 46 > 42);

        // Iconic black Peci cap + dark hair sides
        px(px0 + 3, py0, 9, 4, '#0f172a');
        px(px0 + 4, py0, 7, 1, '#1e293b');
        px(px0 + 2, py0 + 4, 1, 3, '#334155');
        px(px0 + 12, py0 + 4, 1, 3, '#334155');

        // Face & thick eyebrows
        px(px0 + 3, py0 + 4, 9, 8, '#f3c99b');
        px(px0 + 4, py0 + 5, 2, 1, '#1e293b');
        px(px0 + 9, py0 + 5, 2, 1, '#1e293b');

        // Eyes & expression
        if (reacting) {
          px(px0 + 4, py0 + 6, 2, 2, '#0f172a');
          px(px0 + 9, py0 + 6, 2, 2, '#0f172a');
          px(px0 + 4, py0 + 6, 1, 1, '#ffffff');
          px(px0 + 9, py0 + 6, 1, 1, '#ffffff');
          px(px0 + 6, py0 + 10, 3, 1, '#9a3412');
        } else if (blink) {
          px(px0 + 4, py0 + 7, 2, 1, '#1e293b');
          px(px0 + 9, py0 + 7, 2, 1, '#1e293b');
        } else {
          const shift = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(px0 + 4 + shift, py0 + 6, 2, 2, '#0f172a');
          px(px0 + 9 + shift, py0 + 6, 2, 2, '#0f172a');
          px(px0 + 6, py0 + 10, 3, 1, '#9a3412');
        }

        // Cream/khaki safari shirt with chest pockets
        px(px0 + 1, py0 + 12, 13, 10, '#e5d5b5');
        px(px0 + 4, py0 + 12, 7, 2, '#f5efe2');
        px(px0 + 2, py0 + 15, 3, 3, '#c7b28a');
        px(px0 + 10, py0 + 15, 3, 3, '#c7b28a');
        px(px0 + 7, py0 + 14, 1, 6, '#b8a074');

        // Hands
        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if (state === 'thinking' && !reacting) {
          px(px0 + 1, py0 + 12, 3, 3, '#f3c99b');
          px(px0 + 10, py0 + 18, 3, 3, '#f3c99b');
        } else {
          px(px0 - 1, py0 + 18 - lUp, 4, 3, '#f3c99b');
          px(px0 + 5, py0 + 19 - rUp, 4, 3, '#f3c99b');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawTrump(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = reacting
          ? 0
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const tx = 50 - (hit ? 2 : 0);
        const ty = 26 + (hit ? 1 : 0) + bob;
        const blink = state === 'idle' && (tick % 46 > 42);

        // Swooped golden-blonde comb-over hair
        px(tx + 2, ty - 1, 10, 3, '#facc15');
        px(tx + 1, ty, 5, 2, '#fde047');
        px(tx + 11, ty + 1, 2, 3, '#eab308');
        px(tx + 2, ty + 2, 10, 2, '#eab308');

        // Orange-tan face with pale eye area
        px(tx + 3, ty + 4, 9, 8, '#fb923c');
        px(tx + 4, ty + 5, 3, 2, '#fdba74');
        px(tx + 8, ty + 5, 3, 2, '#fdba74');

        // Brows & eyes
        px(tx + 4, jyOffset(ty, 5), 2, 1, '#eab308');
        px(tx + 9, jyOffset(ty, 5), 2, 1, '#eab308');
        if (reacting) {
          px(tx + 4, ty + 6, 2, 2, '#0f172a');
          px(tx + 9, ty + 6, 2, 2, '#0f172a');
          px(tx + 4, ty + 6, 1, 1, '#ffffff');
          px(tx + 9, ty + 6, 1, 1, '#ffffff');
          px(tx + 6, ty + 10, 3, 1, '#9a3412');
        } else if (blink) {
          px(tx + 4, ty + 7, 2, 1, '#1e293b');
          px(tx + 9, ty + 7, 2, 1, '#1e293b');
        } else {
          const shift = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(tx + 4 + shift, ty + 6, 2, 2, '#0f172a');
          px(tx + 9 + shift, ty + 6, 2, 2, '#0f172a');
          px(tx + 6, ty + 10, 3, 1, '#c2410c');
        }

        // Navy suit, white collar & long red tie
        px(tx + 1, ty + 12, 13, 10, '#1e293b');
        px(tx + 5, ty + 12, 5, 3, '#f8fafc');
        px(tx + 6, ty + 13, 3, 2, '#dc2626');
        px(tx + 7, ty + 15, 1, 7, '#ef4444');

        // Hands
        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if (state === 'thinking' && !reacting) {
          px(tx + 1, ty + 12, 3, 3, '#fdba74');
          px(tx + 10, ty + 18, 3, 3, '#fdba74');
        } else {
          px(tx - 1, ty + 18 - lUp, 4, 3, '#fdba74');
          px(tx + 5, ty + 19 - rUp, 4, 3, '#fdba74');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function jyOffset(y, off) {
        return y + off;
      }

      function drawPutin(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = reacting
          ? 0
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const ux = 50 - (hit ? 2 : 0);
        const uy = 26 + (hit ? 1 : 0) + bob;
        const blink = state === 'idle' && (tick % 46 > 42);

        // High receding hairline with thin ash-blonde hair on sides
        px(ux + 4, uy + 1, 7, 1, '#cbd5e1');
        px(ux + 3, uy + 2, 2, 3, '#94a3b8');
        px(ux + 10, uy + 2, 2, 3, '#94a3b8');

        // Fair cool face
        px(ux + 3, uy + 2, 9, 10, '#fde68a');
        px(ux + 4, uy + 1, 7, 1, '#fde68a');
        px(ux + 4, uy + 5, 2, 1, '#94a3b8');
        px(ux + 9, uy + 5, 2, 1, '#94a3b8');

        if (reacting) {
          px(ux + 4, uy + 6, 2, 2, '#0f172a');
          px(ux + 9, uy + 6, 2, 2, '#0f172a');
          px(ux + 4, uy + 6, 1, 1, '#ffffff');
          px(ux + 9, uy + 6, 1, 1, '#ffffff');
          px(ux + 6, uy + 10, 3, 1, '#b45309');
        } else if (blink) {
          px(ux + 4, uy + 7, 2, 1, '#1e293b');
          px(ux + 9, uy + 7, 2, 1, '#1e293b');
        } else {
          const shift = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(ux + 4 + shift, uy + 6, 2, 1, '#0f172a');
          px(ux + 9 + shift, uy + 6, 2, 1, '#0f172a');
          px(ux + 6, uy + 10, 3, 1, '#b45309');
        }

        // Dark charcoal suit, white shirt & burgundy tie
        px(ux + 1, uy + 12, 13, 10, '#0f172a');
        px(ux + 5, uy + 12, 5, 3, '#f8fafc');
        px(ux + 7, uy + 13, 1, 6, '#991b1b');

        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if (state === 'thinking' && !reacting) {
          px(ux + 1, uy + 12, 3, 3, '#fde68a');
          px(ux + 10, uy + 18, 3, 3, '#fde68a');
        } else {
          px(ux - 1, uy + 18 - lUp, 4, 3, '#fde68a');
          px(ux + 5, uy + 19 - rUp, 4, 3, '#fde68a');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawKim(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = reacting
          ? 0
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const mx = 50 - (hit ? 2 : 0);
        const my = 26 + (hit ? 1 : 0) + bob;
        const blink = state === 'idle' && (tick % 46 > 42);

        // Iconic flat-top trapezoid black hair with shaved sides
        px(mx + 3, my - 1, 9, 4, '#0f172a');
        px(mx + 2, my, 1, 2, '#1e293b');
        px(mx + 12, my, 1, 2, '#1e293b');

        // Rounder face & cheeks
        px(mx + 2, my + 3, 11, 9, '#f5cfa0');
        px(mx + 3, my + 11, 9, 1, '#e5b887');

        if (reacting) {
          px(mx + 4, my + 6, 2, 2, '#0f172a');
          px(mx + 9, my + 6, 2, 2, '#0f172a');
          px(mx + 4, my + 6, 1, 1, '#ffffff');
          px(mx + 9, my + 6, 1, 1, '#ffffff');
          px(mx + 6, my + 10, 3, 1, '#9a3412');
        } else if (blink) {
          px(mx + 4, my + 7, 2, 1, '#1e293b');
          px(mx + 9, my + 7, 2, 1, '#1e293b');
        } else {
          const shift = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(mx + 4 + shift, my + 6, 2, 2, '#0f172a');
          px(mx + 9 + shift, my + 6, 2, 2, '#0f172a');
          px(mx + 6, my + 10, 3, 1, '#b45309');
        }

        // Dark charcoal Mao suit (mandarin collar, buttoned center)
        px(mx + 1, my + 12, 13, 10, '#1e293b');
        px(mx + 4, my + 12, 7, 2, '#334155');
        px(mx + 7, my + 14, 1, 6, '#0f172a');

        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if (state === 'thinking' && !reacting) {
          px(mx + 1, my + 12, 3, 3, '#f5cfa0');
          px(mx + 10, my + 18, 3, 3, '#f5cfa0');
        } else {
          px(mx - 1, my + 18 - lUp, 4, 3, '#f5cfa0');
          px(mx + 5, my + 19 - rUp, 4, 3, '#f5cfa0');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawFufufafa(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && phase >= 3 && phase <= 5;
        const bob = reacting
          ? 0
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const fx = 50 - (hit ? 2 : 0);
        const fy = 26 + (hit ? 1 : 0) + bob;
        const blink = state === 'idle' && (tick % 46 > 42);

        // Short neat swept black hair
        px(fx + 3, fy, 9, 4, '#0f172a');
        px(fx + 4, fy, 6, 1, '#1e293b');
        px(fx + 11, fy + 2, 1, 4, '#1e293b');

        // Face & serious focused expression (brows slightly furrowed)
        px(fx + 3, fy + 4, 9, 8, '#f0c495');
        px(fx + 4, fy + 5, 2, 1, '#1e293b');
        px(fx + 9, fy + 5, 2, 1, '#1e293b');

        if (reacting) {
          px(fx + 4, fy + 6, 2, 2, '#0f172a');
          px(fx + 9, fy + 6, 2, 2, '#0f172a');
          px(fx + 4, fy + 6, 1, 1, '#ffffff');
          px(fx + 9, fy + 6, 1, 1, '#ffffff');
          px(fx + 6, fy + 10, 3, 1, '#9a3412');
        } else if (blink) {
          px(fx + 4, fy + 7, 2, 1, '#1e293b');
          px(fx + 9, fy + 7, 2, 1, '#1e293b');
          px(fx + 6, fy + 10, 3, 1, '#9a3412');
        } else {
          // Focused gaze slightly left
          px(fx + 3, fy + 6, 2, 2, '#0f172a');
          px(fx + 8, fy + 6, 2, 2, '#0f172a');
          px(fx + 6, fy + 10, 3, 1, '#9a3412');
        }

        // Light-blue & dark-slate zip-up jacket with white stand-up collar + orange swirl emblem
        px(fx + 1, fy + 12, 13, 4, '#475569');
        px(fx + 1, fy + 16, 13, 6, '#7dd3fc');
        px(fx + 4, fy + 11, 7, 3, '#f8fafc');
        px(fx + 7, fy + 14, 1, 8, '#e2e8f0');
        // Orange swirl emblem on chest
        px(fx + 4, fy + 17, 3, 3, '#f97316');
        px(fx + 5, fy + 18, 1, 1, '#7c2d12');

        // Signature two-finger salute / thinking hand at temple when idle or thinking
        const fastType = state === 'coding' || state === 'terminal';
        const lUp = reacting ? 4 : (fastType && (tick % 4 < 2) ? 2 : 0);
        const rUp = reacting ? 4 : (fastType && (tick % 4 >= 2) ? 2 : 0);
        if ((state === 'idle' || state === 'thinking') && !reacting) {
          // Raised right arm in light-blue sleeve + fingers at brow/temple
          px(fx - 2, fy + 8, 3, 7, '#7dd3fc');
          px(fx - 1, fy + 5, 4, 3, '#f0c495');
          px(fx + 10, fy + 18, 3, 3, '#f0c495');
        } else {
          px(fx - 1, fy + 18 - lUp, 4, 3, '#f0c495');
          px(fx + 5, fy + 19 - rUp, 4, 3, '#f0c495');
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
        const dx = 50 - (hit ? 2 : 0);
        const dy = 27 + bob + (hit ? 1 : 0);
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

      function drawKyubi(state, reacting) {
        const phase = (18 - reactionTicksLeft) % 8;
        const hit = reacting && (phase === 3 || phase === 4 || phase === 5);
        const bob = reacting
          ? 0
          : state === 'done'
            ? (tick % 8 < 4 ? -2 : 0)
            : state === 'coding'
              ? (tick % 4 < 2 ? -1 : 0)
              : (tick % 24 < 12 ? 0 : 1);
        const kx = 50 - (hit ? 2 : 0);
        const ky = 27 + (hit ? 1 : 0) + bob;
        const blink = state === 'idle' && (tick % 46 > 42);
        const fastType = state === 'coding' || state === 'terminal';
        const leftPawUp = reacting ? 5 : (fastType && (tick % 4 < 2) ? 3 : 0);
        const rightPawUp = reacting ? 5 : (fastType && (tick % 4 >= 2) ? 3 : 0);

        // Swaying nine-tails fan behind Kyubi
        const sway = Math.floor(tick / (reacting ? 2 : 6)) % 2;
        px(kx + 13, ky + 15 - sway, 5, 2, '#c2410c');
        px(kx + 17, ky + 13 - sway, 4, 2, '#ea580c');
        px(kx + 20, ky + 12 - sway, 2, 2, '#fed7aa');

        px(kx + 13, ky + 11 + sway, 6, 2, '#ea580c');
        px(kx + 18, ky + 9 + sway, 4, 2, '#f97316');
        px(kx + 21, ky + 8 + sway, 2, 2, '#fde68a');

        px(kx + 12, ky + 7 - sway, 5, 2, '#f97316');
        px(kx + 16, ky + 4 - sway, 4, 3, '#fb923c');
        px(kx + 19, ky + 3 - sway, 2, 2, '#fed7aa');

        px(kx + 12, ky + 18, 5, 2, '#9a3412');
        px(kx + 16, ky + 17 + sway, 4, 2, '#ea580c');

        // Body & spiky chest fur
        px(kx + 2, ky + 11, 11, 10, '#ea580c');
        px(kx + 4, ky + 12, 7, 8, '#fdba74');
        px(kx + 5, ky + 14, 5, 5, '#fed7aa');

        // Tall pointed fox ears with dark tips
        px(kx + 1, ky - 2, 3, 6, '#ea580c');
        px(kx + 1, ky - 2, 2, 2, '#431407');
        px(kx + 2, ky + 1, 1, 2, '#fdba74');

        px(kx + 11, ky - 2, 3, 6, '#ea580c');
        px(kx + 12, ky - 2, 2, 2, '#431407');
        px(kx + 12, ky + 1, 1, 2, '#fdba74');

        // Head & spiky cheek tufts
        px(kx + 1, ky + 3, 13, 9, '#f97316');
        px(kx, ky + 6, 1, 3, '#ea580c');
        px(kx + 14, ky + 6, 1, 3, '#ea580c');
        px(kx + 3, ky + 8, 9, 4, '#fed7aa');

        // Dark eye markings
        px(kx + 3, ky + 5, 3, 2, '#7c2d12');
        px(kx + 9, ky + 5, 3, 2, '#7c2d12');

        // Eyes
        if (reacting) {
          const eyeC = hit ? '#fde047' : '#ef4444';
          px(kx + 3, ky + 5, 1, 1, eyeC);
          px(kx + 4, ky + 6, 1, 1, eyeC);
          px(kx + 3, ky + 7, 1, 1, eyeC);
          px(kx + 11, ky + 5, 1, 1, eyeC);
          px(kx + 10, ky + 6, 1, 1, eyeC);
          px(kx + 11, ky + 7, 1, 1, eyeC);
          px(kx + 6, ky + 10, 3, 1, '#7c2d12');
        } else if (blink || state === 'done') {
          px(kx + 4, ky + 6, 2, 1, '#dc2626');
          px(kx + 9, ky + 6, 2, 1, '#dc2626');
        } else {
          const look = state === 'reading' ? (Math.floor(tick / 6) % 2 === 0 ? -1 : 0) : 0;
          px(kx + 4 + look, ky + 5, 2, 2, '#dc2626');
          px(kx + 9 + look, ky + 5, 2, 2, '#dc2626');
          px(kx + 4 + look, ky + 5, 1, 2, '#0f172a');
          px(kx + 10 + look, ky + 5, 1, 2, '#0f172a');
        }

        // Nose & fangs
        px(kx + 7, ky + 8, 1, 1, '#1e293b');
        px(kx + 5, ky + 10, 1, 1, '#ffffff');
        px(kx + 9, ky + 10, 1, 1, '#ffffff');

        // Paws
        if (state === 'thinking' && !reacting) {
          px(kx + 1, ky + 11, 3, 3, '#fed7aa');
          px(kx + 10, ky + 17, 3, 3, '#fed7aa');
        } else {
          px(kx - 1, ky + 17 - leftPawUp, 4, 3, '#fed7aa');
          px(kx + 5, ky + 18 - rightPawUp, 4, 3, '#fed7aa');
        }

        // Keyboard
        px(44, 47, 13, 2, '#64748b');
        px(45, 47, 11, 1, '#94a3b8');
      }

      function drawHumanActor(hx, hy, trainer, mood) {
        const sleeveMap = {
          girl: '#f43f5e',
          sensei: '#0f766e',
          naruto: '#f97316',
          jokowi: '#f8fafc',
          prabowo: '#e5d5b5',
          trump: '#1e293b',
          putin: '#0f172a',
          kim: '#1e293b',
          fufufafa: '#7dd3fc'
        };
        const skinMap = {
          jokowi: '#dfa670',
          prabowo: '#f3c99b',
          trump: '#fb923c',
          kim: '#f5cfa0',
          fufufafa: '#f0c495'
        };
        const sleeve = sleeveMap[trainer] || '#334155';
        const skin = skinMap[trainer] || '#fde68a';

        // Head & face (facing left, larger scale)
        px(hx + 2, hy + 6, 10, 8, skin);

        if (trainer === 'girl') {
          // Chestnut hair, bangs, long ponytail & yellow ribbon
          px(hx + 2, hy + 1, 11, 5, '#92400e');
          px(hx + 1, hy + 5, 2, 5, '#92400e');
          px(hx + 11, hy + 4, 3, 11, '#78350f');
          px(hx + 14, hy + 7, 3, 10, '#92400e');
          px(hx + 12, hy + 5, 3, 3, '#fde047');
        } else if (trainer === 'sensei') {
          // Silver swept hair + purple headband + tails
          px(hx + 2, hy, 11, 4, '#e2e8f0');
          px(hx + 5, hy - 1, 4, 1, '#f8fafc');
          px(hx + 11, hy + 2, 4, 5, '#cbd5e1');
          px(hx + 1, hy + 4, 12, 2, '#7c3aed');
          px(hx + 13, hy + 4, 3, 4, '#a855f7');
        } else if (trainer === 'naruto') {
          // Spiky bright yellow hair + Konoha forehead protector headband
          px(hx + 1, hy, 3, 4, '#facc15');
          px(hx + 5, hy - 1, 4, 5, '#fde047');
          px(hx + 10, hy, 4, 4, '#eab308');
          px(hx + 2, hy + 2, 11, 3, '#facc15');
          px(hx + 12, hy + 3, 3, 4, '#eab308');
          px(hx + 1, hy + 4, 12, 2, '#1e293b');
          px(hx + 3, hy + 4, 5, 2, '#cbd5e1');
          px(hx + 13, hy + 4, 3, 2, '#1e293b');
        } else if (trainer === 'jokowi') {
          // Sleek side-parted dark hair & high forehead
          px(hx + 3, hy + 1, 9, 3, '#0f172a');
          px(hx + 5, hy + 1, 3, 1, '#475569');
          px(hx + 11, hy + 4, 2, 6, '#1e293b');
        } else if (trainer === 'prabowo') {
          // Iconic black Peci cap + dark side hair
          px(hx + 2, hy + 1, 10, 5, '#0f172a');
          px(hx + 3, hy + 1, 7, 1, '#1e293b');
          px(hx + 11, hy + 6, 2, 4, '#334155');
        } else if (trainer === 'trump') {
          // Swooped golden-blonde comb-over hair
          px(hx + 1, hy + 1, 11, 4, '#facc15');
          px(hx, hy + 2, 5, 2, '#fde047');
          px(hx + 11, hy + 3, 2, 4, '#eab308');
        } else if (trainer === 'putin') {
          // High receding hairline with thin ash-blonde back/side hair
          px(hx + 5, hy + 2, 7, 2, '#cbd5e1');
          px(hx + 11, hy + 4, 2, 5, '#94a3b8');
        } else if (trainer === 'kim') {
          // Flat-top trapezoid black hair with shaved sides
          px(hx + 2, hy, 10, 5, '#0f172a');
          px(hx + 11, hy + 2, 2, 3, '#1e293b');
        } else if (trainer === 'fufufafa') {
          // Short neat swept black hair
          px(hx + 2, hy + 1, 10, 4, '#0f172a');
          px(hx + 3, hy + 1, 6, 1, '#1e293b');
          px(hx + 11, hy + 4, 2, 5, '#1e293b');
        } else {
          // Boss red cap facing left + dark back hair
          px(hx + 2, hy, 11, 5, '#dc2626');
          px(hx + 4, hy, 6, 1, '#ef4444');
          px(hx - 2, hy + 4, 6, 2, '#991b1b');
          px(hx + 11, hy + 5, 3, 5, '#1e293b');
        }

        // Facial expression (warm smile when petting vs fierce focus when attacking)
        if (trainer === 'sensei') {
          px(hx + 2, hy + 8, 6, 3, '#0f172a');
          px(hx + 3, hy + 9, 3, 1, '#38bdf8');
          px(hx + 2, hy + 11, 4, 1, '#cbd5e1');
          px(hx + 3, hy + 12, 3, 1, mood === 'pet' ? '#b45309' : '#94a3b8');
        } else if (mood === 'pet') {
          px(hx + 4, hy + 9, 2, 1, '#0f172a');
          px(hx + 5, hy + 8, 1, 1, '#0f172a');
          px(hx + 2, hy + 11, 2, 1, '#fda4af');
          px(hx + 4, hy + 12, 3, 1, '#b45309');
        } else if (trainer === 'naruto') {
          px(hx + 3, hy + 8, 4, 1, '#b45309');
          px(hx + 4, hy + 9, 2, 2, '#0284c7');
          px(hx + 4, hy + 9, 1, 1, '#7dd3fc');
          px(hx + 3, hy + 12, 3, 1, '#b45309');
        } else {
          px(hx + 3, hy + 8, 4, 1, trainer === 'trump' ? '#eab308' : '#1e293b');
          px(hx + 4, hy + 9, 2, 2, '#0f172a');
          px(hx + 4, hy + 9, 1, 1, '#ffffff');
          px(hx + 3, hy + 12, 3, 1, trainer === 'jokowi' ? '#ffffff' : '#b45309');
        }

        if (trainer === 'naruto') {
          // Iconic fox whisker marks on cheek
          px(hx + 7, hy + 10, 2, 1, '#d97706');
          px(hx + 7, hy + 12, 2, 1, '#d97706');
        }

        // Torso & outfit (standing behind desk down to y = 49)
        px(hx + 1, hy + 14, 13, 17, sleeve);
        if (trainer === 'girl') {
          px(hx + 2, hy + 14, 4, 7, '#fef3c7');
          px(hx + 6, hy + 15, 7, 3, '#fb7185');
          px(hx + 1, hy + 29, 13, 2, '#1e293b');
        } else if (trainer === 'sensei') {
          px(hx + 2, hy + 14, 4, 9, '#fef3c7');
          px(hx + 1, hy + 27, 13, 3, '#fbbf24');
        } else if (trainer === 'naruto') {
          px(hx + 1, hy + 14, 13, 4, '#1e293b');
          px(hx + 3, hy + 14, 3, 14, '#f8fafc');
          px(hx + 1, hy + 28, 13, 3, '#1e293b');
        } else if (trainer === 'jokowi') {
          px(hx + 2, hy + 14, 4, 2, '#e2e8f0');
          px(hx + 4, hy + 16, 1, 11, '#cbd5e1');
          px(hx + 1, hy + 28, 13, 3, '#0f172a');
        } else if (trainer === 'prabowo') {
          px(hx + 2, hy + 14, 4, 2, '#f5efe2');
          px(hx + 2, hy + 18, 4, 4, '#c7b28a');
          px(hx + 1, hy + 29, 13, 2, '#78350f');
        } else if (trainer === 'trump') {
          px(hx + 2, hy + 14, 4, 8, '#f8fafc');
          px(hx + 3, hy + 16, 2, 11, '#dc2626');
          px(hx + 1, hy + 29, 13, 2, '#0f172a');
        } else if (trainer === 'putin') {
          px(hx + 2, hy + 14, 4, 8, '#f8fafc');
          px(hx + 3, hy + 16, 2, 8, '#991b1b');
          px(hx + 1, hy + 29, 13, 2, '#0f172a');
        } else if (trainer === 'kim') {
          px(hx + 2, hy + 14, 4, 2, '#334155');
          px(hx + 4, hy + 16, 1, 11, '#0f172a');
          px(hx + 1, hy + 29, 13, 2, '#0f172a');
        } else if (trainer === 'fufufafa') {
          // Dark-slate shoulders, light-blue jacket, white stand-up collar & orange swirl
          px(hx + 1, hy + 14, 13, 5, '#475569');
          px(hx + 2, hy + 13, 5, 3, '#f8fafc');
          px(hx + 5, hy + 16, 1, 12, '#e2e8f0');
          px(hx + 2, hy + 20, 3, 3, '#f97316');
          px(hx + 3, hy + 21, 1, 1, '#7c2d12');
          px(hx + 1, hy + 29, 13, 2, '#0f172a');
        } else {
          px(hx + 2, hy + 14, 4, 8, '#f8fafc');
          px(hx + 3, hy + 16, 2, 7, '#ef4444');
          px(hx + 1, hy + 29, 13, 2, '#78350f');
        }
        return sleeve;
      }

      function drawPromptReaction(char, trainer) {
        if (char === 'cat') {
          const hx = 69;
          const hy = 18;
          const sleeve = drawHumanActor(hx, hy, trainer, 'pet');

          // Reaching arm & gentle stroking hand over the cat's head
          const stroke = Math.round(Math.sin(tick * 0.9) * 3);
          const handY = 26 + (tick % 2);
          px(hx - 4, hy + 13, 6, 4, sleeve);
          px(hx - 8, hy + 10, 5, 3, sleeve);
          px(54 + stroke, handY, 8, 3, '#fde68a');
          px(55 + stroke, handY + 3, 6, 1, '#f59e0b');

          const lift = (18 - reactionTicksLeft) % 8;
          for (const [ox, oy, col] of [[44, 24 - lift, '#fb7185'], [65, 22 - ((lift + 4) % 8), '#f43f5e']]) {
            px(ox, oy, 1, 1, col);
            px(ox + 2, oy, 1, 1, col);
            px(ox, oy + 1, 3, 1, col);
            px(ox + 1, oy + 2, 1, 1, col);
          }
        } else {
          // Larger human character standing behind right side of desk
          const phase = (18 - reactionTicksLeft) % 8;
          const hx = 75;
          const hy = 18;
          const sleeve = drawHumanActor(hx, hy, trainer, 'whip');

          if (trainer === 'naruto') {
            // Naruto charges and strikes with a glowing spinning Rasengan (no whip)
            if (phase < 3) {
              px(hx - 2, hy + 15, 5, 4, sleeve);
              px(hx - 5, hy + 16, 3, 3, '#fde68a');
              const rx = hx - 10;
              const ry = hy + 14;
              px(rx, ry + 1, 5, 3, '#0284c7');
              px(rx + 1, ry, 3, 5, '#38bdf8');
              px(rx + 1, ry + 1, 3, 3, '#bae6fd');
              px(rx + 2, ry + 2, 1, 1, '#ffffff');
              if (tick % 2 === 0) {
                px(rx - 1, ry, 1, 1, '#7dd3fc');
                px(rx + 5, ry + 4, 1, 1, '#ffffff');
              } else {
                px(rx + 5, ry, 1, 1, '#7dd3fc');
                px(rx - 1, ry + 4, 1, 1, '#ffffff');
              }
            } else if (phase < 6) {
              px(hx - 8, hy + 14, 10, 4, sleeve);
              px(hx - 11, hy + 14, 3, 3, '#fde68a');
              const rx = hx - 18;
              const ry = hy + 12;
              px(rx, ry + 1, 7, 5, '#0284c7');
              px(rx + 1, ry, 5, 7, '#38bdf8');
              px(rx + 2, ry + 1, 3, 5, '#7dd3fc');
              px(rx + 1, ry + 2, 5, 3, '#e0f2fe');
              px(rx + 2, ry + 2, 3, 3, '#ffffff');
              if (phase === 3 || phase === 4) {
                px(rx - 2, ry - 1, 2, 1, '#ffffff');
                px(rx - 3, ry + 3, 2, 2, '#7dd3fc');
                px(rx - 1, ry + 7, 2, 1, '#38bdf8');
                px(rx + 5, ry - 2, 1, 2, '#bae6fd');
                px(rx + 7, ry + 6, 2, 1, '#7dd3fc');
              }
            } else {
              px(hx - 5, hy + 16, 7, 3, sleeve);
              px(hx - 8, hy + 16, 3, 3, '#fde68a');
              px(56, 31, 2, 2, '#7dd3fc');
              px(60, 28, 1, 1, '#ffffff');
              px(54, 37, 2, 1, '#38bdf8');
            }
          } else {
            // Animated arm & whip (wind-up -> crack -> follow-through)
            if (phase < 3) {
              px(hx + 7, hy + 12, 4, 5, sleeve);
              px(hx + 9, hy + 8, 3, 4, '#fde68a');
              px(hx + 10, hy + 4, 2, 4, '#78350f');
              px(hx + 12, hy + 1, 3, 4, '#d97706');
              px(hx + 15, hy + 3, 2, 4, '#f59e0b');
            } else if (phase < 6) {
              px(hx - 4, hy + 16, 7, 4, sleeve);
              px(hx - 7, hy + 16, 4, 3, '#fde68a');
              px(hx - 10, hy + 15, 3, 2, '#78350f');
              px(hx - 13, hy + 16, 4, 1, '#b45309');
              px(hx - 17, hy + 17, 5, 1, '#d97706');
              px(hx - 21, hy + 18, 5, 1, '#f59e0b');
              if (phase === 3 || phase === 4) {
                px(54, 34, 2, 1, '#fef08a');
                px(52, 36, 3, 2, '#ffffff');
                px(55, 39, 2, 1, '#fb7185');
                px(52, 33, 1, 1, '#fde047');
              }
            } else {
              px(hx - 2, hy + 19, 5, 4, sleeve);
              px(hx - 5, hy + 20, 3, 3, '#fde68a');
              px(hx - 8, hy + 21, 3, 1, '#78350f');
              px(hx - 12, hy + 22, 4, 1, '#b45309');
              px(hx - 16, hy + 24, 4, 1, '#d97706');
            }
          }

          // Startled ! above-left of buddy & sweat drop
          px(45, 19, 2, 5, '#ef4444');
          px(45, 25, 2, 2, '#ef4444');
          px(66, 26 + (phase % 2), 2, 2, '#60a5fa');
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
        } else if (state === 'idle' && currentChar === 'kyubi') {
          // Kyubi gathering fiery red-orange chakra when idle
          const lift = Math.floor(tick / 3) % 8;
          const pulse = Math.floor(tick / 4) % 2;
          px(47, 25 - lift, 2, 2, '#ef4444');
          px(64, 23 - ((lift + 3) % 7), 2, 2, '#f97316');
          px(55 + pulse, 19 - ((lift + 5) % 6), 2, 2, '#fbbf24');
          px(51 - pulse, 21 - ((lift + 2) % 6), 1, 2, '#fef08a');
          px(46, 36 - pulse, 2, 4, 'rgba(239,68,68,0.65)');
          px(66, 35 + pulse, 2, 4, 'rgba(249,115,22,0.65)');
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
        } else if (currentChar === 'kyubi') {
          drawKyubi(state, reacting);
        } else if (currentChar === 'jokowi') {
          drawJokowi(state, reacting);
        } else if (currentChar === 'prabowo') {
          drawPrabowo(state, reacting);
        } else if (currentChar === 'trump') {
          drawTrump(state, reacting);
        } else if (currentChar === 'putin') {
          drawPutin(state, reacting);
        } else if (currentChar === 'kim') {
          drawKim(state, reacting);
        } else if (currentChar === 'fufufafa') {
          drawFufufafa(state, reacting);
        } else {
          drawCat(state, reacting);
        }
        if (reacting) {
          drawPromptReaction(currentChar, currentTrainer);
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

      if (trainerButtons) {
        trainerButtons.addEventListener('click', (event) => {
          const btn = event.target.closest('button[data-trainer]');
          if (!btn) return;
          currentTrainer = btn.dataset.trainer;
          syncUiControls();
          vscode.postMessage({ type: 'setTrainer', trainer: currentTrainer });
        });
      }

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

      if (floatingScaleButtons) {
        floatingScaleButtons.addEventListener('click', (event) => {
          const btn = event.target.closest('button[data-float-scale]');
          if (!btn) return;
          floatingScale = Number(btn.dataset.floatScale);
          syncUiControls();
          vscode.postMessage({ type: 'setFloatingScale', scale: floatingScale });
        });
      }

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
        } else if (msg.type === 'trainerUpdate' && msg.trainer) {
          currentTrainer = msg.trainer;
          syncUiControls();
        } else if (msg.type === 'floatingModeUpdate' && msg.mode) {
          floatingMode = msg.mode;
          syncUiControls();
        } else if (msg.type === 'floatingScaleUpdate' && msg.scale) {
          floatingScale = Number(msg.scale);
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
