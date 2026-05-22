// ==UserScript==
// @name         ChatGPT Project Source Text Preview
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  Preview ChatGPT project source Markdown/text files in-page instead of downloading them.
// @author       duro
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const ROOT_ID = 'cgpt-source-preview-root';
    const STYLE_ID = 'cgpt-source-preview-style';
    const TEXT_FILE_RE = /\.(?:md|txt)(?:$|[?#])/i;
    const ESTUARY_CONTENT_RE = /\/backend-api\/estuary\/content\b/i;
    const SOURCE_CLICK_MAX_AGE_MS = 2000;

    let activeController = null;
    let lastTextSourceClick = null;

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${ROOT_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.45);
            }
            #${ROOT_ID}.visible { display: flex; }
            #${ROOT_ID} .cgpt-sp-panel {
                width: min(960px, calc(100vw - 40px));
                height: min(760px, calc(100vh - 40px));
                display: grid;
                grid-template-rows: auto 1fr;
                overflow: hidden;
                border: 1px solid rgba(148, 163, 184, 0.35);
                border-radius: 10px;
                background: #202123;
                color: #ececf1;
                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
            }
            #${ROOT_ID} .cgpt-sp-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 12px;
                border-bottom: 1px solid rgba(148, 163, 184, 0.25);
            }
            #${ROOT_ID} .cgpt-sp-title {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 13px;
                font-weight: 600;
            }
            #${ROOT_ID} .cgpt-sp-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            #${ROOT_ID} .cgpt-sp-btn {
                border: 1px solid rgba(148, 163, 184, 0.35);
                border-radius: 7px;
                background: rgba(255, 255, 255, 0.06);
                color: #ececf1;
                cursor: pointer;
                font-size: 12px;
                padding: 6px 9px;
            }
            #${ROOT_ID} .cgpt-sp-btn:hover {
                border-color: rgba(96, 165, 250, 0.8);
            }
            #${ROOT_ID} .cgpt-sp-body {
                overflow: auto;
                padding: 22px 28px;
                line-height: 1.65;
                font-size: 14px;
            }
            #${ROOT_ID} .cgpt-sp-body h1,
            #${ROOT_ID} .cgpt-sp-body h2,
            #${ROOT_ID} .cgpt-sp-body h3 {
                margin: 1.2em 0 0.55em;
                line-height: 1.25;
            }
            #${ROOT_ID} .cgpt-sp-body h1 { font-size: 24px; }
            #${ROOT_ID} .cgpt-sp-body h2 { font-size: 20px; }
            #${ROOT_ID} .cgpt-sp-body h3 { font-size: 17px; }
            #${ROOT_ID} .cgpt-sp-body p { margin: 0.7em 0; }
            #${ROOT_ID} .cgpt-sp-body pre {
                overflow: auto;
                padding: 12px;
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.28);
            }
            #${ROOT_ID} .cgpt-sp-body code {
                font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
                font-size: 0.92em;
            }
            #${ROOT_ID} .cgpt-sp-body blockquote {
                margin: 0.8em 0;
                padding-left: 12px;
                border-left: 3px solid rgba(148, 163, 184, 0.55);
                color: #cbd5e1;
            }
            #${ROOT_ID} .cgpt-sp-error {
                color: #fca5a5;
                white-space: pre-wrap;
            }
        `;
        document.head.appendChild(style);
    }

    function getRoot() {
        injectStyle();
        let root = document.getElementById(ROOT_ID);
        if (root) return root;

        root = document.createElement('div');
        root.id = ROOT_ID;
        root.innerHTML = `
            <div class="cgpt-sp-panel" role="dialog" aria-modal="true">
                <div class="cgpt-sp-head">
                    <div class="cgpt-sp-title"></div>
                    <div class="cgpt-sp-actions">
                        <button class="cgpt-sp-btn cgpt-sp-copy" type="button">Copy</button>
                        <button class="cgpt-sp-btn cgpt-sp-toggle" type="button">Raw</button>
                        <button class="cgpt-sp-btn cgpt-sp-close" type="button">Close</button>
                    </div>
                </div>
                <div class="cgpt-sp-body"></div>
            </div>
        `;
        root.addEventListener('click', (event) => {
            if (event.target === root) hidePreview();
        });
        root.querySelector('.cgpt-sp-close').addEventListener('click', hidePreview);
        root.querySelector('.cgpt-sp-copy').addEventListener('click', async () => {
            const raw = root.dataset.raw || '';
            if (raw) await navigator.clipboard.writeText(raw);
        });
        root.querySelector('.cgpt-sp-toggle').addEventListener('click', () => {
            const body = root.querySelector('.cgpt-sp-body');
            const button = root.querySelector('.cgpt-sp-toggle');
            if (root.dataset.mode === 'raw') {
                body.innerHTML = root.dataset.rendered || renderMarkdown(root.dataset.raw || '');
                root.dataset.mode = 'preview';
                button.textContent = 'Raw';
                return;
            }
            body.innerHTML = `<pre><code>${escapeHTML(root.dataset.raw || '')}</code></pre>`;
            root.dataset.mode = 'raw';
            button.textContent = 'Preview';
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') hidePreview();
        });
        document.body.appendChild(root);
        return root;
    }

    function showPreview(title, html, raw) {
        const root = getRoot();
        root.querySelector('.cgpt-sp-title').textContent = title || 'Text Preview';
        root.querySelector('.cgpt-sp-body').innerHTML = html;
        root.dataset.raw = raw || '';
        root.dataset.rendered = html || '';
        root.dataset.mode = 'preview';
        root.querySelector('.cgpt-sp-toggle').textContent = 'Raw';
        root.classList.add('visible');
    }

    function showLoading(title) {
        showPreview(title, '<p>Loading preview...</p>', '');
    }

    function showError(title, message) {
        showPreview(title, `<div class="cgpt-sp-error">${escapeHTML(message)}</div>`, '');
    }

    function hidePreview() {
        if (activeController) activeController.abort();
        activeController = null;
        const root = document.getElementById(ROOT_ID);
        if (root) root.classList.remove('visible');
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

    function renderMarkdown(md) {
        const blocks = [];
        const lines = String(md || '').replace(/\r/g, '').split('\n');
        let paragraph = [];
        let code = [];
        let inCode = false;

        function flushParagraph() {
            if (!paragraph.length) return;
            blocks.push(`<p>${inlineMarkdown(escapeHTML(paragraph.join(' ')))}</p>`);
            paragraph = [];
        }

        function flushCode() {
            blocks.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`);
            code = [];
        }

        lines.forEach(line => {
            if (/^```/.test(line.trim())) {
                if (inCode) {
                    flushCode();
                    inCode = false;
                } else {
                    flushParagraph();
                    inCode = true;
                }
                return;
            }
            if (inCode) {
                code.push(line);
                return;
            }
            if (!line.trim()) {
                flushParagraph();
                return;
            }
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                flushParagraph();
                const level = heading[1].length;
                blocks.push(`<h${level}>${inlineMarkdown(escapeHTML(heading[2].trim()))}</h${level}>`);
                return;
            }
            const quote = line.match(/^>\s?(.*)$/);
            if (quote) {
                flushParagraph();
                blocks.push(`<blockquote>${inlineMarkdown(escapeHTML(quote[1]))}</blockquote>`);
                return;
            }
            const list = line.match(/^\s*[-*+]\s+(.+)$/);
            if (list) {
                flushParagraph();
                blocks.push(`<p>&bull; ${inlineMarkdown(escapeHTML(list[1]))}</p>`);
                return;
            }
            paragraph.push(line.trim());
        });

        if (inCode) flushCode();
        flushParagraph();
        return blocks.join('\n') || '<p>(Empty Markdown file)</p>';
    }

    function inlineMarkdown(html) {
        return html
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    function looksLikeTextSourceTarget(target) {
        const text = (target?.textContent || '').trim();
        if (TEXT_FILE_RE.test(text)) return true;
        const aria = target?.getAttribute?.('aria-label') || target?.getAttribute?.('title') || '';
        return TEXT_FILE_RE.test(aria);
    }

    function getFirstTextSourceLabel(text) {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        const match = normalized.match(/[^\/\\\s"'<>|:;]+\.(?:md|txt)\b/i);
        return match ? match[0] : '';
    }

    function getNearbyTextSourceLabel(event) {
        if (typeof document.elementsFromPoint !== 'function') return '';
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        for (const element of elements) {
            if (!(element instanceof Element)) continue;
            let node = element;
            for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
                const label = getFirstTextSourceLabel(`${node.textContent || ''} ${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''}`);
                if (label) return label;
            }
        }

        const candidates = Array.from(document.querySelectorAll('[aria-label], [title], button, a, div, span'))
            .map(element => {
                const rect = element.getBoundingClientRect();
                return {
                    element,
                    rect,
                    label: getFirstTextSourceLabel(`${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`)
                };
            })
            .filter(item => item.label && item.rect.width > 0 && item.rect.height > 0)
            .filter(item => Math.abs((item.rect.top + item.rect.bottom) / 2 - event.clientY) < 48)
            .sort((a, b) => Math.abs((a.rect.top + a.rect.bottom) / 2 - event.clientY) - Math.abs((b.rect.top + b.rect.bottom) / 2 - event.clientY));
        return candidates[0]?.label || '';
    }

    function rememberTextSourceClick(event) {
        if (!(event.target instanceof Element)) return;
        const info = findTextSourceClickTarget(event);
        const url = info ? getFileUrl(info) : '';
        const label = info ? getFileName(info, url) : getNearbyTextSourceLabel(event);
        if (!label || !TEXT_FILE_RE.test(label)) return;
        lastTextSourceClick = {
            at: Date.now(),
            label,
            info
        };
    }

    function consumeRecentTextSourceClick() {
        const recent = lastTextSourceClick;
        if (!recent || Date.now() - recent.at > SOURCE_CLICK_MAX_AGE_MS) return null;
        lastTextSourceClick = null;
        return recent;
    }

    function findTextSourceClickTarget(event) {
        const path = event.composedPath ? event.composedPath() : [];
        for (const node of path) {
            if (!(node instanceof Element)) continue;
            const href = node.getAttribute('href') || node.closest?.('a[href]')?.getAttribute('href') || '';
            const download = node.getAttribute('download') || node.closest?.('[download]')?.getAttribute('download') || '';
            const label = `${href} ${download} ${node.textContent || ''} ${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''}`;
            if (TEXT_FILE_RE.test(label)) {
                return {
                    element: node,
                    link: node.closest?.('a[href]') || (node.matches?.('a[href]') ? node : null)
                };
            }
        }
        const el = event.target instanceof Element ? event.target : null;
        if (el && looksLikeTextSourceTarget(el)) return { element: el, link: el.closest('a[href]') };
        return null;
    }

    function getFileUrl(info) {
        const link = info?.link;
        if (link?.href) return link.href;
        const el = info?.element;
        const nestedLink = el?.querySelector?.('a[href]');
        if (nestedLink?.href) return nestedLink.href;
        return '';
    }

    function getFileName(info, url) {
        const label = (info?.element?.textContent || '').trim().split('\n').map(x => x.trim()).find(x => TEXT_FILE_RE.test(x));
        if (label) return label;
        try {
            const path = new URL(url, location.href).pathname.split('/').pop();
            return decodeURIComponent(path || 'source.txt');
        } catch {
            return 'source.txt';
        }
    }

    function isEstuaryContentUrl(url) {
        try {
            return ESTUARY_CONTENT_RE.test(new URL(url, location.href).pathname);
        } catch {
            return ESTUARY_CONTENT_RE.test(String(url || ''));
        }
    }

    async function previewTextSourceUrl(url, title) {
        if (!url) {
            showError(title, 'No file URL was found for this text source item.');
            return;
        }

        showLoading(title);
        activeController = new AbortController();
        try {
            const res = await fetch(url, {
                credentials: 'include',
                signal: activeController.signal,
                headers: { accept: 'text/markdown,text/plain,*/*' }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            const text = await res.text();
            showPreview(title, renderMarkdown(text), text);
        } catch (err) {
            if (err.name === 'AbortError') return;
            showError(title, `Cannot preview this file.\n\n${err.message}`);
        } finally {
            activeController = null;
        }
    }

    async function previewTextSource(info) {
        const url = getFileUrl(info);
        const title = getFileName(info, url);
        await previewTextSourceUrl(url, title);
    }

    document.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        rememberTextSourceClick(event);
        const info = findTextSourceClickTarget(event);
        if (!info) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        previewTextSource(info);
    }, true);

    ['pointerdown', 'mousedown'].forEach(type => {
        document.addEventListener(type, (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            rememberTextSourceClick(event);
        }, true);
    });

    const originalOpen = window.open;
    window.open = function patchedWindowOpen(url, target, features) {
        if (isEstuaryContentUrl(url)) {
            const recent = consumeRecentTextSourceClick();
            if (recent) {
                previewTextSourceUrl(new URL(url, location.href).href, recent.label || 'source.txt');
                return null;
            }
        }
        return originalOpen.apply(this, arguments);
    };
})();
