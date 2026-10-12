// ==UserScript==
// @name         ChatGPT Conversation Rail
// @namespace    https://github.com/Duro02/chatgpt-ui-scripts
// @version      0.1.2
// @description  Lightweight conversation navigation with short horizontal marks, previews and an optional history index.
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
    .scroller::-webkit-scrollbar { display:none; }
    .marks { position:relative; }
    button { font:inherit; color:inherit; cursor:pointer; }
    .mark { position:absolute; left:0; right:0; height:10px; padding:0; border:0; border-radius:6px; background:transparent; }
    .mark::before { content:''; position:absolute; top:4px; right:0; width:20px; height:2px;
      border-radius:2px; background:var(--rail-muted); opacity:.5; transform:scaleX(.6); transform-origin:right;
      transition:transform 140ms ease,opacity 140ms ease; }
    .mark[data-unloaded]::before { transform:scaleX(.4); opacity:.35; }
    .mark:hover::before { transform:scaleX(.9); opacity:.85; }
    .mark[aria-current]::before { transform:scaleX(1); opacity:1; background:currentColor; }
    .mark:focus-visible { outline:1px solid currentColor; outline-offset:-1px; }
    .mark:focus-visible::before { transform:scaleX(1); opacity:1; }
    .index::before { background:#cf746b; opacity:.95; transform:scaleX(.75); }
    .index[aria-busy]::before { background:#e39a72; }
    .preview { position:fixed; right:50px; top:var(--preview-top,40vh); width:min(300px,calc(100vw - 90px));
      max-height:130px; padding:10px 12px; border-radius:10px; background:var(--rail-bg);
      color:inherit; box-shadow:0 4px 18px #0002; pointer-events:none; overflow:hidden; }
    .prompt,.answer { display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; white-space:pre-wrap; }
    .prompt { font-weight:600; -webkit-line-clamp:2; }
    .answer { margin-top:4px; color:var(--rail-muted); font-size:12px; -webkit-line-clamp:3; }
    .status { position:fixed; right:50px; bottom:100px; max-width:300px; padding:8px 12px;
      border-radius:8px; background:var(--rail-bg); color:inherit; box-shadow:0 4px 18px #0002; }
    [hidden] { display:none !important; }
    @media(max-width:760px) { nav { right:5px; } .preview { right:39px; } }
    @media(prefers-reduced-motion:reduce) { .mark::before { transition:none; } }
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

  function start(doc) {
    if (!doc?.body || doc.getElementById('duro-conversation-rail')) return null;
    const win = doc.defaultView;
    const host = doc.createElement('div');
    host.id = 'duro-conversation-rail';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${CSS}</style><nav aria-label="对话导航" hidden>
      <div class="scroller"><div class="marks"><button class="mark index" type="button" style="top:0" aria-label="点击加载过去的对话" hidden></button></div></div></nav>
      <div class="preview" role="tooltip" id="rail-preview" hidden><div class="prompt"></div><div class="answer"></div></div>
      <div class="status" role="status" hidden></div>`;
    doc.body.appendChild(host);
    const nav = shadow.querySelector('nav');
    const rail = shadow.querySelector('.scroller');
    const marks = shadow.querySelector('.marks');
    const preview = shadow.querySelector('.preview');
    const prompt = shadow.querySelector('.prompt');
    const answer = shadow.querySelector('.answer');
    const status = shadow.querySelector('.status');
    const indexButton = shadow.querySelector('.index');
    const cache = new Map();
    const buttons = new Map();
    const indexes = new Map();
    let content = null, scroller = null, items = [], loaded = [], pending = [], mounted = [], route = threadIdentity(win.location.pathname);
    let chronology = [], transcriptEnd = null, tailKnown = false;
    let staleElements = null, staleUntil = 0, historyComplete = false, activeKey = null, hovered = false, stopped = false;
    let timer = 0, frame = 0, scan = null, jump = null, restoreJob = null, statusTimer = 0;
    let geometry = { origin: 0, height: 0, max: 0, reverse: false };
    let railHeight = 320;
    const stats = { refreshes: 0, geometryReads: 0, scrollFrames: 0, renders: 0 };

    function toast(text, sticky = false) {
      win.clearTimeout(statusTimer);
      status.textContent = text;
      status.hidden = !text;
      if (!sticky && text) statusTimer = win.setTimeout(() => { status.hidden = true; }, 3500);
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
      host.style.setProperty('--rail-center', `${top + band / 2}px`);
      host.style.setProperty('--rail-height', `${railHeight}px`);
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

    function hidePreview() { preview.hidden = true; }

    function render() {
      stats.renders += 1;
      nav.hidden = !items.length || !content?.isConnected;
      indexButton.hidden = historyComplete && !scan;
      const offset = indexButton.hidden ? 0 : 1;
      marks.style.height = `${(items.length + offset) * PITCH}px`;
      const range = railRange(items.length, Math.max(0, rail.scrollTop - offset * PITCH), railHeight);
      const needed = new Set();
      for (let i = range.start; i < range.end; i++) {
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
        button.style.top = `${(i + offset) * PITCH}px`;
        button.setAttribute('aria-label', `跳到第 ${i + 1} 轮：${item.prompt || '尚未加载的提问'}`);
        button.toggleAttribute('data-unloaded', !item.element?.isConnected);
        if (item.key === activeKey) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
      for (const [key, button] of buttons) {
        if (!needed.has(key) && shadow.activeElement !== button) {
          button.remove();
          buttons.delete(key);
        }
      }
    }

    function follow() {
      if (hovered || !items.length) return;
      const i = indexes.get(activeKey) ?? -1;
      if (i < 0) return;
      const offset = indexButton.hidden ? 0 : 1;
      const center = (i + offset) * PITCH + PITCH / 2;
      const height = Math.min(railHeight, (items.length + offset) * PITCH);
      if (center < rail.scrollTop + 20 || center > rail.scrollTop + height - 20) {
        rail.scrollTop = Math.max(0, center - height / 2);
        render();
      }
    }

    function syncActive() {
      frame = 0;
      if (doc.hidden || scan || !scroller || !items.length) return;
      stats.scrollFrames += 1;
      const i = activeAt(items, position() + Math.min(160, geometry.height * .25));
      const key = items[i]?.key;
      if (key === activeKey) return;
      buttons.get(activeKey)?.removeAttribute('aria-current');
      activeKey = key;
      buttons.get(key)?.setAttribute('aria-current', 'true');
      follow();
    }
    function onScroll() {
      if (!frame && !doc.hidden) frame = win.requestAnimationFrame(syncActive);
    }

    function showPreview(button) {
      const item = cache.get(button?.dataset.key);
      if (button === indexButton) {
        prompt.textContent = scan ? '正在加载过去的对话，点击取消' : '点击加载过去的对话';
        answer.textContent = '';
      } else {
        if (!item) return;
        if (item.element?.isConnected) {
          // Refresh only the hovered entry, so editing and streamed responses stay current.
          const user = item.element.querySelector(USER);
          item.prompt = prefix(user, 180) || item.prompt;
          const response = item.element.querySelector(RESPONSE);
          item.answer = prefix(response, 260) || item.answer;
        }
        prompt.textContent = item.prompt || '尚未加载的提问';
        answer.textContent = item.answer || '点击定位这一轮。';
      }
      answer.hidden = !answer.textContent;
      preview.hidden = false;
      const rect = button.getBoundingClientRect();
      host.style.setProperty('--preview-top', `${Math.max(64, Math.min(win.innerHeight - 150, rect.top - 35))}px`);
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
      structure.disconnect();
      const targets = new Set([content]);
      for (const element of [...loaded, ...pending]) {
        let parent = element;
        while (parent && parent !== content) {
          targets.add(parent);
          parent = parent.parentElement;
        }
      }
      // Empty/virtualized lists can have structural containers but no loaded user messages yet.
      for (const target of targets) structure.observe(target, { childList: true });
      if (!loaded.length) structure.observe(content, { childList: true, subtree: true });
      for (const target of pending) structure.observe(target, { childList: true, subtree: true });
      lifecycle.disconnect();
      let parent = content.parentElement;
      while (parent) {
        lifecycle.observe(parent, { childList: true });
        parent = parent.parentElement;
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
      const live = new Set(measured.map(item => item.key));
      if (Math.abs(shift) > 2) for (const item of cache.values()) {
        if (!live.has(item.key)) { item.top += shift; item.bottom += shift; }
      }
      transcriptEnd = end;
      if (measured.some(item => item.bottom >= end - 96)) tailKnown = true;
      for (const item of cache.values()) if (!live.has(item.key)) item.element = null;
      loaded = measured.map(item => item.element);
      for (const item of measured) {
        scan?.pendingKeys.delete(item.key);
        const previous = cache.get(item.key);
        // User previews are read once per mounted element, never on every scroll frame.
        if (!previous || previous.element !== item.element || !previous.prompt) {
          item.prompt = prefix(item.user || item.element, 180);
          item.answer = prefix(item.element.querySelector(RESPONSE), 260);
        }
        const { user, ...record } = item;
        cache.set(item.key, { ...previous, ...record });
      }
      chronology = mergeTimeline(chronology, measured, cache, scan?.anchor, scan?.atStart);
      items = chronology.map(key => cache.get(key));
      if (scan) {
        if (measured.length) scan.anchor = measured.at(-1).key;
        for (const element of pending) {
          const key = `turn:${element.getAttribute('data-turn-key')}`;
          if (!cache.has(key)) scan.pendingKeys.add(key);
        }
      }
      updateHistoryState();
      indexes.clear();
      items.forEach((item, index) => indexes.set(item.key, index));
      watch();
      correctJump();
      if (!scan) syncActive();
      render();
      follow();
    }

    function schedule() {
      if (!timer && !doc.hidden && !stopped) timer = win.setTimeout(refresh, 180);
    }

    function checkRoute() {
      const next = threadIdentity(win.location.pathname);
      if (next === route) return false;
      route = next;
      staleElements = new Set(loaded);
      staleUntil = Date.now() + 1000;
      historyComplete = false;
      chronology = []; transcriptEnd = null; tailKnown = false;
      cancelScan(false);
      jump = null;
      cache.clear();
      indexes.clear();
      items = [];
      activeKey = null;
      hidePreview();
      toast('');
      render();
      schedule();
      return true;
    }

    function preferredRoot() {
      return ROOTS.map(selector => doc.querySelector(selector)).find(node => node && !node.closest('[hidden], [aria-hidden="true"]'));
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
      detach();
      content = next;
      scroller = findScroller(content);
      scroller.addEventListener('scroll', onScroll, { passive: true });
      resize.observe(content);
      resize.observe(scroller);
      watch();
      refresh();
    }

    function detach() {
      cancelScan(false);
      jump = null;
      structure.disconnect();
      lifecycle.disconnect();
      resize.disconnect();
      scroller?.removeEventListener('scroll', onScroll);
      loaded = pending = mounted = [];
      content = scroller = null;
      nav.hidden = true;
    }

    function navigate(key) {
      cancelScan(false);
      hidePreview();
      const item = cache.get(key);
      if (!item || !scroller) return;
      measure();
      jump = { key, attempts: 0, timer: 0, route };
      move(item.top - 24);
      correctJump();
    }

    function correctJump() {
      const job = jump;
      if (!job || job.route !== route) return;
      win.clearTimeout(job.timer);
      const item = cache.get(job.key);
      if (!item) { jump = null; return; }
      if (item.element?.isConnected) {
        const delta = item.element.getBoundingClientRect().top - viewport().top - 24;
        const destination = Math.max(0, Math.min(geometry.max, position() + delta));
        if (Math.abs(destination - position()) > 3) move(destination);
        else { jump = null; return; }
      } else {
        move(item.top - 24);
      }
      if (++job.attempts >= 12) {
        jump = null;
        toast('该节点尚未挂载，位置为近似值；可补全索引后重试。');
      } else job.timer = win.setTimeout(() => {
        if (jump !== job) return;
        measure();
        refresh();
      }, 180);
    }

    const pause = ms => new Promise(resolve => win.setTimeout(resolve, ms));
    function earlierLoading() {
      const leading = content?.firstElementChild;
      if (!leading || !leading.matches('[role="status"]') && !leading.querySelector('[role="status"]')) return false;
      return /loading\s+(earlier|older|previous)|加载.*(更早|历史|之前)|(更早|历史|之前).*加载/i.test(leading.textContent.slice(0, 180));
    }
    function updateHistoryState() {
      if (earlierLoading()) { historyComplete = false; return; }
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
      jump = null;
      measure();
      const first = loaded.find(element => element.getBoundingClientRect().bottom > viewport().top);
      const anchorKey = items.find(item => item.element === first)?.key;
      const job = { route, container: scroller, saved: position(), anchorKey,
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
      if (!scan) return;
      if (event.type === 'keydown' && !['Escape', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      cancelScan(event.type === 'keydown' && event.key === 'Escape');
    }
    function visible() {
      if (doc.hidden) { cancelScan(false); return; }
      bind();
      schedule();
    }

    rail.addEventListener('scroll', () => { render(); hidePreview(); }, { passive: true });
    nav.addEventListener('pointerenter', () => { hovered = true; });
    nav.addEventListener('pointerleave', () => { hovered = false; hidePreview(); });
    marks.addEventListener('pointerover', event => showPreview(event.target.closest('button')));
    marks.addEventListener('focusin', event => showPreview(event.target.closest('button')));
    marks.addEventListener('focusout', hidePreview);
    marks.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button === indexButton) buildIndex();
      else navigate(button?.dataset.key);
    });
    marks.addEventListener('keydown', event => {
      const button = event.target.closest('button');
      const i = items.findIndex(item => item.key === button?.dataset.key);
      let next = i;
      if (event.key === 'ArrowDown') next++;
      else if (event.key === 'ArrowUp') next--;
      else if (event.key === 'Home') next = indexButton.hidden ? 0 : -1;
      else if (event.key === 'End') next = items.length - 1;
      else return;
      event.preventDefault();
      next = Math.max(indexButton.hidden ? 0 : -1, Math.min(items.length - 1, next));
      rail.scrollTop = Math.max(0, (next + (indexButton.hidden ? 0 : 1)) * PITCH - railHeight / 2);
      render();
      (next < 0 ? indexButton : buttons.get(items[next]?.key))?.focus({ preventScroll: true });
    });
    doc.addEventListener('keydown', interrupt, true);
    doc.addEventListener('wheel', interrupt, { passive: true, capture: true });
    doc.addEventListener('touchstart', interrupt, { passive: true, capture: true });
    doc.addEventListener('visibilitychange', visible);
    win.addEventListener('resize', schedule, { passive: true });
    win.addEventListener('popstate', bind);
    const routeSignal = () => win.setTimeout(() => { if (checkRoute()) bind(); }, 0);
    win.navigation?.addEventListener('navigatesuccess', routeSignal);
    theme.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-scheme'] });
    syncTheme();
    bind();

    // Returned controller is used by the local browser fixture; no page globals or diagnostics loop.
    return {
      stats,
      snapshot: () => ({ count: items.length, activeKey, mountedMarks: buttons.size, indexing: Boolean(scan), historyComplete,
        entries: items.map(({ key, top, prompt }) => ({ key, top, prompt })) }),
      stop() {
        stopped = true;
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
        doc.removeEventListener('visibilitychange', visible);
        win.removeEventListener('resize', schedule);
        win.removeEventListener('popstate', bind);
        win.navigation?.removeEventListener('navigatesuccess', routeSignal);
        host.remove();
      },
    };
  }
  return { activeAt, railRange, prefix, threadIdentity, mergeTimeline, start };
});
