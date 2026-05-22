// ==UserScript==
// @name         ChatGPT Project Source Markdown Preview
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Preview ChatGPT project source Markdown files in-page instead of downloading them.
// @author       You
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const ROOT_ID = 'cgpt-source-preview-root';
    const STYLE_ID = 'cgpt-source-preview-style';
    const MD_FILE_RE = /\.md(?:$|[?#])/i;

    let activeController = null;

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
                        <button class="cgpt-sp-btn cgpt-sp-raw" type="button">Raw</button>
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
        root.querySelector('.cgpt-sp-raw').addEventListener('click', () => {
            const body = root.querySelector('.cgpt-sp-body');
            body.innerHTML = `<pre><code>${escapeHTML(root.dataset.raw || '')}</code></pre>`;
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') hidePreview();
        });
        document.body.appendChild(root);
        return root;
    }

    function showPreview(title, html, raw) {
        const root = getRoot();
        root.querySelector('.cgpt-sp-title').textContent = title || 'Markdown Preview';
        root.querySelector('.cgpt-sp-body').innerHTML = html;
        root.dataset.raw = raw || '';
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

    function looksLikeMarkdownTarget(target) {
        const text = (target?.textContent || '').trim();
        if (MD_FILE_RE.test(text)) return true;
        const aria = target?.getAttribute?.('aria-label') || target?.getAttribute?.('title') || '';
        return MD_FILE_RE.test(aria);
    }

    function findMarkdownClickTarget(event) {
        const path = event.composedPath ? event.composedPath() : [];
        for (const node of path) {
            if (!(node instanceof Element)) continue;
            const href = node.getAttribute('href') || node.closest?.('a[href]')?.getAttribute('href') || '';
            const download = node.getAttribute('download') || node.closest?.('[download]')?.getAttribute('download') || '';
            const label = `${href} ${download} ${node.textContent || ''} ${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''}`;
            if (MD_FILE_RE.test(label)) {
                return {
                    element: node,
                    link: node.closest?.('a[href]') || (node.matches?.('a[href]') ? node : null)
                };
            }
        }
        const el = event.target instanceof Element ? event.target : null;
        if (el && looksLikeMarkdownTarget(el)) return { element: el, link: el.closest('a[href]') };
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
        const label = (info?.element?.textContent || '').trim().split('\n').map(x => x.trim()).find(x => MD_FILE_RE.test(x));
        if (label) return label;
        try {
            const path = new URL(url, location.href).pathname.split('/').pop();
            return decodeURIComponent(path || 'source.md');
        } catch {
            return 'source.md';
        }
    }

    async function previewMarkdown(info) {
        const url = getFileUrl(info);
        const title = getFileName(info, url);
        if (!url) {
            showError(title, 'No file URL was found for this Markdown source item.');
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

    document.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const info = findMarkdownClickTarget(event);
        if (!info) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        previewMarkdown(info);
    }, true);
})();
