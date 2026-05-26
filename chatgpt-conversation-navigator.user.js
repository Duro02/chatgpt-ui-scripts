// ==UserScript==
// @name         ChatGPT体验增强插件
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  时间线/预览/跳转/长按标记/搜索/公式复制/导出Markdown。增强稳定性、性能与兼容性。
// @author       YukonKong (original), duro (modifications)
// @match        https://chatgpt.com/*
// @license      CC-BY-NC-4.0
// @grant        GM_addStyle
// @require      https://unpkg.com/turndown/lib/turndown.browser.umd.js
// @require      https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js
// @run-at       document-idle
// @noframes
// ==/UserScript==
//
// Original script by YukonKong:
// https://update.greasyfork.org/scripts/570234/ChatGPT%E4%BD%93%E9%AA%8C%E5%A2%9E%E5%BC%BA%E6%8F%92%E4%BB%B6.user.js
// This modified version keeps the original CC-BY-NC-4.0 license and attribution.

(function() {
    'use strict';

    // ==========================================
    // 1. 注入 CSS 样式
    // ==========================================
    GM_addStyle(`
        :root {
            --tl-capsule-bg: #f7f9fa;
            --tl-capsule-border: #e5e8eb;
            --tl-capsule-shadow: rgba(0, 0, 0, 0.05);
            --tl-dot-color: #c5cbd5;
            --tl-dot-active-ring: #508cf3;
            --tl-tooltip-bg: rgba(28, 28, 30, 0.95);
            --tl-tooltip-text: #ffffff;
            --tl-tooltip-shadow: rgba(0, 0, 0, 0.15);
            --tl-panel-bg: rgba(255, 255, 255, 0.85);
            --tl-panel-text: #1c1c1e;
            --tl-input-bg: rgba(0, 0, 0, 0.05);
            --tl-item-hover: rgba(0, 0, 0, 0.04);
            --tl-icon-color: #565869;
        }

        html.dark {
            --tl-capsule-bg: rgba(45, 45, 45, 0.85);
            --tl-capsule-border: rgba(255, 255, 255, 0.08);
            --tl-capsule-shadow: rgba(0, 0, 0, 0.3);
            --tl-dot-color: #565869;
            --tl-dot-active-ring: #508cf3;
            --tl-tooltip-bg: rgba(236, 236, 236, 0.95);
            --tl-tooltip-text: #1c1c1e;
            --tl-tooltip-shadow: rgba(0, 0, 0, 0.3);
            --tl-panel-bg: rgba(32, 33, 35, 0.85);
            --tl-panel-text: #ececec;
            --tl-input-bg: rgba(255, 255, 255, 0.1);
            --tl-item-hover: rgba(255, 255, 255, 0.08);
            --tl-icon-color: #c5cbd5;
        }

        #chatgpt-dot-timeline {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            width: 36px;
            background: var(--tl-capsule-bg);
            border: 1px solid var(--tl-capsule-border);
            border-radius: 20px;
            padding: 18px 0;
            display: none; /* 默认隐藏，由渲染逻辑开启 */
            flex-direction: column;
            align-items: center;
            gap: 20px;
            z-index: 99998;
            box-shadow: 0 4px 12px var(--tl-capsule-shadow);
            max-height: 80vh;
            overflow-y: auto;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        #chatgpt-dot-timeline::-webkit-scrollbar { display: none; }

        #chatgpt-timeline-indicator {
            position: absolute;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            box-shadow: 0 0 0 3px var(--tl-dot-active-ring);
            pointer-events: none;
            z-index: 10;
            top: 0;
            left: 10px;
            opacity: 0;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, opacity 0.3s ease;
        }

        .timeline-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background-color: var(--tl-dot-color);
            cursor: pointer;
            position: relative;
            flex-shrink: 0;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            -webkit-user-select: none;
            user-select: none;
        }
        .timeline-dot.highlighted { background-color: #FFC107 !important; }
        .timeline-dot.highlighted:hover { box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.5); }

        #chatgpt-timeline-tooltip {
            position: fixed;
            background: var(--tl-tooltip-bg);
            color: var(--tl-tooltip-text);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.6;
            width: max-content;
            max-width: 300px;
            word-break: break-word;
            white-space: pre-wrap;
            pointer-events: none;
            z-index: 99999;
            opacity: 0;
            transform: translateY(-50%) translateX(8px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            box-shadow: 0 4px 16px var(--tl-tooltip-shadow);
            backdrop-filter: blur(8px);
        }
        #chatgpt-timeline-tooltip.visible { opacity: 1; transform: translateY(-50%) translateX(0); }
        #chatgpt-timeline-tooltip::after {
            content: '';
            position: absolute;
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
            border-width: 6px 0 6px 6px;
            border-style: solid;
            border-color: transparent transparent transparent var(--tl-tooltip-bg);
        }

        /* 工具栏配置 */
        #chatgpt-timeline-tools {
            position: fixed;
            top: 50%;
            right: 66px;
            transform: translateY(-50%);
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 99998;
        }

        .tool-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--tl-capsule-bg);
            border: 1px solid var(--tl-capsule-border);
            box-shadow: 0 4px 12px var(--tl-capsule-shadow);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--tl-icon-color);
            transition: all 0.3s;
            backdrop-filter: blur(10px);
        }
        .tool-btn:hover { color: var(--tl-dot-active-ring); }

        /* 列表按钮默认隐藏，随时间线出现 */
        #menu-btn { display: none; }

        #chatgpt-timeline-panel {
            position: fixed;
            top: 50%;
            right: 112px;
            transform: translateY(-50%) translateX(20px);
            width: 320px;
            max-height: 75vh;
            background: var(--tl-panel-bg);
            border: 1px solid var(--tl-capsule-border);
            border-radius: 12px;
            box-shadow: 0 8px 24px var(--tl-capsule-shadow);
            z-index: 99997;
            display: flex;
            flex-direction: column;
            opacity: 0;
            pointer-events: none;
            visibility: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
        }
        #chatgpt-timeline-panel.visible { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(-50%) translateX(0); }

        #chatgpt-panel-search-wrapper { padding: 12px; border-bottom: 1px solid var(--tl-capsule-border); }
        #chatgpt-panel-search {
            width: 100%; background: var(--tl-input-bg); border: none; border-radius: 6px;
            padding: 8px 12px; color: var(--tl-panel-text); font-size: 13px; outline: none; box-sizing: border-box;
        }
        #chatgpt-panel-index-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
        #chatgpt-panel-index-missing {
            border: 1px solid var(--tl-capsule-border); background: var(--tl-capsule-bg); color: var(--tl-panel-text);
            border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; flex-shrink: 0;
        }
        #chatgpt-panel-index-missing:hover { border-color: var(--tl-dot-active-ring); }
        #chatgpt-panel-index-status { color: var(--tl-icon-color); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        #chatgpt-panel-list { flex-grow: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        #chatgpt-panel-list::-webkit-scrollbar { width: 6px; }
        #chatgpt-panel-list::-webkit-scrollbar-thumb { background: var(--tl-input-bg); border-radius: 3px; }

        .panel-list-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; color: var(--tl-panel-text); font-size: 13px; line-height: 1.5; display: flex; align-items: flex-start; gap: 10px; }
        .panel-list-item:hover { background: var(--tl-item-hover); }
        .panel-list-item.active { background: var(--tl-item-hover); border-left: 3px solid var(--tl-dot-active-ring); }
        .panel-list-text { flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .panel-list-index { font-weight: 600; color: var(--tl-icon-color); margin-right: 6px; font-size: 12px; }
        .panel-list-status { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
        .panel-list-item.highlighted .panel-list-status { background-color: #FFC107; box-shadow: 0 0 6px rgba(255, 193, 7, 0.6); }

        .katex-display { position: relative; }
        .formula-copy-btn {
            position: absolute; top: -12px; right: 0; background: var(--tl-capsule-bg); border: 1px solid var(--tl-capsule-border);
            color: var(--tl-icon-color); padding: 4px 8px; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: 0; transition: all 0.2s;
            box-shadow: 0 2px 8px var(--tl-capsule-shadow); display: flex; align-items: center; gap: 4px; z-index: 10; backdrop-filter: blur(4px);
        }
        .katex-display:hover .formula-copy-btn { opacity: 1; }

        #chatgpt-pm-fab {
            position: fixed;
            right: 24px;
            bottom: 24px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: 1px solid var(--tl-capsule-border);
            background: var(--tl-capsule-bg);
            color: var(--tl-icon-color);
            box-shadow: 0 10px 24px var(--tl-capsule-shadow);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            -webkit-user-select: none;
            user-select: none;
        }
        #chatgpt-pm-fab:hover { color: var(--tl-dot-active-ring); transform: translateY(-1px); }

        #chatgpt-pm-panel {
            position: fixed;
            width: 380px;
            max-width: calc(100vw - 24px);
            max-height: 70vh;
            background: var(--tl-panel-bg);
            border: 1px solid var(--tl-capsule-border);
            border-radius: 14px;
            box-shadow: 0 16px 40px var(--tl-capsule-shadow);
            z-index: 100001;
            display: none;
            flex-direction: column;
            overflow: hidden;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
        }
        #chatgpt-pm-panel.visible { display: flex; }

        #chatgpt-pm-header {
            padding: 12px 14px;
            border-bottom: 1px solid var(--tl-capsule-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: var(--tl-panel-text);
            font-weight: 600;
            font-size: 14px;
        }

        #chatgpt-pm-body {
            display: grid;
            grid-template-rows: auto auto 1fr;
            gap: 10px;
            padding: 12px;
            min-height: 300px;
        }

        .pm-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .pm-input, .pm-textarea, .pm-select {
            width: 100%;
            background: var(--tl-input-bg);
            border: 1px solid transparent;
            border-radius: 8px;
            color: var(--tl-panel-text);
            font-size: 13px;
            padding: 8px 10px;
            box-sizing: border-box;
            outline: none;
        }
        .pm-input:focus, .pm-textarea:focus, .pm-select:focus {
            border-color: var(--tl-dot-active-ring);
        }
        .pm-textarea {
            min-height: 82px;
            resize: vertical;
            line-height: 1.5;
        }

        .pm-actions {
            display: flex;
            gap: 8px;
            align-items: center;
            justify-content: flex-end;
        }

        .pm-btn {
            border: 1px solid var(--tl-capsule-border);
            background: var(--tl-capsule-bg);
            color: var(--tl-panel-text);
            border-radius: 8px;
            padding: 6px 10px;
            font-size: 12px;
            cursor: pointer;
        }
        .pm-btn:hover { border-color: var(--tl-dot-active-ring); }
        .pm-btn.primary {
            background: rgba(80, 140, 243, 0.15);
            border-color: rgba(80, 140, 243, 0.45);
        }
        .pm-btn.danger {
            border-color: rgba(255, 107, 107, 0.5);
            color: #ff6b6b;
        }

        #chatgpt-pm-list {
            overflow-y: auto;
            border-top: 1px solid var(--tl-capsule-border);
            padding-top: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .pm-group-title {
            color: var(--tl-icon-color);
            font-size: 12px;
            font-weight: 600;
            padding: 0 2px;
        }

        .pm-item {
            background: var(--tl-input-bg);
            border: 1px solid transparent;
            border-radius: 10px;
            padding: 8px;
            color: var(--tl-panel-text);
        }
        .pm-item:hover { border-color: var(--tl-capsule-border); }
        .pm-item-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        .pm-item-name {
            font-size: 13px;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .pm-item-text {
            font-size: 12px;
            line-height: 1.5;
            opacity: 0.9;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            word-break: break-word;
            margin-bottom: 6px;
        }
        .pm-item-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        #chatgpt-pm-empty {
            color: var(--tl-icon-color);
            font-size: 12px;
            text-align: center;
            padding: 12px 0;
        }

        #chatgpt-pm-toast {
            position: fixed;
            z-index: 100002;
            background: rgba(20, 20, 20, 0.9);
            color: #fff;
            border-radius: 8px;
            font-size: 12px;
            padding: 8px 10px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }
        #chatgpt-pm-toast.visible { opacity: 1; }
    `);

    // ==========================================
    // 2. 构建 DOM
    // ==========================================
    const container = document.createElement('div');
    container.id = 'chatgpt-dot-timeline';
    document.body.appendChild(container);

    const activeIndicator = document.createElement('div');
    activeIndicator.id = 'chatgpt-timeline-indicator';
    container.appendChild(activeIndicator);

    const globalTooltip = document.createElement('div');
    globalTooltip.id = 'chatgpt-timeline-tooltip';
    document.body.appendChild(globalTooltip);

    const toolsContainer = document.createElement('div');
    toolsContainer.id = 'chatgpt-timeline-tools';
    document.body.appendChild(toolsContainer);

    const menuBtn = document.createElement('div');
    menuBtn.id = 'menu-btn';
    menuBtn.className = 'tool-btn';
    menuBtn.title = '打开对话列表';
    menuBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
    toolsContainer.appendChild(menuBtn);

    const thinkBtn = document.createElement('div');
    thinkBtn.id = 'think-btn';
    thinkBtn.className = 'tool-btn';
    thinkBtn.title = '开启深度思考 (/think)';
    thinkBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path></svg>`;
    toolsContainer.appendChild(thinkBtn);

    const panel = document.createElement('div');
    panel.id = 'chatgpt-timeline-panel';
    panel.innerHTML = `<div id="chatgpt-panel-search-wrapper"><input type="text" id="chatgpt-panel-search" placeholder="搜索对话或序号..."></div><div id="chatgpt-panel-list"></div>`;
    document.body.appendChild(panel);
    panel.innerHTML = `<div id="chatgpt-panel-search-wrapper"><input type="text" id="chatgpt-panel-search" placeholder="Search conversation or number..."><div id="chatgpt-panel-index-row"><button id="chatgpt-panel-index-missing" type="button">Index Missing</button><span id="chatgpt-panel-index-status"></span></div></div><div id="chatgpt-panel-list"></div>`;

    const searchInput = document.getElementById('chatgpt-panel-search');
    const panelList = document.getElementById('chatgpt-panel-list');
    const timelineIndexBtn = document.getElementById('chatgpt-panel-index-missing');
    const timelineIndexStatus = document.getElementById('chatgpt-panel-index-status');

    const promptFab = document.createElement('div');
    promptFab.id = 'chatgpt-pm-fab';
    promptFab.title = 'Prompt Manager';
    promptFab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
    document.body.appendChild(promptFab);

    const promptPanel = document.createElement('div');
    promptPanel.id = 'chatgpt-pm-panel';
    promptPanel.innerHTML = `
        <div id="chatgpt-pm-header">
            <span>Prompt Manager</span>
            <button id="chatgpt-pm-close" class="pm-btn" type="button">Close</button>
        </div>
        <div id="chatgpt-pm-body">
            <div class="pm-row">
                <input id="chatgpt-pm-search" class="pm-input" type="text" placeholder="Search name/content">
                <select id="chatgpt-pm-filter" class="pm-select"></select>
            </div>
            <div>
                <div class="pm-row" style="margin-bottom:8px;">
                    <input id="chatgpt-pm-name" class="pm-input" type="text" placeholder="Prompt name">
                    <select id="chatgpt-pm-category" class="pm-select"></select>
                </div>
                <div class="pm-row" style="margin-bottom:8px;">
                    <input id="chatgpt-pm-new-category" class="pm-input" type="text" placeholder="New folder name">
                    <button id="chatgpt-pm-add-category" class="pm-btn" type="button">Add Folder</button>
                </div>
                <textarea id="chatgpt-pm-content" class="pm-textarea" placeholder="Prompt content"></textarea>
                <div class="pm-actions" style="margin-top:8px;">
                    <button id="chatgpt-pm-cancel" class="pm-btn" type="button">Clear</button>
                    <button id="chatgpt-pm-save" class="pm-btn primary" type="button">Save Prompt</button>
                </div>
            </div>
            <div id="chatgpt-pm-list"></div>
        </div>
    `;
    document.body.appendChild(promptPanel);

    const promptToast = document.createElement('div');
    promptToast.id = 'chatgpt-pm-toast';
    document.body.appendChild(promptToast);

    const pmEls = {
        closeBtn: promptPanel.querySelector('#chatgpt-pm-close'),
        search: promptPanel.querySelector('#chatgpt-pm-search'),
        filter: promptPanel.querySelector('#chatgpt-pm-filter'),
        name: promptPanel.querySelector('#chatgpt-pm-name'),
        category: promptPanel.querySelector('#chatgpt-pm-category'),
        newCategory: promptPanel.querySelector('#chatgpt-pm-new-category'),
        addCategory: promptPanel.querySelector('#chatgpt-pm-add-category'),
        content: promptPanel.querySelector('#chatgpt-pm-content'),
        cancel: promptPanel.querySelector('#chatgpt-pm-cancel'),
        save: promptPanel.querySelector('#chatgpt-pm-save'),
        list: promptPanel.querySelector('#chatgpt-pm-list')
    };

    function ensureMounted() {
        if (!document.body.contains(container)) document.body.appendChild(container);
        if (!document.body.contains(globalTooltip)) document.body.appendChild(globalTooltip);
        if (!document.body.contains(toolsContainer)) document.body.appendChild(toolsContainer);
        if (!document.body.contains(panel)) document.body.appendChild(panel);
        if (!document.body.contains(promptFab)) document.body.appendChild(promptFab);
        if (!document.body.contains(promptPanel)) document.body.appendChild(promptPanel);
        if (!document.body.contains(promptToast)) document.body.appendChild(promptToast);
    }

    // ==========================================
    // 3. 逻辑引擎与Markdown导出集成
    // ==========================================
    let isAutoScrolling = false;
    let scrollEndTimer = null;
    let tdService = null;
    let trackedTurns = [];
    let currentActiveIndex = -1;
    let activeSyncRaf = null;
    let lastTimelineSignature = '';
    let isTimelineHovering = false;
    let isTimelineIndexing = false;
    const PM_STORAGE_KEY = 'chatgpt_prompt_manager_data_v1';
    const PM_UI_KEY = 'chatgpt_prompt_manager_ui_v1';
    const TL_FAV_STORAGE_KEY = 'chatgpt_timeline_favorites_v1';
    const TL_INFO_STORAGE_KEY = 'chatgpt_timeline_turn_info_v1';
    const DEFAULT_CATEGORY_ID = 'cat_default';

    const pmState = {
        categories: [],
        prompts: [],
        filterCategory: 'all',
        search: '',
        editingId: null
    };
    let pmToastTimer = null;

    function pmNow() {
        return Date.now();
    }

    function pmId(prefix) {
        return `${prefix}_${pmNow()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeTurnKeyText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    }

    function getConversationKey() {
        return location.pathname || 'root';
    }

    function getTurnStableId(turn, index) {
        const attrId = turn.getAttribute('data-message-id')
            || turn.getAttribute('data-testid')
            || turn.id
            || '';
        return `${index}|${attrId || `turn-${index}`}`;
    }


    function readTimelineFavStore() {
        try {
            const raw = localStorage.getItem(TL_FAV_STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            return data && typeof data === 'object' ? data : {};
        } catch (err) {
            console.warn('[Timeline] favorites load failed:', err);
            return {};
        }
    }

    function readFavoritesForCurrentConversation() {
        const store = readTimelineFavStore();
        const list = store[getConversationKey()];
        return new Set(Array.isArray(list) ? list : []);
    }

    function writeFavoritesForCurrentConversation(favSet) {
        const store = readTimelineFavStore();
        store[getConversationKey()] = Array.from(favSet);
        localStorage.setItem(TL_FAV_STORAGE_KEY, JSON.stringify(store));
    }

    function readTimelineInfoStore() {
        try {
            const raw = localStorage.getItem(TL_INFO_STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            return data && typeof data === 'object' ? data : {};
        } catch (err) {
            console.warn('[Timeline] turn info load failed:', err);
            return {};
        }
    }

    function writeTimelineInfoStore(store) {
        localStorage.setItem(TL_INFO_STORAGE_KEY, JSON.stringify(store));
    }

    function readTurnInfoForCurrentConversation() {
        const store = readTimelineInfoStore();
        const rec = store[getConversationKey()];
        if (rec && typeof rec === 'object' && rec.turns && typeof rec.turns === 'object') return rec;
        return { version: 1, updatedAt: 0, turns: {} };
    }

    function writeTurnInfoForCurrentConversation(rec) {
        const store = readTimelineInfoStore();
        store[getConversationKey()] = { version: 1, updatedAt: Date.now(), turns: rec.turns || {} };
        writeTimelineInfoStore(store);
    }

    function isPlaceholderPreview(text) {
        return /^User turn \d+$/.test(String(text || ''));
    }

    function cacheTurnPreview(turn, index, text) {
        if (!text || isPlaceholderPreview(text)) return;
        const rec = readTurnInfoForCurrentConversation();
        const stableId = getTurnStableId(turn, index);
        rec.turns[stableId] = {
            preview: text,
            confirmed: true,
            updatedAt: Date.now()
        };
        writeTurnInfoForCurrentConversation(rec);
    }

    function getCachedTurnPreview(turn, index) {
        const rec = readTurnInfoForCurrentConversation();
        const stableId = getTurnStableId(turn, index);
        return rec.turns?.[stableId]?.preview || '';
    }

    function loadPromptData() {
        try {
            const raw = localStorage.getItem(PM_STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            pmState.categories = Array.isArray(data.categories) ? data.categories : [];
            pmState.prompts = Array.isArray(data.prompts) ? data.prompts : [];
        } catch (err) {
            console.warn('[PromptManager] load failed:', err);
        }
    }

    function savePromptData() {
        localStorage.setItem(PM_STORAGE_KEY, JSON.stringify({
            categories: pmState.categories,
            prompts: pmState.prompts
        }));
    }

    function ensureDefaultCategory() {
        let found = pmState.categories.find(c => c.id === DEFAULT_CATEGORY_ID);
        if (!found) {
            found = { id: DEFAULT_CATEGORY_ID, name: 'General' };
            pmState.categories.unshift(found);
        }
    }

    function normalizeCategoryName(name) {
        return (name || '').replace(/\s+/g, ' ').trim();
    }

    function getCategoryName(categoryId) {
        return pmState.categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
    }

    function showPromptToast(message) {
        promptToast.textContent = message;
        const rect = promptFab.getBoundingClientRect();
        promptToast.style.left = `${Math.max(8, rect.left - 180)}px`;
        promptToast.style.top = `${Math.max(8, rect.top - 44)}px`;
        promptToast.classList.add('visible');
        clearTimeout(pmToastTimer);
        pmToastTimer = setTimeout(() => {
            promptToast.classList.remove('visible');
        }, 1400);
    }

    function persistPromptUI() {
        const data = {};
        if (promptFab.style.left) data.left = promptFab.style.left;
        if (promptFab.style.top) data.top = promptFab.style.top;
        localStorage.setItem(PM_UI_KEY, JSON.stringify(data));
    }

    function restorePromptUI() {
        try {
            const data = JSON.parse(localStorage.getItem(PM_UI_KEY) || '{}');
            if (data.left && data.top) {
                promptFab.style.left = data.left;
                promptFab.style.top = data.top;
                promptFab.style.right = 'auto';
                promptFab.style.bottom = 'auto';
            }
        } catch (err) {
            console.warn('[PromptManager] restore UI failed:', err);
        }
    }

    function positionPromptPanel() {
        const fabRect = promptFab.getBoundingClientRect();
        const panelWidth = Math.min(380, window.innerWidth - 24);
        const estimatedHeight = Math.min(window.innerHeight * 0.7, 580);
        let left = fabRect.left - panelWidth - 10;
        let top = fabRect.bottom - estimatedHeight;
        if (left < 8) left = 8;
        if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;
        if (top < 8) top = 8;
        promptPanel.style.left = `${left}px`;
        promptPanel.style.top = `${top}px`;
    }

    function setPromptPanelVisible(visible) {
        if (visible) {
            positionPromptPanel();
            promptPanel.classList.add('visible');
            pmEls.search.focus();
        } else {
            promptPanel.classList.remove('visible');
        }
    }

    function renderCategoryOptions() {
        const categoryOptions = pmState.categories
            .map(c => `<option value="${c.id}">${c.name}</option>`)
            .join('');
        pmEls.category.innerHTML = categoryOptions;
        pmEls.filter.innerHTML = `<option value="all">All Folders</option>${categoryOptions}`;
        if (!pmState.categories.some(c => c.id === pmState.filterCategory)) {
            pmState.filterCategory = 'all';
        }
        pmEls.filter.value = pmState.filterCategory;
        if (!pmEls.category.value) pmEls.category.value = DEFAULT_CATEGORY_ID;
    }

    function resetPromptForm() {
        pmState.editingId = null;
        pmEls.name.value = '';
        pmEls.content.value = '';
        pmEls.category.value = DEFAULT_CATEGORY_ID;
        pmEls.save.textContent = 'Save Prompt';
    }

    function filteredPrompts() {
        const keyword = pmState.search.toLowerCase();
        return pmState.prompts.filter(p => {
            if (pmState.filterCategory !== 'all' && p.categoryId !== pmState.filterCategory) return false;
            if (!keyword) return true;
            const joined = `${p.name || ''}\n${p.content || ''}`.toLowerCase();
            return joined.includes(keyword);
        });
    }

    function findPromptInput() {
        return document.querySelector('#prompt-textarea')
            || document.querySelector('textarea[data-testid="prompt-textarea"]')
            || document.querySelector('textarea');
    }

    function appendPromptToInput(promptText) {
        const input = findPromptInput();
        if (!input) {
            showPromptToast('Input box not found');
            return false;
        }

        const text = (promptText || '').trim();
        if (!text) {
            showPromptToast('Prompt is empty');
            return false;
        }

        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            const current = input.value || '';
            const separator = current.trim().length > 0 ? '\n\n' : '';
            input.value = `${current}${separator}${text}`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
            if (typeof input.setSelectionRange === 'function') {
                const pos = input.value.length;
                input.setSelectionRange(pos, pos);
            }
            showPromptToast('Prompt appended');
            return true;
        }

        if (input.isContentEditable) {
            const current = (input.innerText || '').replace(/\r/g, '');
            const hasContent = current.length > 0;
            const endsWithBreak = /\n$/.test(current);
            const separator = hasContent ? (endsWithBreak ? '' : '\n\n') : '';
            const toInsert = `${separator}${text}`;

            input.focus();
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);

            const ok = document.execCommand('insertText', false, toInsert);
            if (!ok) {
                const node = document.createTextNode(toInsert);
                range.insertNode(node);
                range.setStartAfter(node);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            input.dispatchEvent(new Event('input', { bubbles: true }));
            showPromptToast('Prompt appended');
            return true;
        }

        showPromptToast('Unsupported input box');
        return false;
    }

    async function copyPrompt(promptText) {
        try {
            await navigator.clipboard.writeText(promptText || '');
            showPromptToast('Copied');
            return true;
        } catch (err) {
            showPromptToast('Copy failed');
            return false;
        }
    }

    function renderPromptList() {
        const data = filteredPrompts().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        if (!data.length) {
            pmEls.list.innerHTML = `<div id="chatgpt-pm-empty">No prompts in current view</div>`;
            return;
        }

        const groups = new Map();
        data.forEach(item => {
            const key = item.categoryId || DEFAULT_CATEGORY_ID;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });

        let html = '';
        for (const [categoryId, items] of groups.entries()) {
            html += `<div class="pm-group-title">${getCategoryName(categoryId)}</div>`;
            items.forEach(item => {
                const preview = (item.content || '').replace(/\s+/g, ' ').trim().slice(0, 120);
                html += `
                    <div class="pm-item" data-prompt-id="${item.id}">
                        <div class="pm-item-head">
                            <div class="pm-item-name">${item.name || 'Untitled'}</div>
                        </div>
                        <div class="pm-item-text">${preview}</div>
                        <div class="pm-item-actions">
                            <button class="pm-btn primary" data-action="append" type="button">Append</button>
                            <button class="pm-btn" data-action="copy" type="button">Copy</button>
                            <button class="pm-btn" data-action="edit" type="button">Edit</button>
                            <button class="pm-btn danger" data-action="delete" type="button">Delete</button>
                        </div>
                    </div>
                `;
            });
        }
        pmEls.list.innerHTML = html;
    }

    function addCategoryByName(rawName) {
        const name = normalizeCategoryName(rawName);
        if (!name) return null;
        const existing = pmState.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        const category = { id: pmId('cat'), name };
        pmState.categories.push(category);
        savePromptData();
        renderCategoryOptions();
        renderPromptList();
        return category;
    }

    function savePromptFromForm() {
        const name = (pmEls.name.value || '').trim();
        const content = (pmEls.content.value || '').trim();
        const categoryId = pmEls.category.value || DEFAULT_CATEGORY_ID;
        if (!name) {
            showPromptToast('Name required');
            return;
        }
        if (!content) {
            showPromptToast('Prompt content required');
            return;
        }

        if (pmState.editingId) {
            const target = pmState.prompts.find(p => p.id === pmState.editingId);
            if (!target) return;
            target.name = name;
            target.content = content;
            target.categoryId = categoryId;
            target.updatedAt = pmNow();
        } else {
            pmState.prompts.unshift({
                id: pmId('prompt'),
                name,
                content,
                categoryId,
                createdAt: pmNow(),
                updatedAt: pmNow()
            });
        }

        savePromptData();
        renderPromptList();
        resetPromptForm();
        showPromptToast('Saved');
    }

    function startEditPrompt(promptId) {
        const item = pmState.prompts.find(p => p.id === promptId);
        if (!item) return;
        pmState.editingId = item.id;
        pmEls.name.value = item.name || '';
        pmEls.content.value = item.content || '';
        pmEls.category.value = item.categoryId || DEFAULT_CATEGORY_ID;
        pmEls.save.textContent = 'Update Prompt';
    }

    function removePrompt(promptId) {
        const idx = pmState.prompts.findIndex(p => p.id === promptId);
        if (idx < 0) return;
        pmState.prompts.splice(idx, 1);
        savePromptData();
        renderPromptList();
        if (pmState.editingId === promptId) resetPromptForm();
        showPromptToast('Deleted');
    }

    function bindPromptEvents() {
        let dragStartX = 0;
        let dragStartY = 0;
        let originLeft = 0;
        let originTop = 0;
        let isDraggingFab = false;

        promptFab.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const rect = promptFab.getBoundingClientRect();
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            originLeft = rect.left;
            originTop = rect.top;
            isDraggingFab = false;

            const onMove = (ev) => {
                const dx = ev.clientX - dragStartX;
                const dy = ev.clientY - dragStartY;
                if (!isDraggingFab && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                    isDraggingFab = true;
                }
                if (!isDraggingFab) return;
                let left = originLeft + dx;
                let top = originTop + dy;
                const maxLeft = window.innerWidth - rect.width - 6;
                const maxTop = window.innerHeight - rect.height - 6;
                left = Math.max(6, Math.min(left, maxLeft));
                top = Math.max(6, Math.min(top, maxTop));
                promptFab.style.left = `${left}px`;
                promptFab.style.top = `${top}px`;
                promptFab.style.right = 'auto';
                promptFab.style.bottom = 'auto';
                if (promptPanel.classList.contains('visible')) positionPromptPanel();
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (isDraggingFab) {
                    persistPromptUI();
                } else {
                    setPromptPanelVisible(!promptPanel.classList.contains('visible'));
                }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        pmEls.closeBtn.addEventListener('click', () => setPromptPanelVisible(false));

        pmEls.search.addEventListener('input', (e) => {
            pmState.search = (e.target.value || '').trim();
            renderPromptList();
        });

        pmEls.filter.addEventListener('change', (e) => {
            pmState.filterCategory = e.target.value || 'all';
            renderPromptList();
        });

        pmEls.addCategory.addEventListener('click', () => {
            const category = addCategoryByName(pmEls.newCategory.value);
            if (!category) {
                showPromptToast('Folder name required');
                return;
            }
            pmEls.newCategory.value = '';
            pmEls.category.value = category.id;
            showPromptToast('Folder added');
        });

        pmEls.save.addEventListener('click', savePromptFromForm);
        pmEls.cancel.addEventListener('click', resetPromptForm);

        pmEls.list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const item = e.target.closest('.pm-item');
            if (!item) return;
            const promptId = item.getAttribute('data-prompt-id');
            const target = pmState.prompts.find(p => p.id === promptId);
            if (!target) return;

            const action = btn.getAttribute('data-action');
            if (action === 'append') appendPromptToInput(target.content);
            if (action === 'copy') copyPrompt(target.content);
            if (action === 'edit') startEditPrompt(promptId);
            if (action === 'delete') removePrompt(promptId);
        });

        document.addEventListener('click', (e) => {
            if (!promptPanel.classList.contains('visible')) return;
            if (promptPanel.contains(e.target) || promptFab.contains(e.target)) return;
            setPromptPanelVisible(false);
        });

        window.addEventListener('resize', () => {
            if (promptPanel.classList.contains('visible')) positionPromptPanel();
        });
    }

    function initPromptManager() {
        loadPromptData();
        ensureDefaultCategory();
        restorePromptUI();
        renderCategoryOptions();
        renderPromptList();
        bindPromptEvents();
    }

    // 初始化Turndown引擎
    function getTurndownService() {
        if (tdService) return tdService;
        tdService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            emDelimiter: '*'
        });
        if (typeof turndownPluginGfm !== 'undefined') {
            tdService.use(turndownPluginGfm.gfm);
        }
        
        // 修复删除线语法（Turndown GFM 默认可能使用 ~，这里强制改为 ~~）
        tdService.addRule('strikethrough-fix', {
            filter: ['del', 's', 'strike'],
            replacement: function (content) {
                return '~~' + content + '~~';
            }
        });
        
        // 自定义解析ChatGPT特有代码块
        tdService.addRule('chatgptCodeBlock', {
            filter: 'pre',
            replacement: function (content, node) {
                let lang = '';
                const langDiv = node.querySelector('.text-token-text-primary');
                if (langDiv) {
                    lang = langDiv.textContent.trim();
                }
                let codeText = '';
                const contentDiv = node.querySelector('.cm-content');
                if (contentDiv) {
                    const clone = contentDiv.cloneNode(true);
                    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                    codeText = clone.textContent;
                } else {
                    codeText = node.textContent;
                }
                return '\n```' + lang + '\n' + codeText + '\n```\n';
            }
        });
        return tdService;
    }

    function prepareMarkdownClone(markdownDiv) {
        const clone = markdownDiv.cloneNode(true);

        clone.querySelectorAll('svg').forEach(svg => svg.remove());
        clone.querySelectorAll('button, [role="button"], [data-testid="copy-turn-action-button"]').forEach(btn => btn.remove());

        clone.querySelectorAll('[data-testid="webpage-citation-pill"] a').forEach(aTag => {
            const visibleSpan = aTag.querySelector('span[style*="opacity: 1"]');
            let correctText = '';
            if (visibleSpan) {
                correctText = visibleSpan.textContent.trim();
            } else {
                const backupSpan = aTag.querySelector('span > span');
                correctText = backupSpan ? backupSpan.textContent.trim() : aTag.textContent.trim();
            }
            aTag.innerHTML = '';
            aTag.textContent = correctText;
        });

        clone.querySelectorAll('.katex-display').forEach(katex => {
            const annotation = katex.querySelector('annotation[encoding="application/x-tex"]');
            if (annotation) katex.textContent = '\n$$\n' + annotation.textContent.trim() + '\n$$\n';
        });
        clone.querySelectorAll('.katex').forEach(katex => {
            const annotation = katex.querySelector('annotation[encoding="application/x-tex"]');
            if (annotation && !katex.classList.contains('katex-display')) {
                katex.textContent = '$' + annotation.textContent.trim() + '$';
            }
        });

        return clone;
    }

    function markdownDomToMarkdown(markdownDiv) {
        if (!markdownDiv) return '';
        try {
            return getTurndownService().turndown(prepareMarkdownClone(markdownDiv)).trim();
        } catch (err) {
            console.warn('[ChatGPT Navigator] Markdown conversion failed:', err);
            return '';
        }
    }

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('visible');
        if (panel.classList.contains('visible')) searchInput.focus();
    });

    document.addEventListener('click', (e) => {
        if (panel.classList.contains('visible') && !panel.contains(e.target) && !menuBtn.contains(e.target)) {
            panel.classList.remove('visible');
        }
    });

    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        panelList.querySelectorAll('.panel-list-item').forEach(item => {
            const text = item.querySelector('.panel-list-text').textContent.toLowerCase();
            item.style.display = text.includes(keyword) ? 'flex' : 'none';
        });
    });
    timelineIndexBtn.addEventListener('click', indexMissingTimelineTurns);

    thinkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const editor = document.querySelector('#prompt-textarea');
        if (!editor) return;
        editor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        editor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        await new Promise(r => setTimeout(r, 50));
        document.execCommand('insertText', false, '/think');
        await new Promise(r => setTimeout(r, 150));
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        const originalColor = thinkBtn.style.color;
        thinkBtn.style.color = '#10a37f';
        setTimeout(() => thinkBtn.style.color = originalColor, 1000);
    });

    function updateIndicator(targetDot) {
        if (!targetDot) { activeIndicator.style.opacity = '0'; return; }
        activeIndicator.style.opacity = '1';
        activeIndicator.style.transform = `translateY(${targetDot.offsetTop}px)`;
        activeIndicator.style.boxShadow = targetDot.classList.contains('highlighted') ? '0 0 0 3px rgba(255, 193, 7, 0.5)' : '0 0 0 3px var(--tl-dot-active-ring)';
    }

    function setActiveIndex(index) {
        if (!Number.isInteger(index) || index < 0) return;
        if (index === currentActiveIndex) return;
        currentActiveIndex = index;

        document.querySelectorAll('.timeline-dot').forEach(dot => dot.classList.remove('active'));
        const activeDot = document.querySelector(`.timeline-dot[data-index="${index}"]`);
        if (activeDot) {
            activeDot.classList.add('active');
            updateIndicator(activeDot);
        } else {
            updateIndicator(null);
        }

        document.querySelectorAll('.panel-list-item').forEach(item => item.classList.remove('active'));
        const targetListItem = document.querySelector(`.panel-list-item[data-index="${index}"]`);
        if (targetListItem) targetListItem.classList.add('active');
    }

    function computeActiveIndexByViewport() {
        if (!trackedTurns.length) return -1;
        const pivotY = window.innerHeight * 0.38;
        let candidate = -1;

        for (let i = 0; i < trackedTurns.length; i++) {
            const turn = trackedTurns[i];
            if (!turn || !document.contains(turn)) continue;
            const top = turn.getBoundingClientRect().top;
            if (top <= pivotY) candidate = i;
            else break;
        }

        if (candidate >= 0) return candidate;
        for (let i = 0; i < trackedTurns.length; i++) {
            const turn = trackedTurns[i];
            if (!turn || !document.contains(turn)) continue;
            return i;
        }
        return -1;
    }

    function getTurnAnchor(turnNode) {
        if (!turnNode || !(turnNode instanceof Element)) return turnNode;
        return turnNode.closest('[data-testid^="conversation-turn-"]')
            || turnNode.closest('div.flex.max-w-full.flex-col.gap-4.grow')
            || turnNode;
    }

    function getScrollContainer(el) {
        let node = el?.parentElement;
        while (node && node !== document.body && node !== document.documentElement) {
            const style = window.getComputedStyle(node);
            const overflowY = style.overflowY || style.overflow;
            if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 4) {
                return node;
            }
            node = node.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    }

    function getScrollerTop(scroller) {
        if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
            return 0;
        }
        return scroller.getBoundingClientRect().top;
    }

    function scrollScrollerTo(scroller, top, behavior) {
        if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
            window.scrollTo({ top, behavior });
        } else {
            scroller.scrollTo({ top, behavior });
        }
    }

    function scrollTopOf(scroller) {
        if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
            return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        }
        return scroller.scrollTop;
    }

    function preciseScrollToAnchor(anchor, index) {
        if (!anchor || !(anchor instanceof Element)) return;
        const scroller = getScrollContainer(anchor);
        const topOffset = (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) ? 88 : 16;
        let attempt = 0;

        const step = (behavior) => {
            if (!document.contains(anchor)) {
                isAutoScrolling = false;
                scheduleActiveSync();
                return;
            }

            const rect = anchor.getBoundingClientRect();
            const delta = rect.top - getScrollerTop(scroller) - topOffset;
            if (Math.abs(delta) > 3) {
                scrollScrollerTo(scroller, scrollTopOf(scroller) + delta, behavior);
            }

            setActiveIndex(index);
            refreshVisibleTurnPreviews();
            attempt += 1;

            if (attempt < 9 && Math.abs(delta) > 3) {
                setTimeout(() => step('auto'), attempt === 1 ? 220 : 90);
            } else {
                setTimeout(() => {
                    isAutoScrolling = false;
                    scheduleActiveSync();
                    refreshVisibleTurnPreviews();
                }, 120);
            }
        };

        step('smooth');
    }

    function syncActiveFromViewport() {
        activeSyncRaf = null;
        if (isAutoScrolling) return;
        refreshVisibleTurnPreviews();
        const nextIndex = computeActiveIndexByViewport();
        if (nextIndex >= 0) setActiveIndex(nextIndex);
    }

    function scheduleActiveSync() {
        if (activeSyncRaf !== null) return;
        activeSyncRaf = requestAnimationFrame(syncActiveFromViewport);
    }

    function jumpToTurn(index, turnNode, sourceDot) {
        globalTooltip.classList.remove('visible');
        isAutoScrolling = true;
        const anchor = getTurnAnchor(turnNode);
        setActiveIndex(index);
        preciseScrollToAnchor(anchor, index);
    }

    function handleAnyScroll() {
        if (isAutoScrolling) {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(() => {
                isAutoScrolling = false;
                scheduleActiveSync();
            }, 150);
        } else {
            scheduleActiveSync();
        }
    }

    const scrollObserver = new IntersectionObserver((entries) => {
        if (isAutoScrolling) return;
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = entry.target.getAttribute('data-timeline-index');
                setActiveIndex(parseInt(index, 10));
            }
        });
    }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });

    function enhanceFormulas() {
        document.querySelectorAll('.katex-display:not(.enhanced-formula)').forEach(block => {
            const annotation = block.querySelector('annotation[encoding="application/x-tex"]');
            if (!annotation) return;
            block.classList.add('enhanced-formula');
            const copyBtn = document.createElement('div');
            copyBtn.className = 'formula-copy-btn';
            const defaultIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            const successIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10a37f" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            copyBtn.innerHTML = `${defaultIcon} 复制公式`;
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`$$ ${annotation.textContent} $$`).then(() => {
                    copyBtn.innerHTML = `${successIcon} 已复制`;
                    copyBtn.style.color = '#10a37f';
                    setTimeout(() => { copyBtn.innerHTML = `${defaultIcon} 复制公式`; copyBtn.style.color = ''; }, 2000);
                });
            });
            block.appendChild(copyBtn);
        });
    }

    // 提取并导出回答为Markdown
    function exportTurnToMarkdown(actionContainer) {
        const turnNode = actionContainer.closest('[data-testid^="conversation-turn-"], [data-turn="assistant"]');
        if (!turnNode) return;

        const contentContainer = turnNode.querySelector('.flex.max-w-full.flex-col.gap-4.grow');
        if (!contentContainer) return;

        let mdContent = "";
        const children = contentContainer.children;
        const turndown = getTurndownService();
        
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.getAttribute('data-message-author-role') === 'assistant') {
                const markdownDiv = child.querySelector('.markdown');
                if (markdownDiv) {
                    const nextChild = children[i+1];
                    let isThought = false;
                    let thoughtTime = "Thought process";
                    
                    if (nextChild && nextChild.classList.contains('justify-between')) {
                        const btn = nextChild.querySelector('button');
                        if (btn && btn.textContent.includes('Thought')) {
                            isThought = true;
                            thoughtTime = btn.textContent.trim();
                        }
                    }
                    
                    let md = turndown.turndown(prepareMarkdownClone(markdownDiv));
                    
                    // 若是思考层则封装为引用快
                    if (isThought) {
                        mdContent += `> **${thoughtTime}**\n>\n> ` + md.split('\n').join('\n> ') + `\n\n`;
                    } else {
                        mdContent += md + `\n\n`;
                    }
                }
            }
        }

        if (mdContent.trim() === '') return;

        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ChatGPT_Response_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 挂载导出Markdown按钮
    function addExportButtons() {
        document.querySelectorAll('[data-testid="copy-turn-action-button"]').forEach(copyBtn => {
            const container = copyBtn.parentElement;
            if (!container || container.querySelector('.export-md-btn')) return;

            const exportBtn = document.createElement('button');
            exportBtn.className = 'export-md-btn text-token-text-secondary hover:bg-token-bg-secondary rounded-lg';
            exportBtn.setAttribute('aria-label', '导出为Markdown');
            exportBtn.setAttribute('title', '导出为Markdown');
            // 保留原有界面的交互与视觉效果匹配
            exportBtn.innerHTML = `<span class="flex items-center justify-center touch:w-10 h-8 w-8"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></span>`;
            
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                exportTurnToMarkdown(container);
            });

            container.appendChild(exportBtn);
        });
    }

    function updateTimeline() {
        ensureMounted();
        enhanceFormulas();
        addExportButtons();

        const userTurns = getUserTurnsRobust();
        trackedTurns = userTurns;
        const timelineScrollTop = container.scrollTop;
        const timelineScrollHeight = container.scrollHeight;
        const timelineRatio = timelineScrollHeight > 0 ? (timelineScrollTop / timelineScrollHeight) : 0;
        const signature = trackedTurns
            .map((turn, idx) => `${idx}:${turn.getAttribute('data-testid') || ''}:${turn.getAttribute('data-message-id') || ''}`)
            .join('|');

        // 保存黄点标记状态（持久化）
        const highlightedTurnIds = readFavoritesForCurrentConversation();

        // 时间线渲染判定
        if (trackedTurns.length === 0) {
            container.style.display = 'none';
            menuBtn.style.display = 'none';
            panel.classList.remove('visible');
        } else {
            container.style.display = 'flex';
            menuBtn.style.display = 'flex';
        }

        if (signature === lastTimelineSignature) {
            refreshVisibleTurnPreviews();
            scheduleActiveSync();
            return;
        }
        lastTimelineSignature = signature;

        container.querySelectorAll('.timeline-dot').forEach(d => d.remove());
        scrollObserver.disconnect();
        panelList.innerHTML = '';
        currentActiveIndex = -1;

        trackedTurns.forEach((turn, index) => {
            turn.setAttribute('data-timeline-index', index);
            const stableId = getTurnStableId(turn, index);
            scrollObserver.observe(turn);
            const previewText = getTurnPreviewText(turn, index);

            const dot = document.createElement('div');
            dot.className = 'timeline-dot';
            dot.setAttribute('data-index', index);
            if (highlightedTurnIds.has(stableId)) dot.classList.add('highlighted');

            const listItem = document.createElement('div');
            listItem.className = 'panel-list-item';
            listItem.setAttribute('data-index', index);
            listItem.innerHTML = `<div class="panel-list-status"></div><div class="panel-list-text"><span class="panel-list-index">${index + 1}.</span>${escapeHTML(previewText)}</div>`;
            if (highlightedTurnIds.has(stableId)) listItem.classList.add('highlighted');

            dot.addEventListener('mouseenter', () => {
                const rect = dot.getBoundingClientRect();
                const currentTurn = trackedTurns[index] || turn;
                const freshPreview = getTurnPreviewText(currentTurn, index);
                updateTimelineItemPreview(index, freshPreview);
                globalTooltip.innerText = freshPreview;
                globalTooltip.style.top = `${rect.top + rect.height / 2}px`;
                globalTooltip.style.right = `${window.innerWidth - rect.left + 14}px`;
                globalTooltip.classList.add('visible');
            });
            dot.addEventListener('mouseleave', () => globalTooltip.classList.remove('visible'));

            let pressTimer;
            let isLongPress = false;
            dot.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    const nextOn = !dot.classList.contains('highlighted');
                    dot.classList.toggle('highlighted', nextOn);
                    listItem.classList.toggle('highlighted', nextOn);
                    if (nextOn) highlightedTurnIds.add(stableId);
                    else highlightedTurnIds.delete(stableId);
                    writeFavoritesForCurrentConversation(highlightedTurnIds);
                    if (dot.classList.contains('active')) updateIndicator(dot);
                }, 450);
            });
            dot.addEventListener('mouseup', () => clearTimeout(pressTimer));
            dot.addEventListener('mouseleave', () => clearTimeout(pressTimer));

            dot.addEventListener('click', (e) => { if (!isLongPress) jumpToTurn(index, trackedTurns[index] || turn, dot); });
            listItem.addEventListener('click', () => jumpToTurn(index, trackedTurns[index] || turn, dot));

            container.appendChild(dot);
            panelList.appendChild(listItem);
        });

        const newHeight = container.scrollHeight;
        if (newHeight > 0) {
            container.scrollTop = Math.max(0, Math.min(newHeight, timelineRatio * newHeight));
        }

        scheduleActiveSync();
    }

    function getUserTurnsRobust() {
        const wrappers = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
        const users = [];

        wrappers.forEach((wrapper, idx) => {
            if (!(wrapper instanceof Element)) return;
            const explicitRoleNode = wrapper.querySelector('[data-message-author-role]');
            const explicitRole = (explicitRoleNode?.getAttribute('data-message-author-role') || '').toLowerCase();

            let isUser = false;
            if (explicitRole === 'user') {
                isUser = true;
            } else if (explicitRole === 'assistant') {
                isUser = false;
            } else {
                const tid = wrapper.getAttribute('data-testid') || '';
                const m = tid.match(/conversation-turn-(\d+)/);
                const turnNumber = m ? parseInt(m[1], 10) : (idx + 1);
                isUser = Number.isInteger(turnNumber) && (turnNumber % 2 === 1);
            }

            if (isUser) users.push(wrapper);
        });

        return users;
    }

    function escapeHTML(text) {
        return String(text || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    function updateTimelineItemPreview(index, text) {
        const item = panelList.querySelector(`.panel-list-item[data-index="${index}"] .panel-list-text`);
        if (!item || !text || isPlaceholderPreview(text)) return;
        const current = item.textContent || '';
        if (current.includes(text.slice(0, 32))) return;
        item.innerHTML = `<span class="panel-list-index">${index + 1}.</span>${escapeHTML(text)}`;
    }

    function refreshVisibleTurnPreviews() {
        trackedTurns.forEach((turn, index) => {
            if (!(turn instanceof Element) || !document.contains(turn)) return;
            const rect = turn.getBoundingClientRect();
            const nearViewport = rect.bottom >= -300 && rect.top <= window.innerHeight + 300;
            if (!nearViewport) return;
            const text = getTurnPreviewText(turn, index);
            cacheTurnPreview(turn, index, text);
            updateTimelineItemPreview(index, text);
        });
    }

    function getTurnPreviewText(turnWrapper, index) {
        if (!(turnWrapper instanceof Element)) return `User turn ${index + 1}`;
        const userNode = turnWrapper.querySelector('[data-message-author-role="user"]');
        const text = ((userNode?.innerText || userNode?.textContent || '').replace(/\s+/g, ' ').trim());
        if (text) {
            const preview = text.length > 120 ? `${text.slice(0, 120)}...` : text;
            cacheTurnPreview(turnWrapper, index, preview);
            return preview;
        }
        return getCachedTurnPreview(turnWrapper, index) || `User turn ${index + 1}`;
    }

    function tlSleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForTurnPreview(index, timeoutMs = 3200) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            const currentTurns = getUserTurnsRobust();
            trackedTurns = currentTurns;
            const turn = currentTurns[index];
            const text = getTurnPreviewText(turn, index);
            if (!isPlaceholderPreview(text)) {
                updateTimelineItemPreview(index, text);
                return text;
            }
            await tlSleep(160);
        }
        return '';
    }

    function getMissingIndexedTurnIndexes() {
        const currentTurns = getUserTurnsRobust();
        trackedTurns = currentTurns;
        return currentTurns
            .map((turn, index) => ({ turn, index, preview: getTurnPreviewText(turn, index) }))
            .filter(item => isPlaceholderPreview(item.preview))
            .map(item => item.index);
    }

    async function indexMissingTimelineTurns() {
        if (isTimelineIndexing) return;
        isTimelineIndexing = true;
        timelineIndexBtn.disabled = true;
        try {
            updateTimeline();
            const missing = getMissingIndexedTurnIndexes();
            if (!missing.length) {
                timelineIndexStatus.textContent = 'All indexed';
                return;
            }

            for (let i = 0; i < missing.length; i++) {
                const index = missing[i];
                timelineIndexStatus.textContent = `Indexing ${i + 1}/${missing.length}`;
                const turn = getUserTurnsRobust()[index];
                if (!(turn instanceof Element)) continue;
                isAutoScrolling = true;
                preciseScrollToAnchor(turn, index);
                await waitForTurnPreview(index);
                await tlSleep(260);
            }

            updateTimeline();
            timelineIndexStatus.textContent = 'Indexed';
        } catch (err) {
            console.error('[Timeline] index missing failed:', err);
            timelineIndexStatus.textContent = 'Index failed';
        } finally {
            isTimelineIndexing = false;
            timelineIndexBtn.disabled = false;
            setTimeout(() => {
                if (!isTimelineIndexing) timelineIndexStatus.textContent = '';
            }, 1800);
        }
    }

    // ==========================================
    // Backup Manager (ChatGPT)
    // ==========================================
    const BK_MANIFEST_KEY = 'chatgpt_backup_manifest_v1';
    const BK_IDB_NAME = 'chatgpt-backup-manager-idb';
    const BK_IDB_STORE = 'kv';
    const BK_IDB_DIR_KEY = 'backup-dir-handle';
    const BK_FAB_POS_KEY = 'chatgpt-backup-fab-pos-v1';
    const bkState = { running: false, manifest: bkLoadManifest(), ui: null };

    GM_addStyle(`
        #chatgpt-bk-fab {
            position: fixed;
            left: 24px;
            bottom: 24px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: 1px solid var(--tl-capsule-border);
            background: var(--tl-capsule-bg);
            color: var(--tl-icon-color);
            box-shadow: 0 10px 24px var(--tl-capsule-shadow);
            z-index: 100010;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            -webkit-user-select: none;
            user-select: none;
        }
        #chatgpt-bk-fab:hover { color: var(--tl-dot-active-ring); transform: translateY(-1px); }
        #chatgpt-bk-panel {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 420px;
            max-width: calc(100vw - 24px);
            max-height: 76vh;
            z-index: 100011;
            display: none;
            flex-direction: column;
            overflow: hidden;
            background: var(--tl-panel-bg);
            border: 1px solid var(--tl-capsule-border);
            border-radius: 12px;
            box-shadow: 0 16px 36px var(--tl-capsule-shadow);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
        }
        #chatgpt-bk-panel.visible { display: flex; }
        #chatgpt-bk-head { padding: 12px; border-bottom: 1px solid var(--tl-capsule-border); display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--tl-panel-text); }
        #chatgpt-bk-title { font-size: 14px; font-weight: 600; }
        .chatgpt-bk-btn {
            border: 1px solid var(--tl-capsule-border);
            background: var(--tl-capsule-bg);
            color: var(--tl-panel-text);
            border-radius: 8px;
            padding: 7px 10px;
            font-size: 12px;
            cursor: pointer;
        }
        .chatgpt-bk-btn:hover { border-color: var(--tl-dot-active-ring); }
        .chatgpt-bk-btn.primary { background: rgba(80, 140, 243, 0.15); border-color: rgba(80, 140, 243, 0.45); }
        #chatgpt-bk-body { padding: 12px; overflow: auto; display: grid; gap: 10px; color: var(--tl-panel-text); }
        .chatgpt-bk-card { border: 1px solid var(--tl-capsule-border); border-radius: 10px; padding: 10px; background: var(--tl-input-bg); }
        .chatgpt-bk-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .chatgpt-bk-muted { color: var(--tl-icon-color); font-size: 12px; line-height: 1.5; }
        .chatgpt-bk-line { font-size: 13px; line-height: 1.55; white-space: pre-wrap; }
        #chatgpt-bk-log { white-space: pre-wrap; font-size: 12px; line-height: 1.45; max-height: 180px; overflow: auto; }
    `);

    function bkLoadManifest() {
        try {
            const raw = localStorage.getItem(BK_MANIFEST_KEY);
            const data = raw ? JSON.parse(raw) : null;
            if (data && typeof data === 'object' && data.version === 1) return data;
        } catch (e) {}
        return { version: 1, conversations: {} };
    }
    function bkSaveManifest() {
        localStorage.setItem(BK_MANIFEST_KEY, JSON.stringify(bkState.manifest));
    }
    function bkClamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function bkSleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function bkHashText(s) {
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
        return (h >>> 0).toString(16);
    }
    function bkSanitizeFilename(name) {
        return String(name || 'untitled').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 90);
    }
    function bkGetConversationIdFromUrl(url) {
        try {
            const u = new URL(url, location.origin);
            const parts = u.pathname.split('/').filter(Boolean);
            return parts[parts.length - 1] || 'root';
        } catch (e) { return 'root'; }
    }
    function bkGetCurrentConversationId() { return bkGetConversationIdFromUrl(location.href); }
    function bkGetCurrentConversationTitle() {
        const t = document.title.replace(/\s*-\s*ChatGPT.*$/i, '').trim();
        return t || `conversation-${bkGetCurrentConversationId().slice(0, 8)}`;
    }
    function bkExtractSidebarConversations() {
        const anchors = Array.from(document.querySelectorAll('a[href*="/c/"], a[href*="/conversation/"]'));
        const out = [];
        const seen = new Set();
        anchors.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;
            const abs = new URL(href, location.origin).href;
            const id = bkGetConversationIdFromUrl(abs);
            if (!id || seen.has(id)) return;
            seen.add(id);
            const title = (a.textContent || '').replace(/\s+/g, ' ').trim() || `conversation-${id.slice(0, 8)}`;
            out.push({ id, title, url: abs, anchor: a });
        });
        return out;
    }

    async function bkGetMessagesForBackup(convo, options = {}) {
        const totalBefore = bkGetTotalMessageCountFromWrappers();
        if (totalBefore) bkLog(`Preparing DOM backup (${totalBefore} wrappers)...`);
        const collected = await bkCollectMessagesByScrolling(options);
        const messages = collected.messages;
        const total = collected.total || bkGetTotalMessageCountFromWrappers() || messages.length;
        if (messages.length < total) bkLog(`Warning: collected ${messages.length}/${total} messages while scrolling.`);
        return { messages, total, source: 'dom', startIndex: collected.startIndex || 0 };
    }

    function bkExtractMessagesFromCurrentPage() {
        const wrappers = bkGetConversationTurnWrappers();
        const msgs = [];
        const seen = new Set();

        wrappers.forEach((wrapper, idx) => {
            const role = bkInferTurnRole(wrapper, idx);
            if (!role) return;
            const txt = bkExtractTurnText(wrapper, role);
            if (!txt) return;
            const key = `${role}|${txt.slice(0, 220)}`;
            if (seen.has(key)) return;
            seen.add(key);
            msgs.push({ role, text: txt });
        });
        return msgs;
    }

    function bkGetConversationTurnWrappers() {
        return Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
    }

    function bkGetTotalMessageCountFromWrappers() {
        return bkGetConversationTurnWrappers().length;
    }

    function bkInferTurnRole(wrapper, idx) {
        const explicitRoleNode = wrapper.querySelector('[data-message-author-role]');
        const explicitRole = (explicitRoleNode?.getAttribute('data-message-author-role') || '').toLowerCase();
        if (explicitRole === 'user' || explicitRole === 'assistant') return explicitRole;
        const tid = wrapper.getAttribute('data-testid') || '';
        const m = tid.match(/conversation-turn-(\d+)/);
        const turnNumber = m ? parseInt(m[1], 10) : (idx + 1);
        if (!Number.isInteger(turnNumber)) return '';
        return turnNumber % 2 === 1 ? 'user' : 'assistant';
    }

    function bkExtractAssistantMarkdown(wrapper) {
        const markdownNodes = Array.from(wrapper.querySelectorAll?.('.markdown') || []);
        const parts = markdownNodes
            .map(node => markdownDomToMarkdown(node))
            .filter(Boolean);
        return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function bkExtractTurnText(wrapper, role) {
        const roleNode = wrapper.querySelector(`[data-message-author-role="${role}"]`);
        if (role === 'assistant') {
            const markdownText = bkExtractAssistantMarkdown(wrapper);
            if (markdownText) return markdownText;
            const wrapperText = bkCleanAssistantWrapperText(wrapper.innerText || wrapper.textContent || '');
            if (wrapperText) return wrapperText;
        }
        const source = roleNode || wrapper;
        return bkCleanExtractedText(source.innerText || source.textContent || '');
    }

    function bkCleanExtractedText(text) {
        return String(text || '')
            .replace(/\r/g, '')
            .replace(/^\s*(已思考|思考|Thought|Thinking)\s*\d+\s*s?\s*[>›]?\s*/im, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function bkCleanAssistantWrapperText(text) {
        const lines = String(text || '').replace(/\r/g, '').split('\n');
        const cleaned = [];

        lines.forEach(line => {
            const t = line.trim();
            if (!t) {
                if (cleaned.length && cleaned[cleaned.length - 1] !== '') cleaned.push('');
                return;
            }
            if (/^(已思考|思考|Thought|Thinking)\s*\d+\s*s?\s*[>›]?$/.test(t)) return;
            if (/^(复制|分享|重新生成|更多|来源|Source|Sources|Copy|Share|Regenerate|More)$/.test(t)) return;
            if (/^OpenAI Help Center(?:\s*\+\d+)?$/.test(t)) return;
            cleaned.push(line);
        });

        return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function bkUserIndexForWrapper(wrapper, wrappers) {
        let userIndex = -1;
        for (let i = 0; i < wrappers.length; i++) {
            if (bkInferTurnRole(wrappers[i], i) === 'user') userIndex += 1;
            if (wrappers[i] === wrapper) return userIndex;
        }
        return -1;
    }

    async function bkWaitForTurnText(index, role, timeoutMs = 4500) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            const wrappers = bkGetConversationTurnWrappers();
            const wrapper = wrappers[index];
            if (wrapper) {
                const text = bkExtractTurnText(wrapper, role);
                if (text) return text;
            }
            await bkSleep(160);
        }
        return '';
    }

    async function bkScrollTurnWrapperIntoView(index, timeoutMs = 3200) {
        const started = Date.now();
        let first = true;

        while (Date.now() - started < timeoutMs) {
            const wrapper = bkGetConversationTurnWrappers()[index];
            if (!(wrapper instanceof Element)) {
                await bkSleep(180);
                continue;
            }

            const scroller = getScrollContainer(wrapper);
            const topOffset = (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) ? 96 : 18;
            const rect = wrapper.getBoundingClientRect();
            const delta = rect.top - getScrollerTop(scroller) - topOffset;
            if (Math.abs(delta) > 4) {
                scrollScrollerTo(scroller, scrollTopOf(scroller) + delta, first ? 'smooth' : 'auto');
            }

            await bkSleep(first ? 420 : 220);
            first = false;

            const fresh = bkGetConversationTurnWrappers()[index];
            if (!(fresh instanceof Element)) continue;
            const freshRect = fresh.getBoundingClientRect();
            const inViewport = freshRect.bottom >= -20 && freshRect.top <= window.innerHeight + 20;
            const settled = Math.abs(freshRect.top - getScrollerTop(getScrollContainer(fresh)) - topOffset) <= 12;
            if (inViewport && settled) return fresh;
        }

        return bkGetConversationTurnWrappers()[index] || null;
    }

    async function bkHydrateVisibleMessages(options = {}) {
        const timeoutPerTurn = options.timeoutPerTurn || 8000;
        const wrappers = bkGetConversationTurnWrappers();
        const total = wrappers.length;
        let hydrated = 0;

        for (let i = 0; i < total; i++) {
            const wrapper = bkGetConversationTurnWrappers()[i];
            if (!(wrapper instanceof Element)) continue;
            const role = bkInferTurnRole(wrapper, i);
            if (!role) continue;
            const existing = bkExtractTurnText(wrapper, role);
            if (existing) continue;

            bkLog(`Loading message ${i + 1}/${total} (${role})...`);
            isAutoScrolling = true;
            await bkScrollTurnWrapperIntoView(i);
            const text = await bkWaitForTurnText(i, role, timeoutPerTurn);
            if (text) hydrated += 1;
            else bkLog(`Still missing message ${i + 1}/${total} (${role}).`);
            await bkSleep(260);
        }

        isAutoScrolling = false;
        scheduleActiveSync();
        refreshVisibleTurnPreviews();
        return { total, hydrated };
    }

    async function bkCollectMessagesByScrolling(options = {}) {
        const timeoutPerTurn = options.timeoutPerTurn || 8000;
        const wrappers = bkGetConversationTurnWrappers();
        const total = wrappers.length;
        const startIndex = bkClamp(Number(options.startIndex) || 0, 0, total);
        const collected = new Array(total);

        if (startIndex > 0) bkLog(`Skipping already backed up messages 1-${startIndex}.`);

        for (let i = startIndex; i < total; i++) {
            const wrapper = bkGetConversationTurnWrappers()[i];
            if (!(wrapper instanceof Element)) continue;
            const role = bkInferTurnRole(wrapper, i);
            if (!role) continue;

            let text = bkExtractTurnText(wrapper, role);
            if (!text) {
                bkLog(`Loading message ${i + 1}/${total} (${role})...`);
                isAutoScrolling = true;
                await bkScrollTurnWrapperIntoView(i);
                text = await bkWaitForTurnText(i, role, timeoutPerTurn);
                await bkSleep(220);
            }

            if (text) {
                collected[i] = { role, text };
                if ((i + 1) % 10 === 0 || i === total - 1) {
                    bkLog(`Collected ${collected.filter(Boolean).length}/${total} messages...`);
                }
            } else {
                bkLog(`Still missing message ${i + 1}/${total} (${role}).`);
            }
        }

        isAutoScrolling = false;
        scheduleActiveSync();
        refreshVisibleTurnPreviews();
        return {
            messages: collected.filter(Boolean),
            total,
            startIndex
        };
    }

    function bkMessagesToMarkdown(messages, startIndex = 1) {
        return messages.map((m, i) => `${m.role === 'user' ? '## User' : '## Assistant'} (${startIndex + i})\n\n${m.text}`).join('\n\n');
    }
    function bkBuildDelta(messages, record) {
        if (!record || !record.lastMessageHash || !record.backedUpMessageCount) return { start: 0, append: messages };
        let start = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (bkHashText(messages[i].role + '\n' + messages[i].text) === record.lastMessageHash) { start = i + 1; break; }
        }
        if (start === -1) start = Math.min(record.backedUpMessageCount, messages.length);
        return { start, append: messages.slice(start) };
    }

    function bkBuildDeltaFromPartial(messages, startIndex) {
        return { start: startIndex, append: messages };
    }
    function bkIdbOpen() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(BK_IDB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(BK_IDB_STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async function bkIdbSet(key, value) {
        const db = await bkIdbOpen();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(BK_IDB_STORE, 'readwrite');
            tx.objectStore(BK_IDB_STORE).put(value, key);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }
    async function bkIdbGet(key) {
        const db = await bkIdbOpen();
        const val = await new Promise((resolve, reject) => {
            const tx = db.transaction(BK_IDB_STORE, 'readonly');
            const req = tx.objectStore(BK_IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        db.close();
        return val;
    }
    async function bkGetBackupDirHandle() { return bkIdbGet(BK_IDB_DIR_KEY); }
    async function bkPickBackupDir() {
        if (typeof window.showDirectoryPicker !== 'function') throw new Error('Current browser does not support folder picker API.');
        const dir = await window.showDirectoryPicker({ id: 'chatgpt-backup-dir', mode: 'readwrite' });
        await bkIdbSet(BK_IDB_DIR_KEY, dir);
        return dir;
    }
    async function bkEnsureDirPermission(dirHandle, write) {
        const opts = write ? { mode: 'readwrite' } : {};
        if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
        return (await dirHandle.requestPermission(opts)) === 'granted';
    }
    async function bkFileExists(dirHandle, fileName) {
        try { await dirHandle.getFileHandle(fileName, { create: false }); return true; } catch (e) { return false; }
    }
    function bkLog(msg) {
        if (!bkState.ui?.log) return;
        const now = new Date().toLocaleTimeString();
        bkState.ui.log.textContent = `[${now}] ${msg}\n` + bkState.ui.log.textContent;
    }
    async function bkWriteConversationDelta(dirHandle, convo, messages, options = {}) {
        const forceFull = !!options.forceFull;
        const partialStartIndex = Number.isInteger(options.partialStartIndex) ? options.partialStartIndex : null;
        const record = bkState.manifest.conversations[convo.id] || null;
        const safeTitle = bkSanitizeFilename(convo.title);
        const fileName = `${safeTitle}__${convo.id.slice(0, 12)}.md`;
        const exists = await bkFileExists(dirHandle, fileName);
        let delta = partialStartIndex !== null && !forceFull && exists
            ? bkBuildDeltaFromPartial(messages, partialStartIndex)
            : (forceFull || !exists ? { start: 0, append: messages } : bkBuildDelta(messages, record));
        if (!delta.append.length) return { appendedCount: 0 };

        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const existingText = await (await fileHandle.getFile()).text();
        const section = ['','', bkMessagesToMarkdown(delta.append, delta.start + 1)].join('\n');
        const nextText = (forceFull || !existingText)
            ? `# ${convo.title}\n\nConversation ID: ${convo.id}\n\n${bkMessagesToMarkdown(messages, 1)}`
            : existingText + section;
        const writable = await fileHandle.createWritable();
        await writable.write(nextText);
        await writable.close();

        const last = messages[messages.length - 1];
        bkState.manifest.conversations[convo.id] = {
            id: convo.id,
            title: convo.title,
            fileName,
            backedUpMessageCount: forceFull || !existingText ? messages.length : Math.max(record?.backedUpMessageCount || 0, delta.start + delta.append.length),
            lastTurnNumber: forceFull || !existingText ? messages.length : Math.max(record?.lastTurnNumber || 0, delta.start + delta.append.length),
            lastMessageHash: last ? bkHashText(last.role + '\n' + last.text) : '',
            updatedAt: Date.now()
        };
        bkSaveManifest();
        return { appendedCount: delta.append.length };
    }
    async function bkWaitForConversationReady(timeoutMs = 25000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const msgs = bkExtractMessagesFromCurrentPage();
            if (msgs.length >= 1) return msgs;
            await bkSleep(450);
        }
        throw new Error('Timeout waiting conversation content.');
    }
    async function bkGotoConversation(convo) {
        if (bkGetConversationIdFromUrl(location.href) === convo.id) return;
        const before = location.href;
        if (convo.anchor && document.contains(convo.anchor)) convo.anchor.click();
        else location.assign(convo.url);
        const start = Date.now();
        while (Date.now() - start < 12000) {
            if (location.href !== before) break;
            await bkSleep(120);
        }
        await bkWaitForConversationReady();
        await bkSleep(220);
    }
    async function bkBackupCurrent(dir, options = {}) {
        const convo = { id: bkGetCurrentConversationId(), title: bkGetCurrentConversationTitle(), url: location.href };
        const record = bkState.manifest.conversations[convo.id] || null;
        const total = bkGetTotalMessageCountFromWrappers();
        const startIndex = options.forceFull ? 0 : bkClamp(record?.backedUpMessageCount || 0, 0, total);
        const result = await bkGetMessagesForBackup(convo, { timeoutPerTurn: 8000, startIndex });
        const messages = result.messages;
        if (!messages.length && startIndex >= total) {
            bkLog('No new messages to back up.');
            return { appendedCount: 0, messageCount: record?.backedUpMessageCount || 0, totalMessageCount: total, source: 'dom' };
        }
        if (!messages.length) throw new Error('Cannot parse messages on current page.');
        const res = await bkWriteConversationDelta(dir, convo, messages, { ...options, partialStartIndex: result.startIndex });
        return { ...res, messageCount: messages.length, totalMessageCount: result.total, source: result.source };
    }
    async function bkBackupAll(dir, options = {}) {
        const list = bkExtractSidebarConversations();
        if (!list.length) throw new Error('Cannot find conversation list in sidebar.');
        const originId = bkGetConversationIdFromUrl(location.href);
        const originConvo = list.find(x => x.id === originId) || { id: originId, url: location.href, anchor: null };
        let totalVisited = 0;
        let totalAppended = 0;
        for (const convo of list) {
            bkLog(`Backing up: ${convo.title}`);
            await bkGotoConversation(convo);
            const record = bkState.manifest.conversations[convo.id] || null;
            const total = bkGetTotalMessageCountFromWrappers();
            const startIndex = options.forceFull ? 0 : bkClamp(record?.backedUpMessageCount || 0, 0, total);
            const result = await bkGetMessagesForBackup(convo, { timeoutPerTurn: 6500, startIndex });
            const r = await bkWriteConversationDelta(dir, convo, result.messages, { ...options, partialStartIndex: result.startIndex });
            totalVisited += 1;
            totalAppended += r.appendedCount;
            await bkSleep(200);
        }
        bkLog('Returning to original conversation...');
        await bkGotoConversation(originConvo);
        return { totalVisited, totalAppended, totalFound: list.length };
    }
    function bkRenderStatus() {
        if (!bkState.ui) return;
        const id = bkGetCurrentConversationId();
        const title = bkGetCurrentConversationTitle();
        const rec = bkState.manifest.conversations[id];
        const msgs = bkExtractMessagesFromCurrentPage();
        const total = bkGetTotalMessageCountFromWrappers() || msgs.length;
        const parsed = msgs.length;
        const backed = rec?.backedUpMessageCount || 0;
        const pending = Math.max(0, total - backed);
        bkState.ui.currentInfo.textContent = `${title}\nTotal messages: ${total}\nBackup-ready messages: ${parsed}\nBacked up: ${backed}\nPending: ${pending}`;
        const convs = bkExtractSidebarConversations();
        const backedConvs = convs.filter(c => bkState.manifest.conversations[c.id]).length;
        bkState.ui.allInfo.textContent = `Sidebar conversations: ${convs.length}\nBacked up at least once: ${backedConvs}\nNot backed up yet: ${Math.max(0, convs.length - backedConvs)}`;
    }
    async function bkUpdatePathInfo() {
        const dir = await bkGetBackupDirHandle();
        if (!bkState.ui) return;
        bkState.ui.pathInfo.textContent = dir ? `Folder: ${dir.name || '(authorized folder)'}` : 'Folder: not configured';
    }
    function bkSetBusy(busy) {
        bkState.running = busy;
        if (!bkState.ui) return;
        bkState.ui.backupCurrentBtn.disabled = busy;
        bkState.ui.backupAllBtn.disabled = busy;
        bkState.ui.refreshBtn.disabled = busy;
        bkState.ui.pathBtn.disabled = busy;
    }
    function bkLoadFabPos() {
        try {
            const raw = localStorage.getItem(BK_FAB_POS_KEY);
            const data = raw ? JSON.parse(raw) : null;
            if (!data || typeof data.left !== 'number' || typeof data.top !== 'number') return null;
            return data;
        } catch (e) { return null; }
    }
    function bkSaveFabPos(left, top) {
        localStorage.setItem(BK_FAB_POS_KEY, JSON.stringify({ left, top }));
    }
    function initBackupManager() {
        const fab = document.createElement('div');
        fab.id = 'chatgpt-bk-fab';
        fab.title = 'Backup Manager';
        fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        document.body.appendChild(fab);

        const panel = document.createElement('div');
        panel.id = 'chatgpt-bk-panel';
        panel.innerHTML = `
            <div id="chatgpt-bk-head">
                <div id="chatgpt-bk-title">Backup Manager</div>
                <div class="chatgpt-bk-row">
                    <button id="chatgpt-bk-refresh" class="chatgpt-bk-btn" type="button">Refresh</button>
                    <button id="chatgpt-bk-close" class="chatgpt-bk-btn" type="button">Close</button>
                </div>
            </div>
            <div id="chatgpt-bk-body">
                <div class="chatgpt-bk-card">
                    <div class="chatgpt-bk-row">
                        <button id="chatgpt-bk-set-path" class="chatgpt-bk-btn" type="button">Set Backup Folder</button>
                        <button id="chatgpt-bk-backup-current" class="chatgpt-bk-btn primary" type="button">Backup Current</button>
                        <button id="chatgpt-bk-backup-all" class="chatgpt-bk-btn primary" type="button">Backup All</button>
                    </div>
                    <div style="margin-top:8px;">
                        <label class="chatgpt-bk-muted" style="display:flex;align-items:center;gap:6px;">
                            <input id="chatgpt-bk-force-full" type="checkbox">
                            Force full re-backup
                        </label>
                    </div>
                    <div id="chatgpt-bk-path" class="chatgpt-bk-muted" style="margin-top:8px;">Folder: not configured</div>
                </div>
                <div class="chatgpt-bk-card"><div id="chatgpt-bk-current" class="chatgpt-bk-line"></div></div>
                <div class="chatgpt-bk-card"><div id="chatgpt-bk-all" class="chatgpt-bk-line"></div></div>
                <div class="chatgpt-bk-card"><div class="chatgpt-bk-muted">Runtime log</div><div id="chatgpt-bk-log"></div></div>
            </div>
        `;
        document.body.appendChild(panel);

        bkState.ui = {
            fab,
            panel,
            refreshBtn: panel.querySelector('#chatgpt-bk-refresh'),
            closeBtn: panel.querySelector('#chatgpt-bk-close'),
            pathBtn: panel.querySelector('#chatgpt-bk-set-path'),
            backupCurrentBtn: panel.querySelector('#chatgpt-bk-backup-current'),
            backupAllBtn: panel.querySelector('#chatgpt-bk-backup-all'),
            forceFullCheckbox: panel.querySelector('#chatgpt-bk-force-full'),
            pathInfo: panel.querySelector('#chatgpt-bk-path'),
            currentInfo: panel.querySelector('#chatgpt-bk-current'),
            allInfo: panel.querySelector('#chatgpt-bk-all'),
            log: panel.querySelector('#chatgpt-bk-log')
        };

        const saved = bkLoadFabPos();
        if (saved) {
            const maxLeft = window.innerWidth - fab.offsetWidth - 8;
            const maxTop = window.innerHeight - fab.offsetHeight - 8;
            fab.style.left = `${bkClamp(saved.left, 8, Math.max(8, maxLeft))}px`;
            fab.style.top = `${bkClamp(saved.top, 8, Math.max(8, maxTop))}px`;
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
        }

        let dragging = false, moved = false, sx = 0, sy = 0, bl = 0, bt = 0;
        fab.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
            const rect = fab.getBoundingClientRect(); bl = rect.left; bt = rect.top;
            fab.setPointerCapture(e.pointerId);
        });
        fab.addEventListener('pointermove', e => {
            if (!dragging) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (!moved && (Math.abs(dx) >= 4 || Math.abs(dy) >= 4)) moved = true;
            if (!moved) return;
            const maxLeft = window.innerWidth - fab.offsetWidth - 8;
            const maxTop = window.innerHeight - fab.offsetHeight - 8;
            fab.style.left = `${bkClamp(bl + dx, 8, Math.max(8, maxLeft))}px`;
            fab.style.top = `${bkClamp(bt + dy, 8, Math.max(8, maxTop))}px`;
            fab.style.right = 'auto'; fab.style.bottom = 'auto';
        });
        const stopDrag = e => {
            if (!dragging) return;
            dragging = false;
            try { fab.releasePointerCapture(e.pointerId); } catch (err) {}
            if (moved) {
                const rect = fab.getBoundingClientRect();
                bkSaveFabPos(rect.left, rect.top);
            }
        };
        fab.addEventListener('pointerup', stopDrag);
        fab.addEventListener('pointercancel', stopDrag);

        fab.addEventListener('click', async e => {
            if (moved) { e.preventDefault(); e.stopPropagation(); return; }
            panel.classList.toggle('visible');
            if (panel.classList.contains('visible')) {
                await bkUpdatePathInfo();
                bkRenderStatus();
            }
        });
        bkState.ui.closeBtn.addEventListener('click', () => panel.classList.remove('visible'));
        bkState.ui.refreshBtn.addEventListener('click', () => bkRenderStatus());
        bkState.ui.pathBtn.addEventListener('click', async () => {
            try {
                const dir = await bkPickBackupDir();
                const ok = await bkEnsureDirPermission(dir, true);
                if (!ok) throw new Error('Folder permission denied.');
                bkLog('Backup folder configured.');
                await bkUpdatePathInfo();
            } catch (err) { bkLog(`Set folder failed: ${err.message}`); }
        });
        bkState.ui.backupCurrentBtn.addEventListener('click', async () => {
            if (bkState.running) return;
            bkSetBusy(true);
            try {
                const dir = await bkGetBackupDirHandle();
                if (!dir) throw new Error('Please set backup folder first.');
                if (!(await bkEnsureDirPermission(dir, true))) throw new Error('Folder permission denied.');
                const forceFull = !!bkState.ui.forceFullCheckbox?.checked;
                const r = await bkBackupCurrent(dir, { forceFull });
                bkLog(`Current backed up: +${r.appendedCount} messages (${r.source}, parsed ${r.messageCount}/${r.totalMessageCount || r.messageCount}).`);
                bkRenderStatus();
            } catch (err) { bkLog(`Backup current failed: ${err.message}`); }
            finally { bkSetBusy(false); }
        });
        bkState.ui.backupAllBtn.addEventListener('click', async () => {
            if (bkState.running) return;
            bkSetBusy(true);
            try {
                const dir = await bkGetBackupDirHandle();
                if (!dir) throw new Error('Please set backup folder first.');
                if (!(await bkEnsureDirPermission(dir, true))) throw new Error('Folder permission denied.');
                const forceFull = !!bkState.ui.forceFullCheckbox?.checked;
                const r = await bkBackupAll(dir, { forceFull });
                bkLog(`All backup done. visited=${r.totalVisited}, appended=${r.totalAppended}, found=${r.totalFound}`);
                bkRenderStatus();
            } catch (err) { bkLog(`Backup all failed: ${err.message}`); }
            finally { bkSetBusy(false); }
        });
    }

    let debounceTimer;
    container.addEventListener('mouseenter', () => { isTimelineHovering = true; });
    container.addEventListener('mouseleave', () => { isTimelineHovering = false; });
    const domObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            ensureMounted();
            updateTimeline();
        }, isTimelineHovering ? 1200 : 600);
    });
    domObserver.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('scroll', handleAnyScroll, { passive: true, capture: true });
    window.addEventListener('resize', scheduleActiveSync, { passive: true });
    initPromptManager();
    initBackupManager();
    updateTimeline();
})();
