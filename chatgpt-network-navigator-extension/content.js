(function () {
  'use strict';

  const ROOT_ID = 'cgpt-net-nav-root';
  const PANEL_ID = 'cgpt-net-nav-panel';
  const STORE_KEY = 'cgptNetworkNavigatorConversations';
  const state = {
    conversations: {},
    activeConversationId: null,
    turns: [],
    activeIndex: -1,
    jumping: false,
    jumpToken: 0
  };

  injectPageHook();
  injectStyles();
  loadStore().then(() => {
    renderShell();
    refreshFromCurrentDom();
    setInterval(refreshFromCurrentDom, 1200);
  });

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'cgpt-network-navigator') return;
    if (data.type === 'conversation-response') {
      ingestConversationPayload(data.url, data.payload);
    }
  });

  function injectPageHook() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('page-hook.js');
    script.onload = () => script.remove();
    (document.documentElement || document.head).appendChild(script);
  }

  async function loadStore() {
    try {
      if (!isExtensionContextValid()) return;
      const result = await chrome.storage.local.get(STORE_KEY);
      state.conversations = result[STORE_KEY] || {};
    } catch (err) {
      console.warn('[CGPT Network Navigator] storage read skipped:', err);
    }
  }

  function saveStore() {
    try {
      if (!isExtensionContextValid()) return;
      chrome.storage.local.set({ [STORE_KEY]: state.conversations });
    } catch (err) {
      console.warn('[CGPT Network Navigator] storage write skipped:', err);
    }
  }

  function isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
    } catch (_) {
      return false;
    }
  }

  function getConversationIdFromUrl(url) {
    try {
      const u = new URL(url, location.origin);
      const match = u.pathname.match(/\/c\/([^/]+)/);
      return match ? match[1] : null;
    } catch (_) {
      return null;
    }
  }

  function getCurrentConversationId() {
    return getConversationIdFromUrl(location.href);
  }

  function extractTextFromContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content.parts)) {
      return content.parts.map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') return part.text || part.name || part.title || '';
        return '';
      }).filter(Boolean).join('\n');
    }
    if (Array.isArray(content)) return content.map(extractTextFromContent).filter(Boolean).join('\n');
    if (typeof content === 'object') return content.text || content.title || '';
    return '';
  }

  function isRealUserTurn(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return false;
    if (/^original custom instructions no longer available$/i.test(t)) return false;
    if (/^custom instructions no longer available$/i.test(t)) return false;
    return true;
  }

  function normalizeConversationPayload(payload) {
    const mapping = payload && (payload.mapping || payload.conversation?.mapping);
    if (!mapping || typeof mapping !== 'object') return [];
    const nodes = Object.values(mapping)
      .map(item => item && (item.message || item))
      .filter(Boolean);

    return nodes
      .map(message => {
        const role = message.author?.role || message.role;
        if (role !== 'user') return null;
        const id = message.id || message.message_id;
        const text = extractTextFromContent(message.content).replace(/\s+/g, ' ').trim();
        if (!id || !isRealUserTurn(text)) return null;
        const createTime = message.create_time || message.update_time || 0;
        return { id, role, text, createTime };
      })
      .filter(Boolean)
      .sort((a, b) => (a.createTime || 0) - (b.createTime || 0));
  }

  function ingestConversationPayload(url, payload) {
    const conversationId = getConversationIdFromUrl(url) || getCurrentConversationId();
    if (!conversationId) return;
    const turns = normalizeConversationPayload(payload);
    if (!turns.length) return;
    state.conversations[conversationId] = {
      id: conversationId,
      turns,
      updatedAt: Date.now()
    };
    if (conversationId === getCurrentConversationId()) {
      state.turns = turns;
      renderTimeline();
    }
    saveStore();
  }

  function refreshFromCurrentDom() {
    const id = getCurrentConversationId();
    if (!id) {
      state.activeConversationId = null;
      state.turns = [];
      renderTimeline();
      return;
    }
    if (state.activeConversationId !== id) {
      state.activeConversationId = id;
      state.turns = state.conversations[id]?.turns || [];
      renderTimeline();
    }
    syncActiveFromViewport();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #${ROOT_ID} {
        position: fixed; right: 18px; top: 50%; transform: translateY(-50%);
        width: 36px; max-height: 78vh; overflow-y: auto; z-index: 2147482500;
        display: none; flex-direction: column; align-items: center; gap: 14px;
        padding: 14px 0; border-radius: 18px;
        background: rgba(255,255,255,.88); border: 1px solid rgba(0,0,0,.12);
        box-shadow: 0 8px 24px rgba(0,0,0,.12); backdrop-filter: blur(10px);
      }
      html.dark #${ROOT_ID} { background: rgba(32,33,35,.88); border-color: rgba(255,255,255,.12); }
      #${ROOT_ID}::-webkit-scrollbar { display: none; }
      .cgpt-net-dot {
        width: 14px; height: 14px; min-width: 14px; min-height: 14px; flex: 0 0 14px;
        border-radius: 999px; background: #aeb6c2; cursor: pointer;
      }
      .cgpt-net-dot.active { box-shadow: 0 0 0 3px #508cf3; }
      #${PANEL_ID} {
        position: fixed; right: 64px; top: 50%; transform: translateY(-50%);
        width: 300px; max-height: 72vh; overflow: auto; z-index: 2147482499;
        display: none; padding: 8px; border-radius: 10px;
        background: rgba(255,255,255,.92); border: 1px solid rgba(0,0,0,.12);
        box-shadow: 0 8px 24px rgba(0,0,0,.14); color: #111;
      }
      html.dark #${PANEL_ID} { background: rgba(32,33,35,.94); border-color: rgba(255,255,255,.12); color: #eee; }
      .cgpt-net-item { padding: 8px; border-radius: 8px; font-size: 12px; line-height: 1.45; cursor: pointer; }
      .cgpt-net-item:hover, .cgpt-net-item.active { background: rgba(80,140,243,.14); }
    `;
    document.documentElement.appendChild(style);
  }

  function renderShell() {
    if (!document.getElementById(ROOT_ID)) {
      const root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    if (!document.getElementById(PANEL_ID)) {
      const panel = document.createElement('div');
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
    }
    document.getElementById(ROOT_ID).addEventListener('dblclick', () => {
      const panel = document.getElementById(PANEL_ID);
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });
  }

  function renderTimeline() {
    const root = document.getElementById(ROOT_ID);
    const panel = document.getElementById(PANEL_ID);
    if (!root || !panel) return;
    root.innerHTML = '';
    panel.innerHTML = '';
    if (!state.turns.length) {
      root.style.display = 'none';
      panel.style.display = 'none';
      return;
    }
    root.style.display = 'flex';
    state.turns.forEach((turn, index) => {
      const dot = document.createElement('div');
      dot.className = 'cgpt-net-dot';
      dot.title = turn.text.slice(0, 160);
      dot.dataset.index = String(index);
      dot.addEventListener('click', () => jumpToTurn(index));
      root.appendChild(dot);

      const item = document.createElement('div');
      item.className = 'cgpt-net-item';
      item.dataset.index = String(index);
      item.textContent = `${index + 1}. ${turn.text.slice(0, 140)}`;
      item.addEventListener('click', () => jumpToTurn(index));
      panel.appendChild(item);
    });
    syncActiveFromViewport();
  }

  function findRenderedUserMessage(turn) {
    const byId = document.querySelector(`[data-message-id="${cssEscape(turn.id)}"]`);
    if (byId) return byId;
    const candidates = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
    const needle = normalizeForMatch(turn.text).slice(0, 90);
    return candidates.find(el => normalizeForMatch(el.textContent || '').includes(needle));
  }

  function getRenderedUserTurns() {
    const nodes = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
    const rendered = [];
    const seen = new Set();
    nodes.forEach(node => {
      const msgId = node.getAttribute('data-message-id');
      let index = msgId ? state.turns.findIndex(turn => turn.id === msgId) : -1;
      if (index < 0) {
        const nodeText = normalizeForMatch(node.textContent || '');
        index = state.turns.findIndex(turn => {
          const needle = normalizeForMatch(turn.text).slice(0, 90);
          return needle && nodeText.includes(needle);
        });
      }
      if (index < 0 || seen.has(index)) return;
      seen.add(index);
      rendered.push({ index, node });
    });
    return rendered.sort((a, b) => a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top);
  }

  function getScroller() {
    return Array.from(document.querySelectorAll('div,main,section')).find(el => {
      const cs = getComputedStyle(el);
      const cls = String(el.className || '');
      return (cs.overflowY === 'auto' || cs.overflowY === 'scroll')
        && el.scrollHeight > el.clientHeight + 100
        && (cls.includes('group/scroll-root') || cls.includes('not-print:overflow-y-auto'));
    });
  }

  function scrollNodeIntoChatView(node, behavior) {
    const scroller = getScroller();
    if (!scroller) {
      node.scrollIntoView({ behavior, block: 'start' });
      return;
    }
    const nRect = node.getBoundingClientRect();
    const sRect = scroller.getBoundingClientRect();
    const top = scroller.scrollTop + (nRect.top - sRect.top) - 18;
    scroller.scrollTo({ top: Math.max(0, top), behavior });
  }

  function estimateScrollTopForIndex(scroller, index, bounds) {
    const rendered = getRenderedUserTurns();
    const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (!rendered.length) {
      const ratio = state.turns.length > 1 ? index / (state.turns.length - 1) : 0;
      return Math.round(maxTop * ratio);
    }

    const before = [...rendered].reverse().find(x => x.index < index);
    const after = rendered.find(x => x.index > index);
    if (before && after) {
      const bTop = before.node.getBoundingClientRect().top + scroller.scrollTop;
      const aTop = after.node.getBoundingClientRect().top + scroller.scrollTop;
      const span = after.index - before.index;
      return Math.round(bTop + ((index - before.index) / span) * (aTop - bTop));
    }
    if (bounds && Number.isFinite(bounds.low) && Number.isFinite(bounds.high) && bounds.high > bounds.low + 8) {
      return Math.round((bounds.low + bounds.high) / 2);
    }
    if (before) {
      return Math.min(maxTop, Math.round(scroller.scrollTop + scroller.clientHeight * 1.8));
    }
    if (after) {
      return Math.max(0, Math.round(scroller.scrollTop - scroller.clientHeight * 1.8));
    }
    const ratio = state.turns.length > 1 ? index / (state.turns.length - 1) : 0;
    return Math.round(maxTop * ratio);
  }

  function updateBoundsForRenderedIndex(index, scroller, bounds) {
    const rendered = getRenderedUserTurns();
    if (!rendered.length) return bounds;
    const minIndex = Math.min(...rendered.map(x => x.index));
    const maxIndex = Math.max(...rendered.map(x => x.index));
    const currentTop = scroller.scrollTop;
    const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (index < minIndex) {
      bounds.high = Math.min(bounds.high, currentTop);
    } else if (index > maxIndex) {
      bounds.low = Math.max(bounds.low, currentTop);
    } else {
      bounds.low = Math.max(0, currentTop - scroller.clientHeight);
      bounds.high = Math.min(maxTop, currentTop + scroller.clientHeight);
    }
    return bounds;
  }

  function jumpToTurn(index, attempt = 0, bounds = null, token = null) {
    const turn = state.turns[index];
    if (!turn) return;
    if (attempt === 0) {
      state.jumpToken += 1;
      token = state.jumpToken;
    } else if (token !== state.jumpToken) {
      return;
    }
    state.jumping = true;
    const node = findRenderedUserMessage(turn);
    if (node) {
      scrollNodeIntoChatView(node, attempt ? 'auto' : 'smooth');
      setActive(index);
      state.jumping = false;
      return;
    }
    const scroller = getScroller();
    if (!scroller) {
      state.jumping = false;
      return;
    }
    const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const nextBounds = updateBoundsForRenderedIndex(index, scroller, bounds || { low: 0, high: maxTop });
    const top = estimateScrollTopForIndex(scroller, index, nextBounds);
    scroller.scrollTo({ top: Math.max(0, Math.min(maxTop, top)), behavior: attempt ? 'auto' : 'smooth' });
    setActive(index);
    if (attempt < 14) {
      setTimeout(() => jumpToTurn(index, attempt + 1, nextBounds, token), attempt ? 260 : 520);
    } else {
      state.jumping = false;
    }
  }

  function syncActiveFromViewport() {
    if (state.jumping) return;
    if (!state.turns.length) return;
    const pivot = window.innerHeight * 0.38;
    let best = -1;
    state.turns.forEach((turn, i) => {
      const node = findRenderedUserMessage(turn);
      if (!node) return;
      if (node.getBoundingClientRect().top <= pivot) best = i;
    });
    if (best >= 0) setActive(best);
  }

  function setActive(index) {
    state.activeIndex = index;
    document.querySelectorAll('.cgpt-net-dot').forEach(el => el.classList.toggle('active', el.dataset.index === String(index)));
    document.querySelectorAll('.cgpt-net-item').forEach(el => el.classList.toggle('active', el.dataset.index === String(index)));
  }

  function cssEscape(value) {
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function normalizeForMatch(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
})();
