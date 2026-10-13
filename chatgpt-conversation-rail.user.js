// ==UserScript==
// @name         ChatGPT Conversation Rail
// @namespace    https://github.com/Duro02/chatgpt-ui-scripts
// @version      0.3.0
// @description  Persistent conversation navigation with short marks, previews and on-demand history loading.
// @author       duro
// @license      MIT
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    api.start(root.document);
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const ROOTS = ['[data-thread-find-target="conversation"]', '[data-thread-user-message-navigation-content]', 'main'];
  const TURN = '[data-turn-key], [data-testid^="conversation-turn-"]';
  const USER = '[data-user-message-bubble], [data-message-author-role="user"]';
  const RESPONSE = '[data-chatgpt-search-unit-key$=":assistant"], [data-message-author-role="assistant"], .markdown, .prose';
  const PITCH = 10;
  const OVERSCAN = 4;
  const CSS = `
    :host { all:initial; color:var(--text-primary,#292722); font:13px/1.5 system-ui,sans-serif;
      --rail-bg:var(--bg-elevated-primary,#f3f0e9); --rail-muted:var(--text-tertiary,#87837b);
      --rail-border:var(--border-light,rgba(128,128,128,.25)); }
    :host([data-dark]) { color:var(--text-primary,#eeeae2); --rail-bg:var(--bg-elevated-primary,#302f2c); }
    * { box-sizing:border-box; }
    nav { position:fixed; right:12px; top:var(--rail-center,45vh); width:28px; z-index:50;
      transform:translateY(-50%); pointer-events:auto; }
    .scroller { max-height:var(--rail-height,320px); overflow-y:auto; overscroll-behavior:contain;
      scrollbar-width:none; contain:layout; }
    nav[data-above] .scroller { mask-image:linear-gradient(transparent,#000 8px); }
    nav[data-below] .scroller { mask-image:linear-gradient(#000 calc(100% - 8px),transparent); }
    nav[data-above][data-below] .scroller { mask-image:linear-gradient(transparent,#000 8px,#000 calc(100% - 8px),transparent); }
    .scroller::-webkit-scrollbar { display:none; }
    .marks { position:relative; }
    button { font:inherit; color:inherit; cursor:pointer; }
    .mark { position:absolute; left:0; right:0; height:10px; padding:0; border:0; border-radius:6px; background:transparent; }
    .mark::before { content:''; position:absolute; top:4px; right:0; width:20px; height:2px;
      border-radius:2px; background:var(--rail-muted); opacity:.5; transform:scaleX(.6); transform-origin:right;
      transition:transform 140ms ease,opacity 140ms ease; }
    .mark[data-unloaded]::before { transform:scaleX(.4); opacity:.35; }
    .mark:hover::before { transform:scaleX(.9); opacity:.85; }
    .mark[aria-current]::before { transform:scaleX(1); opacity:1; background:transparent; }
    .focus-line { position:absolute; right:0; top:4px; width:20px; height:2px; border-radius:2px;
      background:currentColor; z-index:1; pointer-events:none; transition:none; }
    .mark:focus-visible { outline:1px solid currentColor; outline-offset:-1px; }
    .mark:focus-visible::before { transform:scaleX(1); opacity:1; }
    .index::before { background:#cf746b; opacity:.95; transform:scaleX(.75); }
    .index[aria-busy]::before { background:#e39a72; }
    .preview { position:fixed; right:50px; top:var(--preview-top,40vh); width:min(300px,calc(100vw - 90px));
      height:var(--preview-height,118px); z-index:51; color:inherit; pointer-events:auto;
      transition:height 260ms cubic-bezier(.2,.85,.25,1),top 260ms cubic-bezier(.2,.85,.25,1); }
    /* A small hit area bridges the gap from the rail into the bubble. */
    .preview::after { content:''; position:absolute; left:100%; width:14px; top:0; height:100%; }
    .preview-window { position:relative; height:100%; overflow:hidden; border-radius:14px;
      background:var(--rail-bg); border:1px solid var(--rail-border); box-shadow:0 8px 24px #0003; }
    .preview-card { position:absolute; left:50%; width:calc(100% - 32px); height:var(--preview-row-height,40px);
      transform:translateX(-50%); padding:6px 8px 6px 28px; text-align:left; border:0; border-radius:9px;
      background:transparent; color:var(--rail-muted); overflow:hidden;
      transition:top 240ms cubic-bezier(.2,.85,.25,1),height 240ms cubic-bezier(.2,.85,.25,1),
        width 240ms cubic-bezier(.2,.85,.25,1),opacity 180ms ease,background 140ms ease; }
    .preview-card[data-center] { width:calc(100% - 12px); height:var(--preview-center-height,118px);
      padding-top:10px; color:inherit; background:color-mix(in srgb,currentColor 5%,var(--rail-bg)); }
    .preview-card:hover { background:color-mix(in srgb,currentColor 8%,var(--rail-bg)); }
    .preview-card:focus-visible { outline:1px solid currentColor; outline-offset:-2px; }
    .preview:not([data-expanded]) .preview-card:not([data-center]) { opacity:0; pointer-events:none; }
    .preview-number { position:absolute; left:8px; top:9px; font-size:10px; opacity:.55; }
    .prompt,.answer,.preview-label { display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; white-space:pre-wrap; }
    .prompt { font-weight:600; -webkit-line-clamp:2; }
    .preview-label { font-size:12px; line-height:1.35; -webkit-line-clamp:2; }
    .answer { margin-top:4px; color:var(--rail-muted); font-size:12px; -webkit-line-clamp:3; }
    .mark[data-preview]::before { transform:scaleX(.9); opacity:.9; }
    .status { position:fixed; right:50px; bottom:100px; max-width:300px; padding:8px 12px;
      border-radius:8px; background:var(--rail-bg); color:inherit; box-shadow:0 4px 18px #0002; }
    [hidden] { display:none !important; }
    @media(max-width:760px) { nav { right:5px; } .preview { right:39px; } }
    @media(prefers-reduced-motion:reduce) { .mark::before,.focus-line,.preview,.preview-card { transition:none; } }
  `;

  // Binary search over cached content coordinates; no DOM reads in this function.
  function activeAt(items, position) {
    let low = 0, high = items.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (items[mid].top <= position) low = mid + 1;
      else high = mid;
    }
    return items.length ? Math.max(0, low - 1) : -1;
  }

  function railRange(count, scrollTop, height) {
    return {
      start: Math.max(0, Math.floor(scrollTop / PITCH) - OVERSCAN),
      end: Math.min(count, Math.ceil((scrollTop + height) / PITCH) + OVERSCAN),
    };
  }

  // Preserve chronology independently of coordinates that shift during history paging.
  function mergeTimeline(previous, found, cache, scanAnchor, atStart = false) {
    const order = previous.slice();
    const known = new Set(previous);
    let previousFound = null;
    for (let i = 0; i < found.length;) {
      if (known.has(found[i].key)) { previousFound = found[i++].key; continue; }
      const start = i;
      while (i < found.length && !known.has(found[i].key)) i++;
      const next = found[i]?.key;
      let index;
      if (next) index = order.indexOf(next);
      else if (previousFound) index = order.indexOf(previousFound) + 1;
      else if (atStart) index = 0;
      else if (scanAnchor && known.has(scanAnchor)) index = order.indexOf(scanAnchor) + 1;
      else {
        index = order.findIndex(key => cache.get(key)?.top > found[start].top);
        if (index < 0) index = order.length;
      }
      const added = found.slice(start, i).map(item => item.key);
      order.splice(index, 0, ...added);
      added.forEach(key => known.add(key));
      previousFound = added.at(-1);
    }
    return order;
  }

  // A bounded prefix, not textContent/innerText of an entire answer or conversation.
  function prefix(element, limit) {
    if (!element) return '';
    const walker = element.ownerDocument.createTreeWalker(element, 4);
    let text = '', visited = 0, node;
    while (text.length < limit && visited++ < 80 && (node = walker.nextNode())) {
      if (node.parentElement?.closest('button, script, style, .sr-only')) continue;
      text += node.data.slice(0, limit - text.length) + ' ';
    }
    return text.replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  // Project prefixes can change during hydration without changing the conversation.
  function threadIdentity(path) {
    return path.match(/(?:^|\/)c\/([^/]+)/)?.[1] || path;
  }

  const CACHE_PREFIX = 'duro-conversation-rail:v1:';
  const CACHE_SIZE = 1000000;
  const CACHE_TOTAL = 2000000;
  const CACHE_THREADS = 32;
  const CACHE_ITEMS = 10000;
  const cacheKey = thread => `${CACHE_PREFIX}thread:${thread}`;
  const conversationId = path => path.match(/(?:^|\/)c\/([^/]+)/)?.[1] || null;

  function decodeSaved(raw, thread, now = Date.now()) {
    if (!raw || raw.length > CACHE_SIZE) return null;
    try {
      const data = JSON.parse(raw);
      if (data.v !== 1 || data.thread !== thread || !Number.isFinite(data.updated) ||
          data.updated > now + 86400000 ||
          !Array.isArray(data.entries) || data.entries.length > CACHE_ITEMS) return null;
      const keys = new Set(), entries = [];
      for (const row of data.entries) {
        if (!Array.isArray(row) || typeof row[0] !== 'string' || row[0].length > 200 ||
            !/^(turn|message):/.test(row[0]) || keys.has(row[0]) ||
            !Number.isFinite(row[1]) || !Number.isFinite(row[2]) || row[2] < row[1] ||
            Math.abs(row[1]) > 1e9 || Math.abs(row[2]) > 1e9) return null;
        keys.add(row[0]);
        entries.push({ key: row[0], top: row[1], bottom: row[2],
          prompt: typeof row[3] === 'string' ? row[3].slice(0, 180) : '',
          answer: typeof row[4] === 'string' ? row[4].slice(0, 140) : '', element: null });
      }
      return { entries, complete: data.complete === true,
        end: Number.isFinite(data.end) && Math.abs(data.end) <= 1e9 ? data.end : null, tail: data.tail === true };
    } catch { return null; }
  }

  function encodeSaved(thread, items, complete, end, tail, now = Date.now()) {
    const stable = items.filter(item => !/^turn:conversation-turn-/.test(item.key));
    if (!stable.length || stable.length > CACHE_ITEMS) return null;
    const data = { v: 1, thread, updated: now, complete: complete && stable.length === items.length, end, tail,
      entries: stable.map(item => [item.key, Math.round(item.top * 10) / 10,
        Math.round(item.bottom * 10) / 10, (item.prompt || '').slice(0, 180), (item.answer || '').slice(0, 140)]) };
    let raw = JSON.stringify(data);
    if (raw.length > CACHE_SIZE) {
      for (const row of data.entries) { row[4] = ''; row[3] = row[3].slice(0, 60); }
      raw = JSON.stringify(data);
    }
    if (raw.length > CACHE_SIZE) {
      for (const row of data.entries) row[3] = '';
      raw = JSON.stringify(data);
    }
    return raw.length <= CACHE_SIZE ? raw : null;
  }

  function mergeSaved(saved, items, complete, end, tail) {
    if (!saved?.entries.length) return { entries: items, complete, end, tail };
    const previous = new Map(saved.entries.map(item => [item.key, item]));
    const anchor = items.find(item => previous.has(item.key));
    const shift = anchor ? anchor.top - previous.get(anchor.key).top :
      Number.isFinite(end) && saved.end !== null && saved.tail ? end - saved.end : 0;
    const records = new Map(saved.entries.map(item => [item.key,
      { ...item, top: item.top + shift, bottom: item.bottom + shift }]));
    for (const item of items) records.set(item.key, item);
    const order = mergeTimeline(saved.entries.map(item => item.key), items, records);
    const covered = items.filter(item => previous.has(item.key)).length;
    return { entries: order.map(key => records.get(key)),
      complete: complete && order.length === items.length || Boolean(anchor) && saved.complete && covered < saved.entries.length && order[0] === saved.entries[0].key,
      end: end ?? saved.end, tail: tail || saved.tail };
  }

  function createIndexStore(storage, stats) {
    let enabled = Boolean(storage);
    const catalogKey = `${CACHE_PREFIX}catalog`;
    return {
      read(thread, touch = true) {
        if (!enabled || !thread) return null;
        try {
          stats.storageReads++;
          const saved = decodeSaved(storage.getItem(cacheKey(thread)), thread);
          if (saved && touch) {
            // Touch only a small catalog at startup; unchanged conversations do
            // not need a full snapshot rewrite to stay recently used.
            try {
              stats.storageReads++;
              const raw = storage.getItem(catalogKey);
              const rows = raw && raw.length < 20000 ? JSON.parse(raw) : [];
              const row = Array.isArray(rows) && rows.find(item => item?.id === thread);
              if (row) { row.updated = Date.now(); storage.setItem(catalogKey, JSON.stringify([...rows.filter(item => item !== row), row])); stats.storageWrites++; }
            } catch { /* Cache reads remain useful even if catalog writes are unavailable. */ }
          }
          return saved;
        }
        catch { enabled = false; return null; }
      },
      write(thread, raw) {
        if (!enabled || !thread || !raw) return false;
        try {
          let rows;
          try { stats.storageReads++; const value = storage.getItem(catalogKey); rows = value && value.length < 20000 ? JSON.parse(value) : []; }
          catch { rows = []; }
          if (!Array.isArray(rows)) rows = [];
          rows = rows.slice(0, CACHE_THREADS + 1).filter(row => row && typeof row.id === 'string' &&
            row.id.length <= 200 && Number.isFinite(row.size) && row.size >= 0 && Number.isFinite(row.updated));
          const keep = [];
          for (const row of rows) {
            if (row.id === thread) continue;
            keep.push(row);
          }
          keep.sort((a, b) => a.updated - b.updated);
          let size = raw.length + keep.reduce((sum, row) => sum + row.size, 0);
          while (keep.length >= CACHE_THREADS || size > CACHE_TOTAL) {
            const removed = keep.shift();
            if (!removed) break;
            storage.removeItem(cacheKey(removed.id)); size -= removed.size;
          }
          for (;;) {
            try {
              storage.setItem(cacheKey(thread), raw);
              storage.setItem(catalogKey, JSON.stringify([...keep, { id: thread, size: raw.length, updated: Date.now() }]));
              stats.storageWrites++;
              return true;
            } catch (error) {
              const removed = keep.shift();
              if (!removed) throw error;
              storage.removeItem(cacheKey(removed.id));
            }
          }
        } catch { enabled = false; return false; }
      },
    };
  }

  function start(doc, options = {}) {
    if (!doc?.body || doc.getElementById('duro-conversation-rail')) return null;
    const win = doc.defaultView;
    const host = doc.createElement('div');
    host.id = 'duro-conversation-rail';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${CSS}</style><nav aria-label="对话导航" hidden>
      <div class="scroller" tabindex="0" aria-label="对话节点列表，可上下滚动"><div class="marks"><div class="focus-line" aria-hidden="true" hidden></div><button class="mark index" type="button" style="top:0" aria-label="点击加载过去的对话" hidden></button></div></div></nav>
      <div class="preview" role="region" aria-label="对话节点预览" id="rail-preview" hidden><div class="preview-window"></div></div>
      <div class="status" role="status" hidden></div>`;
    doc.body.appendChild(host);
    const nav = shadow.querySelector('nav');
    const rail = shadow.querySelector('.scroller');
    const marks = shadow.querySelector('.marks');
    const preview = shadow.querySelector('.preview');
    const previewWindow = shadow.querySelector('.preview-window');
    const previewCards = new Map();
    let previewKey = null, previewExpanded = false, previewInside = false, navInside = false, previewKeyboard = false;
    let previewCloseTimer = 0, previewEntryFrame = 0, previewAnchor = 100, previewWheel = 0, previewWheelTime = 0;
    const status = shadow.querySelector('.status');
    const indexButton = shadow.querySelector('.index');
    const focusLine = shadow.querySelector('.focus-line');
    const cache = new Map();
    const buttons = new Map();
    const indexes = new Map();
    let content = null, scroller = null, items = [], loaded = [], pending = [], mounted = [], route = threadIdentity(win.location.pathname);
    let selectedKey = null, positioned = [], focusY = null, railMotion = null;
    let chronology = [], transcriptEnd = null, tailKnown = false;
    let staleElements = null, staleUntil = 0, historyComplete = false, activeKey = null, hovered = false, stopped = false;
    let saveTimer = 0, saveIdle = 0, dirty = false, waitingKey = null;
    let savedThread = conversationId(win.location.pathname);
    let timer = 0, frame = 0, scan = null, jump = null, restoreJob = null, statusTimer = 0;
    let geometry = { origin: 0, height: 0, max: 0, reverse: false };
    let railHeight = 320;
    let observedStructure = new Map(), observedParents = [];
    const stats = { refreshes: 0, geometryReads: 0, scrollFrames: 0, renders: 0, railAnimationFrames: 0, storageReads: 0, storageWrites: 0 };
    let persistenceAvailable = true;
    let storage = options.storage;
    if (storage === undefined) { try { storage = win.localStorage; } catch { storage = null; } }
    const store = createIndexStore(storage, stats);

    function toast(text, sticky = false) {
      win.clearTimeout(statusTimer);
      status.textContent = text;
      status.hidden = !text;
      if (!sticky && text) statusTimer = win.setTimeout(() => { status.hidden = true; }, 3500);
    }

    function rebuildIndexes() {
      indexes.clear();
      items.forEach((item, index) => indexes.set(item.key, index));
    }
    function hydrate() {
      const saved = store.read(savedThread);
      if (!saved) return;
      for (const item of saved.entries) cache.set(item.key, item);
      chronology = saved.entries.map(item => item.key);
      items = saved.entries;
      historyComplete = saved.complete;
      transcriptEnd = saved.end;
      tailKnown = saved.tail;
      rebuildIndexes();
    }
    function flushSaved() {
      win.clearTimeout(saveTimer); saveTimer = 0;
      if (saveIdle) { win.cancelIdleCallback?.(saveIdle); saveIdle = 0; }
      if (!dirty || !savedThread || !items.length) return;
      dirty = false;
      // Merge a newer snapshot from another tab so a partial page cannot erase
      // IDs already discovered in a complete index of this same conversation.
      const merged = mergeSaved(store.read(savedThread, false), items, historyComplete, transcriptEnd, tailKnown);
      const raw = encodeSaved(savedThread, merged.entries, merged.complete, merged.end, merged.tail);
      if (raw && storage && !store.write(savedThread, raw)) {
        persistenceAvailable = false;
        toast('本地索引未能保存，本页导航仍可使用。');
      }
    }
    function markDirty() {
      if (!storage || !persistenceAvailable || !savedThread || stopped) return;
      dirty = true;
      win.clearTimeout(saveTimer);
      if (saveIdle) { win.cancelIdleCallback?.(saveIdle); saveIdle = 0; }
      saveTimer = win.setTimeout(() => {
        saveTimer = 0;
        if (win.requestIdleCallback) saveIdle = win.requestIdleCallback(() => { saveIdle = 0; flushSaved(); }, { timeout: 2000 });
        else flushSaved();
      }, 1500);
    }

    function position() { return geometry.origin + (scroller?.scrollTop || 0); }
    function viewport() {
      return scroller === doc.scrollingElement
        ? { top: 0, bottom: win.innerHeight, height: win.innerHeight }
        : scroller.getBoundingClientRect();
    }
    function move(top, behavior = 'auto') {
      if (!scroller) return;
      scroller.scrollTo({ top: Math.max(0, Math.min(geometry.max, top)) - geometry.origin, behavior });
    }

    function measure() {
      if (!content || !scroller) return;
      // ChatGPT's current scrollport uses flex-direction:column-reverse (negative scrollTop).
      geometry.reverse = win.getComputedStyle(scroller).flexDirection === 'column-reverse';
      geometry.max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      geometry.origin = geometry.reverse ? geometry.max : 0;
      const rect = viewport();
      geometry.height = rect.height;
      const footer = scroller.querySelector('[data-thread-scroll-footer]');
      const bottom = Math.min(rect.bottom, footer?.getBoundingClientRect().top || rect.bottom - 100);
      const top = Math.max(64, rect.top);
      const band = Math.max(100, bottom - top);
      railHeight = Math.max(60, Math.min(420, band - 64));
      setStyle(host, '--rail-center', `${top + band / 2}px`);
      setStyle(host, '--rail-height', `${railHeight}px`);
      stats.geometryReads += 1;
    }

    function findScroller(node) {
      let parent = node;
      while (parent && parent !== doc.body) {
        if (/(auto|scroll)/.test(win.getComputedStyle(parent).overflowY)) return parent;
        parent = parent.parentElement;
      }
      return doc.scrollingElement;
    }

    function hidePreview() {
      win.clearTimeout(previewCloseTimer); previewCloseTimer = 0;
      win.cancelAnimationFrame(previewEntryFrame); previewEntryFrame = 0;
      if (preview.hidden && !previewCards.size) return;
      preview.hidden = true;
      setAttribute(preview, 'data-expanded', null);
      previewExpanded = previewInside = previewKeyboard = false;
      hovered = navInside;
      if (previewKey) setAttribute(buttons.get(previewKey) || preview, 'data-preview', null);
      previewKey = null; previewWheel = 0;
      previewCards.clear(); previewWindow.replaceChildren();
    }
    function delayHidePreview() {
      win.clearTimeout(previewCloseTimer);
      previewCloseTimer = win.setTimeout(() => {
        previewCloseTimer = 0;
        if (!previewInside && !navInside && !preview.contains(shadow.activeElement) &&
            !(previewKeyboard && shadow.activeElement?.classList.contains('mark'))) hidePreview();
      }, 220);
    }

    // Native attribute setters may invalidate styles even when the value matches.
    // Keep unchanged animation windows and resize refreshes free of DOM writes.
    function setAttribute(element, name, value) {
      if (element.getAttribute(name) === value) return;
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    function setText(element, text) {
      if (element.textContent !== text) element.textContent = text;
    }
    function setStyle(element, name, value) {
      if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    }
    function render(extraIndex) {
      stats.renders += 1;
      setAttribute(nav, 'hidden', items.length ? null : '');
      setAttribute(indexButton, 'hidden', historyComplete && !scan ? '' : null);
      const offset = indexButton.hidden ? 0 : 1;
      setStyle(marks, 'height', `${(items.length + offset) * PITCH}px`);
      const range = railRange(items.length, Math.max(0, rail.scrollTop - offset * PITCH), railHeight);
      const height = Math.min(railHeight, (items.length + offset) * PITCH);
      setAttribute(nav, 'data-above', rail.scrollTop > 2 ? '' : null);
      setAttribute(nav, 'data-below', rail.scrollTop + height < (items.length + offset) * PITCH - 2 ? '' : null);
      const needed = new Set();
      const visibleIndexes = Array.from({ length: Math.max(0, range.end - range.start) }, (_, i) => range.start + i);
      if (Number.isInteger(extraIndex) && extraIndex >= 0 && extraIndex < items.length && !visibleIndexes.includes(extraIndex)) visibleIndexes.push(extraIndex);
      for (const i of visibleIndexes) {
        const item = items[i];
        needed.add(item.key);
        let button = buttons.get(item.key);
        if (!button) {
          button = doc.createElement('button');
          button.className = 'mark';
          button.type = 'button';
          button.dataset.key = item.key;
          buttons.set(item.key, button);
          marks.appendChild(button);
        }
        setStyle(button, 'top', `${(i + offset) * PITCH}px`);
        setAttribute(button, 'aria-label', `跳到第 ${i + 1} 轮：${item.prompt || '尚未加载的提问'}`);
        setAttribute(button, 'data-unloaded', item.element?.isConnected ? null : '');
        setAttribute(button, 'aria-current', item.key === activeKey ? 'true' : null);
        setAttribute(button, 'data-preview', item.key === previewKey ? '' : null);
      }
      updateIndicator();
      for (const [key, button] of buttons) {
        if (!needed.has(key) && shadow.activeElement !== button) {
          button.remove();
          buttons.delete(key);
        }
      }
    }

    function indicatorTarget() {
      const index = indexes.get(activeKey);
      return index === undefined ? null : (index + (indexButton.hidden ? 0 : 1)) * PITCH;
    }
    function paintFocus(y) {
      focusY = y;
      setStyle(focusLine, 'transform', `translateY(${y}px)`);
    }
    function updateIndicator() {
      const target = indicatorTarget();
      setAttribute(focusLine, 'hidden', target === null || !items.length ? '' : null);
      if (!focusLine.hidden && !railMotion) paintFocus(target);
    }
    function stopRailMotion() {
      if (railMotion) win.cancelAnimationFrame(railMotion.frame);
      railMotion = null;
    }
    function animateRail(destination, target) {
      const total = (items.length + (indexButton.hidden ? 0 : 1)) * PITCH;
      destination = Math.max(0, Math.min(Math.max(0, total - railHeight), destination));
      if (railMotion?.toScroll === destination && railMotion.toY === target) return;
      stopRailMotion();
      const fromScroll = rail.scrollTop;
      let fromY = focusY ?? target;
      // If the old active turn is outside a manually browsed rail viewport,
      // let its focus enter from the nearest edge rather than from thousands of pixels away.
      if (target !== null && target >= destination && target < destination + railHeight) {
        fromY = Math.max(fromScroll, Math.min(fromScroll + railHeight - PITCH, fromY));
      }
      if (target === null || doc.hidden || win.matchMedia('(prefers-reduced-motion:reduce)').matches ||
          Math.abs(fromScroll - destination) < .5 && Math.abs(fromY - target) < .5) {
        rail.scrollTop = destination;
        if (target !== null) paintFocus(target);
        render();
        return;
      }
      const job = { fromY, toY: target, fromScroll, toScroll: destination, previousTime: null, elapsed: 0, frame: 0 };
      railMotion = job;
      focusLine.hidden = false;
      const tick = time => {
        if (railMotion !== job || stopped) return;
        // Virtual mounts can stall the main thread. Cap a frame's contribution
        // so a missed frame does not turn the whole focus transition into a snap.
        if (job.previousTime !== null) job.elapsed += Math.min(64, time - job.previousTime);
        job.previousTime = time;
        const progress = Math.min(1, job.elapsed / 260);
        const eased = progress * progress * (3 - 2 * progress);
        paintFocus(job.fromY + (job.toY - job.fromY) * eased);
        stats.railAnimationFrames += 1;
        if (job.fromScroll !== job.toScroll) {
          rail.scrollTop = job.fromScroll + (job.toScroll - job.fromScroll) * eased;
          render();
        }
        if (progress < 1 && !doc.hidden) job.frame = win.requestAnimationFrame(tick);
        else {
          railMotion = null;
          rail.scrollTop = job.toScroll;
          paintFocus(job.toY);
          render();
        }
      };
      job.frame = win.requestAnimationFrame(tick);
    }

    function follow(animate = false, force = false) {
      if (!items.length) { updateIndicator(); return; }
      const target = indicatorTarget();
      if (target === null) { updateIndicator(); return; }
      const height = Math.min(railHeight, (items.length + (indexButton.hidden ? 0 : 1)) * PITCH);
      let destination = railMotion?.toScroll ?? rail.scrollTop;
      const exploring = shadow.activeElement?.dataset.key && shadow.activeElement.dataset.key !== activeKey;
      if (force || !hovered && !exploring) {
        const center = target + PITCH / 2;
        const inset = Math.min(20, height / 4);
        if (center < destination + inset || center > destination + height - inset) {
          destination = Math.max(0, center - height / 2);
        }
      }
      if (animate || railMotion) animateRail(destination, target);
      else {
        rail.scrollTop = destination;
        paintFocus(target);
      }
    }

    function setActive(key) {
      if (key === activeKey) return;
      buttons.get(activeKey)?.removeAttribute('aria-current');
      activeKey = key;
      buttons.get(key)?.setAttribute('aria-current', 'true');
      follow(true, Boolean(selectedKey));
    }

    function syncActive() {
      frame = 0;
      if (doc.hidden || scan || !scroller || !items.length) return;
      stats.scrollFrames += 1;
      // An explicit navigation selection wins over viewport inference, including
      // a final turn that cannot align to the top because the scrollport has ended.
      if (selectedKey && cache.has(selectedKey)) { setActive(selectedKey); return; }
      const current = positioned.length ? positioned : items;
      const i = activeAt(current, position() + Math.min(160, geometry.height * .25));
      setActive(current[i]?.key);
    }
    function onScroll() {
      if (!frame && !doc.hidden) frame = win.requestAnimationFrame(syncActive);
    }

    function readPreview(item) {
      if (!item?.element?.isConnected) return;
      // Only the central entry is reread; neighbors use bounded cached summaries.
      const oldPrompt = item.prompt, oldAnswer = item.answer;
      item.prompt = prefix(item.element.querySelector(USER), 180) || item.prompt;
      item.answer = prefix(item.element.querySelector(RESPONSE), 260) || item.answer;
      if (item.prompt !== oldPrompt || (item.answer || '').slice(0, 140) !== (oldAnswer || '').slice(0, 140)) markDirty();
    }
    function previewCard(key) {
      let card = previewCards.get(key);
      if (card) return card;
      const button = doc.createElement('button');
      button.type = 'button'; button.className = 'preview-card'; button.dataset.key = key;
      const number = doc.createElement('span'); number.className = 'preview-number';
      const label = doc.createElement('span');
      const response = doc.createElement('span'); response.hidden = true;
      button.append(number, label, response); previewWindow.appendChild(button);
      card = { button, number, label, response, top: 0, entering: false };
      previewCards.set(key, card);
      return card;
    }
    function renderPreview(direction = 0) {
      const index = indexes.get(previewKey);
      if (index === undefined || preview.hidden) return;
      const available = Math.max(140, win.innerHeight - 80);
      const centerHeight = Math.round(Math.min(118, Math.max(74, available * .36)) * 100) / 100;
      const rowHeight = Math.round(Math.min(40, Math.max(11, (available - centerHeight) / 6)) * 100) / 100;
      const before = Math.min(3, index), after = Math.min(3, items.length - index - 1);
      const centerTop = previewExpanded ? before * rowHeight : 0;
      const height = centerHeight + (previewExpanded ? (before + after) * rowHeight : 0);
      setStyle(preview, '--preview-center-height', `${centerHeight}px`);
      setStyle(preview, '--preview-row-height', `${rowHeight}px`);
      setStyle(preview, '--preview-height', `${height}px`);
      setStyle(host, '--preview-top', `${Math.max(64, Math.min(win.innerHeight - height - 16, previewAnchor - centerTop))}px`);
      const needed = new Set();
      for (let slot = -before; slot <= after; slot++) {
        const item = items[index + slot]; needed.add(item.key);
        const isNew = !previewCards.has(item.key), card = previewCard(item.key), central = slot === 0;
        setAttribute(card.button, 'data-center', central ? '' : null);
        setAttribute(card.button, 'aria-label', `跳到第 ${index + slot + 1} 轮：${item.prompt || '尚未加载的提问'}`);
        setAttribute(card.button, 'tabindex', central || previewExpanded ? '0' : '-1');
        setAttribute(card.button, 'aria-hidden', central || previewExpanded ? null : 'true');
        setText(card.number, String(index + slot + 1));
        setAttribute(card.label, 'class', central ? 'prompt' : 'preview-label');
        setText(card.label, item.prompt || '尚未加载的提问');
        setAttribute(card.response, 'class', central ? 'answer' : 'preview-response');
        setAttribute(card.response, 'hidden', central ? null : '');
        if (central) {
          setText(card.response, item.answer || '点击定位这一轮。');
        } else setText(card.response, '');
        card.top = Math.round((slot < 0 ? centerTop + slot * rowHeight : slot > 0 ? centerTop + centerHeight + (slot - 1) * rowHeight : centerTop) * 100) / 100;
        if (isNew && previewExpanded && direction && !win.matchMedia('(prefers-reduced-motion:reduce)').matches) {
          card.entering = true;
          card.button.style.top = `${card.top + direction * rowHeight}px`;
          card.button.style.opacity = '0';
        } else if (!card.entering) setStyle(card.button, 'top', `${card.top}px`);
      }
      for (const [key, card] of previewCards) if (!needed.has(key)) { card.button.remove(); previewCards.delete(key); }
      // One bounded entry frame; card movement itself uses CSS transitions.
      if (!previewEntryFrame && [...previewCards.values()].some(card => card.entering)) {
        previewEntryFrame = win.requestAnimationFrame(() => {
          previewEntryFrame = 0;
          for (const card of previewCards.values()) if (card.entering) {
            card.entering = false; card.button.style.opacity = '';
            setStyle(card.button, 'top', `${card.top}px`);
          }
        });
      }
    }
    function expandPreview() {
      if (preview.hidden) return;
      win.clearTimeout(previewCloseTimer); previewCloseTimer = 0;
      previewInside = hovered = true;
      if (!previewKey || previewExpanded) return;
      previewExpanded = true;
      setAttribute(preview, 'data-expanded', '');
      renderPreview();
    }
    function shiftPreview(delta) {
      const index = indexes.get(previewKey);
      if (index === undefined) return;
      const next = Math.max(0, Math.min(items.length - 1, index + delta));
      if (next === index) return;
      setAttribute(buttons.get(previewKey) || preview, 'data-preview', null);
      previewKey = items[next].key;
      readPreview(items[next]); renderPreview(Math.sign(delta));
      stopRailMotion();
      // Browse the rail along with the panel, without moving the transcript.
      const top = (next + (indexButton.hidden ? 0 : 1)) * PITCH;
      if (top < rail.scrollTop || top + PITCH > rail.scrollTop + railHeight) rail.scrollTop = Math.max(0, top - railHeight / 2);
      render();
    }
    function showPreview(button, keyboard = false) {
      if (!button) return;
      const item = cache.get(button.dataset.key);
      if (button !== indexButton && !item) return;
      win.clearTimeout(previewCloseTimer); previewCloseTimer = 0;
      previewKeyboard = keyboard;
      if (previewKey !== item?.key) {
        setAttribute(buttons.get(previewKey) || preview, 'data-preview', null);
        previewWheel = 0;
      }
      previewKey = item?.key || null;
      previewExpanded = false;
      setAttribute(preview, 'data-expanded', null);
      const rect = button.getBoundingClientRect();
      previewAnchor = Math.max(64, Math.min(win.innerHeight - 134, rect.top - 35));
      preview.hidden = false;
      if (button === indexButton) {
        previewCards.clear(); previewWindow.replaceChildren();
        const card = previewCard('history');
        card.button.removeAttribute('data-key'); card.button.dataset.history = '';
        card.button.setAttribute('data-center', ''); card.button.style.top = '0px';
        card.label.className = 'prompt'; card.response.className = 'answer';
        card.label.textContent = scan ? '正在加载过去的对话，点击取消' : '点击加载过去的对话';
        card.number.textContent = ''; card.response.textContent = ''; card.response.hidden = true;
        setStyle(preview, '--preview-height', '118px');
        setStyle(host, '--preview-top', `${previewAnchor}px`);
      } else {
        readPreview(item); renderPreview();
        setAttribute(button, 'data-preview', '');
      }
    }

    // Observe direct structural containers only. Token text and answer descendants are not watched.
    const structure = new win.MutationObserver(() => {
      if (checkRoute()) return;
      schedule();
    });
    const lifecycle = new win.MutationObserver(() => {
      if (checkRoute()) return;
      bind();
    });
    const resize = new win.ResizeObserver(() => schedule());
    const boot = new win.MutationObserver(() => bind());
    const theme = new win.MutationObserver(() => syncTheme());

    function syncTheme() {
      const html = doc.documentElement;
      host.toggleAttribute('data-dark', html.classList.contains('dark') ||
        html.dataset.theme === 'dark' || html.dataset.colorScheme === 'dark');
    }

    function watch() {
      const targets = new Map([[content, !loaded.length]]);
      for (const element of [...loaded, ...pending]) {
        let parent = element;
        while (parent && parent !== content) {
          if (!targets.has(parent)) targets.set(parent, false);
          parent = parent.parentElement;
        }
      }
      // Resize/stream updates usually keep the same observer topology.
      // Reconnect only when mounted wrappers, ancestors or subtree modes change.
      for (const target of pending) targets.set(target, true);
      if (targets.size !== observedStructure.size || [...targets].some(([target, subtree]) => observedStructure.get(target) !== subtree)) {
        structure.disconnect();
        for (const [target, subtree] of targets) structure.observe(target, { childList: true, subtree });
        observedStructure = targets;
      }
      const parents = [];
      for (let parent = content.parentElement; parent; parent = parent.parentElement) parents.push(parent);
      if (parents.length !== observedParents.length || parents.some((parent, i) => parent !== observedParents[i])) {
        lifecycle.disconnect();
        for (const parent of parents) lifecycle.observe(parent, { childList: true });
        observedParents = parents;
      }
    }

    function discover() {
      const candidates = [...content.querySelectorAll(TURN)];
      mounted = candidates;
      pending = [];
      const next = [];
      const keys = new Set();
      for (const element of candidates) {
        if (element.closest('[hidden], [aria-hidden="true"]')) continue;
        if (element.parentElement?.closest(TURN)) continue;
        const user = element.querySelector(USER);
        const oldUser = element.getAttribute('data-turn') === 'user';
        if (!user && !oldUser) {
          if (element.hasAttribute('data-turn-key')) pending.push(element);
          continue;
        }
        const id = element.getAttribute('data-turn-key') || element.getAttribute('data-testid');
        const key = `turn:${id}`;
        if (keys.has(key)) continue;
        keys.add(key);
        next.push({ key, element, user });
      }
      // Legacy pages without wrappers still expose message roles.
      if (!candidates.length) {
        for (const user of content.querySelectorAll(USER)) {
          if (user.parentElement?.closest(USER)) continue;
          const id = user.getAttribute('data-message-id');
          if (id) next.push({ key: `message:${id}`, element: user, user });
        }
      }
      if (!candidates.length) mounted = next.map(item => item.element);
      return next;
    }

    function refresh() {
      // Explicit loads/calibration may refresh before an observer's timer fires.
      win.clearTimeout(timer);
      timer = 0;
      if (stopped || doc.hidden || !content?.isConnected) return;
      if (checkRoute()) return;
      if (preferredRoot() !== content) { bind(); return; }
      const found = discover();
      // Only suppress the exact old DOM briefly during a real thread switch.
      // A remounted turn with the same message ID is valid new content.
      if (staleElements && Date.now() < staleUntil && found.length && found.every(item => staleElements.has(item.element))) {
        schedule();
        return;
      }
      if (found.length) staleElements = null;
      stats.refreshes += 1;
      const previousComplete = historyComplete;
      const previousHead = chronology[0];
      let changed = false, added = false;
      measure();
      const scrollRect = viewport();
      // Read geometry together, before rendering or updating any navigation DOM.
      const measured = found.map(item => {
        const rect = item.element.getBoundingClientRect();
        return { ...item, top: rect.top - scrollRect.top + position(), bottom: rect.bottom - scrollRect.top + position() };
      });
      const rootRect = content.getBoundingClientRect();
      const end = rootRect.bottom - scrollRect.top + position();
      const overlapping = measured.find(item => cache.has(item.key));
      // Older server pages prepend to a transcript whose latest end was known.
      // An overlapping anchor gives a better translation once it mounts again.
      const shift = overlapping ? overlapping.top - cache.get(overlapping.key).top
        : tailKnown && transcriptEnd !== null ? end - transcriptEnd : 0;
      const previousPositioned = positioned;
      positioned = measured;
      const live = new Set(measured.map(item => item.key));
      if (Math.abs(shift) > 2) for (const item of cache.values()) {
        if (!live.has(item.key)) { item.top += shift; item.bottom += shift; }
      }
      transcriptEnd = end;
      if (measured.some(item => item.bottom >= end - 96)) tailKnown = true;
      // Only the preceding mounted window can have newly unmounted elements.
      for (const item of previousPositioned) if (!live.has(item.key)) {
        const record = cache.get(item.key);
        if (record) record.element = null;
      }
      loaded = measured.map(item => item.element);
      for (const item of measured) {
        scan?.pendingKeys.delete(item.key);
        const previous = cache.get(item.key);
        // User previews are read once per mounted element, never on every scroll frame.
        if (!previous || previous.element !== item.element || !previous.prompt) {
          item.prompt = prefix(item.user || item.element, 180);
          item.answer = prefix(item.element.querySelector(RESPONSE), 260);
        }
        if (!previous || item.prompt !== undefined && (item.prompt !== previous.prompt || (item.answer || '').slice(0, 140) !== (previous.answer || '').slice(0, 140))) changed = true;
        const { user, ...record } = item;
        if (previous) Object.assign(previous, record);
        else { cache.set(item.key, record); added = true; }
      }
      // Existing records retain their identity, so layout changes do not need
      // an O(total cached turns) order copy, array rebuild or key-index rebuild.
      if (added) {
        chronology = mergeTimeline(chronology, measured, cache, scan?.anchor, scan?.atStart);
        items = chronology.map(key => cache.get(key));
        rebuildIndexes();
      }
      if (previousHead && chronology[0] !== previousHead) historyComplete = false;
      if (scan) {
        if (measured.length) scan.anchor = measured.at(-1).key;
        for (const element of pending) {
          const key = `turn:${element.getAttribute('data-turn-key')}`;
          if (!cache.has(key)) scan.pendingKeys.add(key);
        }
      }
      updateHistoryState();
      if (changed || historyComplete !== previousComplete) markDirty();
      watch();
      correctJump();
      if (!scan) syncActive();
      render();
      follow();
      if (previewExpanded) renderPreview();
    }

    function schedule() {
      if (!timer && !doc.hidden && !stopped) timer = win.setTimeout(refresh, 180);
    }

    function checkRoute() {
      const next = threadIdentity(win.location.pathname);
      if (next === route) return false;
      flushSaved();
      route = next;
      savedThread = conversationId(win.location.pathname);
      waitingKey = null;
      stopRailMotion();
      staleElements = new Set(loaded);
      staleUntil = Date.now() + 1000;
      historyComplete = false;
      chronology = []; transcriptEnd = null; tailKnown = false;
      cancelScan(false);
      cancelJump(false);
      cache.clear();
      indexes.clear();
      items = [];
      activeKey = selectedKey = null; positioned = [];
      hidePreview();
      toast('');
      hydrate();
      render();
      schedule();
      return true;
    }

    function preferredRoot() {
      for (const selector of ROOTS) {
        const node = doc.querySelector(selector);
        if (node && !node.closest('[hidden], [aria-hidden="true"]')) return node;
      }
      return null;
    }

    function bind() {
      if (stopped) return;
      checkRoute();
      const next = preferredRoot();
      if (!next) {
        detach();
        boot.observe(doc.body, { childList: true, subtree: true });
        return;
      }
      boot.disconnect();
      if (next === content && content.isConnected) return;
      const resumeKey = jump?.key || waitingKey;
      detach();
      waitingKey = resumeKey;
      content = next;
      scroller = findScroller(content);
      scroller.addEventListener('scroll', onScroll, { passive: true });
      resize.observe(content);
      resize.observe(scroller);
      watch();
      refresh();
      if (waitingKey) { const key = waitingKey; waitingKey = null; navigate(key); }
    }

    function detach() {
      stopRailMotion();
      cancelScan(false);
      cancelJump(false);
      structure.disconnect();
      lifecycle.disconnect();
      observedStructure.clear(); observedParents = [];
      resize.disconnect();
      scroller?.removeEventListener('scroll', onScroll);
      for (const item of positioned) {
        const record = cache.get(item.key);
        if (record) record.element = null;
      }
      loaded = pending = mounted = positioned = [];
      content = scroller = null;
      render();
    }

    function navigate(key) {
      cancelScan(false);
      cancelJump(false);
      hidePreview();
      const item = cache.get(key);
      if (!item) return;
      restoreJob = null;
      const originalSelection = selectedKey;
      selectedKey = key;
      setActive(key);
      if (!scroller) { waitingKey = key; toast('正在等待对话页面加载…', true); return; }
      measure();
      const first = loaded.find(element => element.getBoundingClientRect().bottom > viewport().top);
      const anchorKey = items.find(record => record.element === first)?.key;
      const job = { key, attempts: 0, timer: 0, route, container: scroller,
        stage: item.element?.isConnected ? 'calibrate' : 'load', saved: position(), anchorKey, originalSelection,
        offset: first ? first.getBoundingClientRect().top - viewport().top : 0 };
      jump = job;
      if (job.stage === 'load') loadTarget(job);
      else { move(item.top - 24); correctJump(); }
    }

    function cancelJump(restorePosition) {
      const job = jump;
      waitingKey = null;
      if (!job) return;
      win.clearTimeout(job.timer);
      jump = null;
      if (job.stage === 'load') {
        if (restorePosition) { selectedKey = null; restore(job); }
        toast('已停止加载目标节点。');
      } else toast('');
    }

    function correctJump() {
      const job = jump;
      if (!job || job.stage !== 'calibrate' || job.route !== route) return;
      win.clearTimeout(job.timer);
      const item = cache.get(job.key);
      if (!item) { jump = null; return; }
      if (item.element?.isConnected) {
        const delta = item.element.getBoundingClientRect().top - viewport().top - 24;
        const destination = Math.max(0, Math.min(geometry.max, position() + delta));
        if (Math.abs(destination - position()) > 3) move(destination);
        else { jump = null; toast(''); return; }
      } else move(item.top - 24);
      if (++job.attempts >= 12) {
        jump = null;
        toast('目标位置仍在调整，可稍后重试。');
      } else job.timer = win.setTimeout(() => {
        if (jump !== job) return;
        refresh();
      }, 180);
    }

    async function loadTarget(job) {
      const started = Date.now();
      let steps = 0, covered = 0, topStable = 0, previousEnd = null, estimated = false;
      toast('正在加载目标节点… · Esc 或再次点击可取消', true);
      try {
        while (jump === job && job.route === route && job.container === scroller &&
               scroller?.isConnected && !doc.hidden && steps++ < 600 && Date.now() - started < (options.loadTimeout || 120000)) {
          refresh();
          const item = cache.get(job.key);
          if (item?.element?.isConnected) {
            job.stage = 'calibrate'; correctJump(); return;
          }
          const targetIndex = indexes.get(job.key);
          if (targetIndex === undefined) break;
          const first = positioned[0], last = positioned.at(-1);
          const firstIndex = indexes.get(first?.key), lastIndex = indexes.get(last?.key);
          const pendingTarget = mounted.some(element => `turn:${element.getAttribute('data-turn-key') || element.getAttribute('data-testid')}` === job.key);
          const older = item.top < 0 || firstIndex !== undefined && targetIndex < firstIndex && position() <= 2;
          if (older && !pendingTarget) {
            toast(`正在加载更早的历史以定位第 ${targetIndex + 1} 轮… · Esc 可取消`, true);
            move(0);
            await pause(300);
            if (jump !== job) return;
            refresh();
            const end = transcriptEnd;
            topStable = !earlierLoading() && end === previousEnd ? topStable + 1 : 0;
            previousEnd = end;
            if (topStable >= 8) break;
            estimated = false;
            continue;
          }
          topStable = 0;
          if (pendingTarget) { covered = 0; await pause(180); continue; }
          const step = Math.max(120, geometry.height * .65);
          let destination;
          if (!estimated) { destination = Math.max(0, item.top - 24); estimated = true; }
          else if (firstIndex !== undefined && targetIndex < firstIndex) destination = Math.max(0, position() - step);
          else if (lastIndex !== undefined && targetIndex > lastIndex) destination = Math.min(geometry.max, position() + step);
          else {
            // Neighbouring mounted IDs bracket the target: allow hydration to settle,
            // then report a missing/changed branch instead of loading the entire transcript.
            if (++covered >= 12) break;
            destination = Math.max(0, item.top - 24);
          }
          move(destination);
          await pause(240);
        }
        if (jump === job) {
          jump = null; selectedKey = null;
          restore(job);
          toast('暂未找到该节点，可能仍在加载或当前分支已变化；缓存节点已保留，可重试。');
        }
      } catch {
        if (jump === job) { jump = null; selectedKey = null; restore(job); toast('目标加载中断，可稍后重试。'); }
      }
    }

    const pause = ms => new Promise(resolve => win.setTimeout(resolve, ms));
    function earlierLoading() {
      const leading = content?.firstElementChild;
      if (!leading || !leading.matches('[role="status"]') && !leading.querySelector('[role="status"]')) return false;
      return /loading\s+(earlier|older|previous)|加载.*(更早|历史|之前)|(更早|历史|之前).*加载/i.test(leading.textContent.slice(0, 180));
    }
    function updateHistoryState() {
      // Loading already cached pages does not mean the index is incomplete.
      // A sentinel above the oldest known mounted ID does signal unknown history.
      if (earlierLoading()) {
        if (positioned.some(item => item.key === chronology[0])) historyComplete = false;
        return;
      }
      if (!items.length || historyComplete) return;
      // Cached intervals survive virtual unmounts. An uninterrupted range from
      // transcript start to end means there are no undiscovered history nodes.
      if (pending.some(element => !cache.has(`turn:${element.getAttribute('data-turn-key')}`))) return;
      if (!content.querySelector('[data-turn-key]')) { historyComplete = true; return; }
      const rect = content.getBoundingClientRect();
      const origin = rect.top - viewport().top + position();
      let end = origin;
      for (const item of items) {
        if (item.top > end + 96) return;
        end = Math.max(end, item.bottom);
      }
      if (end >= origin + rect.height - 96) historyComplete = true;
    }

    async function buildIndex() {
      if (scan) { cancelScan(true); return; }
      if (!scroller || doc.hidden) return;
      const originalSelection = selectedKey;
      releaseSelection();
      measure();
      const first = loaded.find(element => element.getBoundingClientRect().bottom > viewport().top);
      const anchorKey = items.find(item => item.element === first)?.key;
      const job = { route, container: scroller, saved: position(), anchorKey, originalSelection,
        offset: first ? first.getBoundingClientRect().top - viewport().top : 0,
        cancelled: false, started: Date.now(), pendingKeys: new Set(), atStart: true, anchor: null };
      scan = job;
      indexButton.setAttribute('aria-busy', 'true');
      indexButton.setAttribute('aria-label', '正在加载过去的对话，点击取消');
      render();
      hidePreview();
      let y = 0, steps = 0, bottomPasses = 0, historyTimedOut = false;
      try {
        while (scan === job && !job.cancelled && job.route === threadIdentity(win.location.pathname) && job.container.isConnected && !doc.hidden) {
          job.atStart = y === 0;
          measure();
          move(y);
          await pause(240);
          if (scan !== job) break;
          refresh();
          if (y === 0) {
            // Current ChatGPT also pages older history from the server. Keep the top
            // sentinel visible until paging settles; never report that a partial page is complete.
            const deadline = Date.now() + 30000;
            let stable = 0, previousMax = geometry.max;
            while (scan === job && stable < 4 && Date.now() < deadline) {
              const loading = earlierLoading();
              stable = !loading && Math.abs(geometry.max - previousMax) < 2 ? stable + 1 : 0;
              previousMax = geometry.max;
              if (loading) toast(`正在加载更早的历史：已发现 ${items.length} 轮 · 可取消`, true);
              move(0);
              await pause(300);
              if (scan !== job) break;
              refresh();
            }
            if (scan !== job) break;
            if (earlierLoading()) { historyTimedOut = true; break; }
          }
          // Scroll events and virtual DOM commits can lag behind scrollTop. Wait for
          // actual message content at this viewport before advancing (only while indexing).
          for (let retry = 0; retry < (y >= geometry.max - 2 ? 20 : 12); retry++) {
            const view = viewport();
            const ready = mounted.some(element => {
              if (!element.isConnected || !element.querySelector(`${USER}, ${RESPONSE}`)) return false;
              const rect = element.getBoundingClientRect();
              return rect.height > 0 && rect.bottom > view.top && rect.top < view.bottom;
            });
            const missingTail = y >= geometry.max - 2 && pending.some(element => !cache.has(`turn:${element.getAttribute("data-turn-key")}`));
            if (ready && !missingTail || scan !== job) break;
            await pause(150);
            if (scan !== job) break;
            refresh();
          }
          // Lazy heights may shift after mounting. Do not advance past a viewport we missed.
          for (let retry = 0; retry < 3 && Math.abs(position() - Math.min(y, geometry.max)) > geometry.height * .2; retry++) {
            move(y);
            await pause(240);
            if (scan !== job) break;
            refresh();
          }
          if (scan !== job) break;
          toast(`正在补全导航：${items.length} 轮 · 再次点击或 Esc 取消`, true);
          if (++steps >= 600 || Date.now() - job.started > 120000) break;
          if (y >= geometry.max - 2) {
            if (++bottomPasses >= 2) break;
            y = geometry.max;
          } else {
            bottomPasses = 0;
            y = Math.min(geometry.max, y + Math.max(200, geometry.height * .7));
          }
        }
      } finally {
        if (scan === job) {
          scan = null;
          if (bottomPasses >= 2) {
            historyComplete = !earlierLoading() && !job.pendingKeys.size;
            markDirty();
            // Unmounting and delayed hydration are not proof that a turn was deleted.
            // Retain discovered entries; a real conversation switch clears the cache.
            refresh();
          }
          restore(job);
          toast(`已索引 ${items.length} 轮${historyTimedOut || job.pendingKeys.size ? '（部分历史仍在加载，请稍后再次补全）' : steps >= 600 || Date.now() - job.started > 120000 ? '（达到扫描上限，可继续补全）' : ''}`);
        }
      }
    }

    function restore(job) {
      indexButton.removeAttribute('aria-busy');
      indexButton.setAttribute('aria-label', '点击加载过去的对话');
      render();
      if (job.route !== threadIdentity(win.location.pathname) || job.container !== scroller || !scroller?.isConnected) return;
      selectedKey = cache.has(job.originalSelection) ? job.originalSelection : null;
      measure();
      move((cache.get(job.anchorKey)?.top ?? job.saved + job.offset) - job.offset);
      // Keep the original viewport, including when its virtualized anchor remounts.
      restoreJob = job;
      win.setTimeout(() => {
        if (restoreJob !== job || job.route !== route || job.container !== scroller) return;
        restoreJob = null;
        refresh();
        const anchor = cache.get(job.anchorKey)?.element;
        if (anchor?.isConnected) {
          const delta = anchor.getBoundingClientRect().top - viewport().top - job.offset;
          move(position() + delta);
        }
        onScroll();
        follow(true, true);
      }, 280);
    }

    function cancelScan(restorePosition) {
      if (!scan) return;
      const job = scan;
      job.cancelled = true;
      scan = null;
      indexButton.removeAttribute('aria-busy');
      indexButton.setAttribute('aria-label', '点击加载过去的对话');
      render();
      if (restorePosition) restore(job);
      toast('索引已停止，已发现的节点仍可使用。');
    }

    function interrupt(event) {
      if (event.composedPath().includes(host) && event.key !== "Escape") return;
      if (event.type === 'keydown' && !['Escape', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const restorePosition = event.type === 'keydown' && event.key === 'Escape';
      hidePreview();
      cancelJump(restorePosition);
      if (!restorePosition) releaseSelection();
      cancelScan(restorePosition);
    }
    function releaseSelection() {
      stopRailMotion();
      restoreJob = null;
      selectedKey = null;
      cancelJump(false);
    }
    function pointerIntent(event) {
      if (!event.composedPath().includes(host)) { hidePreview(); releaseSelection(); }
    }
    function visible() {
      if (doc.hidden) { hidePreview(); flushSaved(); releaseSelection(); cancelScan(false); return; }
      bind();
      schedule();
    }

    rail.addEventListener('wheel', stopRailMotion, { passive: true });
    rail.addEventListener('touchstart', stopRailMotion, { passive: true });
    rail.addEventListener('scroll', () => { if (!railMotion) render(); if (!previewExpanded && !previewKeyboard) hidePreview(); }, { passive: true });
    nav.addEventListener('pointerenter', () => { navInside = hovered = true; win.clearTimeout(previewCloseTimer); });
    nav.addEventListener('pointerleave', () => { navInside = false; hovered = previewInside; delayHidePreview(); });
    preview.addEventListener('pointerenter', expandPreview);
    preview.addEventListener('pointerleave', () => { previewInside = false; hovered = navInside; delayHidePreview(); });
    preview.addEventListener('focusin', expandPreview);
    preview.addEventListener('focusout', delayHidePreview);
    preview.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button?.hasAttribute('data-history')) buildIndex();
      else if (button?.dataset.key) navigate(button.dataset.key);
    });
    preview.addEventListener('wheel', event => {
      event.preventDefault();
      if (!previewKey || !event.deltaY) return;
      expandPreview();
      if (event.timeStamp - previewWheelTime > 160) previewWheel = 0;
      previewWheelTime = event.timeStamp;
      previewWheel += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 80 : 1);
      if (Math.abs(previewWheel) < 36) return;
      const step = Math.sign(previewWheel); previewWheel = 0;
      shiftPreview(step);
    }, { passive: false });
    preview.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); expandPreview(); shiftPreview(event.key === 'ArrowDown' ? 1 : -1);
        previewCards.get(previewKey)?.button.focus({ preventScroll: true });
      }
    });
    marks.addEventListener('pointerover', event => showPreview(event.target.closest('button')));
    marks.addEventListener('focusin', event => showPreview(event.target.closest('button'), true));
    marks.addEventListener('focusout', delayHidePreview);
    marks.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button === indexButton) buildIndex();
      else if (jump?.stage === 'load' && jump.key === button?.dataset.key) cancelJump(true);
      else navigate(button?.dataset.key);
    });
    marks.addEventListener('keydown', event => {
      const button = event.target.closest('button');
      const i = indexes.get(button?.dataset.key) ?? -1;
      let next = i;
      if (event.key === 'ArrowDown') next++;
      else if (event.key === 'ArrowUp') next--;
      else if (event.key === 'Home') next = indexButton.hidden ? 0 : -1;
      else if (event.key === 'End') next = items.length - 1;
      else if (event.key === 'PageDown') next += Math.max(1, Math.floor(railHeight / PITCH) - 2);
      else if (event.key === 'PageUp') next -= Math.max(1, Math.floor(railHeight / PITCH) - 2);
      else return;
      event.preventDefault();
      next = Math.max(indexButton.hidden ? 0 : -1, Math.min(items.length - 1, next));
      animateRail(Math.max(0, (next + (indexButton.hidden ? 0 : 1)) * PITCH - railHeight / 2), indicatorTarget());
      render(next);
      (next < 0 ? indexButton : buttons.get(items[next]?.key))?.focus({ preventScroll: true });
    });
    doc.addEventListener('keydown', interrupt, true);
    doc.addEventListener('wheel', interrupt, { passive: true, capture: true });
    doc.addEventListener('touchstart', interrupt, { passive: true, capture: true });
    doc.addEventListener('pointerdown', pointerIntent, true);
    doc.addEventListener('visibilitychange', visible);
    win.addEventListener('resize', schedule, { passive: true });
    win.addEventListener('popstate', bind);
    win.addEventListener('pagehide', flushSaved);
    const routeSignal = () => win.setTimeout(() => { if (checkRoute()) bind(); }, 0);
    win.navigation?.addEventListener('navigatesuccess', routeSignal);
    theme.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-scheme'] });
    syncTheme();
    hydrate();
    render();
    bind();

    // Returned controller is used by the local browser fixture; no page globals or diagnostics loop.
    return {
      stats,
      flush: flushSaved,
      snapshot: () => ({ count: items.length, activeKey, selectedKey, mountedMarks: buttons.size, indexing: Boolean(scan), loadingTarget: jump?.stage === "load", animating: Boolean(railMotion), historyComplete,
        entries: items.map(({ key, top, prompt }) => ({ key, top, prompt })) }),
      stop() {
        flushSaved();
        stopped = true;
        hidePreview();
        detach();
        boot.disconnect();
        theme.disconnect();
        win.clearTimeout(timer);
        win.clearTimeout(statusTimer);
        win.cancelAnimationFrame(frame);
        restoreJob = null;
        doc.removeEventListener('keydown', interrupt, true);
        doc.removeEventListener('wheel', interrupt, true);
        doc.removeEventListener('touchstart', interrupt, true);
        doc.removeEventListener('pointerdown', pointerIntent, true);
        doc.removeEventListener('visibilitychange', visible);
        win.removeEventListener('resize', schedule);
        win.removeEventListener('popstate', bind);
        win.removeEventListener('pagehide', flushSaved);
        win.navigation?.removeEventListener('navigatesuccess', routeSignal);
        host.remove();
      },
    };
  }
  return { activeAt, railRange, prefix, threadIdentity, mergeTimeline, decodeSaved, encodeSaved, createIndexStore, cacheKey, mergeSaved, start };
});
