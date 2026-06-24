// ==UserScript==
// @name         ChatGPT Project Source Text Preview
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  Preview ChatGPT project source Markdown/text files in-page instead of downloading them.
// @author       duro
// @match        https://chatgpt.com/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/marked@16.2.1/lib/marked.umd.js
// @require      https://cdn.jsdelivr.net/npm/dompurify@3.3.3/dist/purify.min.js
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
    const NATIVE_DOWNLOAD_BYPASS_MS = 1500;

    let activeController = null;
    let lastTextSourceClick = null;
    let nativeDownloadBypassUntil = 0;

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
            #${ROOT_ID} .cgpt-sp-body ul,
            #${ROOT_ID} .cgpt-sp-body ol {
                margin: 0.75em 0 0.75em 1.35em;
                padding-left: 1.1em;
                list-style-position: outside !important;
            }
            #${ROOT_ID} .cgpt-sp-body ul { list-style-type: disc !important; }
            #${ROOT_ID} .cgpt-sp-body ol { list-style-type: decimal !important; }
            #${ROOT_ID} .cgpt-sp-body li {
                margin: 0.35em 0;
                display: list-item !important;
            }
            #${ROOT_ID} .cgpt-sp-body li::marker {
                color: #cbd5e1 !important;
                font-weight: 600;
            }
            #${ROOT_ID} .cgpt-sp-body li > p {
                margin: 0.35em 0;
            }
            #${ROOT_ID} .cgpt-sp-body table {
                width: max-content;
                max-width: 100%;
                margin: 1em 0;
                border-collapse: collapse;
                overflow: auto;
                display: block;
            }
            #${ROOT_ID} .cgpt-sp-body th,
            #${ROOT_ID} .cgpt-sp-body td {
                border: 1px solid rgba(148, 163, 184, 0.35);
                padding: 7px 10px;
                vertical-align: top;
            }
            #${ROOT_ID} .cgpt-sp-body th {
                background: rgba(255, 255, 255, 0.08);
                font-weight: 700;
            }
            #${ROOT_ID} .cgpt-sp-body hr {
                border: 0;
                border-top: 1px solid rgba(148, 163, 184, 0.35);
                margin: 1.4em 0;
            }
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
            #${ROOT_ID} .cgpt-sp-body a {
                color: #93c5fd;
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
        const source = String(md || '');
        const markedParser = globalThis.marked;
        const purifier = globalThis.DOMPurify;
        if (typeof markedParser?.parse === 'function' && typeof purifier?.sanitize === 'function') {
            try {
                const dirty = markedParser.parse(source, { gfm: true, breaks: false });
                return purifier.sanitize(dirty, { USE_PROFILES: { html: true } });
            } catch (err) {
                console.warn('[source-preview] marked render failed, using fallback renderer:', err);
            }
        }
        return renderMarkdownFallback(source);
    }

    function renderMarkdownFallback(md) {
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

    function getSmallElementText(element) {
        if (!(element instanceof Element)) return '';
        const tag = element.tagName;
        if (tag === 'HTML' || tag === 'BODY' || tag === 'MAIN') return '';
        const text = element.textContent || '';
        return text.length > 1200 ? '' : text;
    }

    function getElementLabel(element) {
        if (!(element instanceof Element)) return '';
        return `${getSmallElementText(element)} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.getAttribute('data-testid') || ''}`;
    }

    function isExplicitDownloadClick(event) {
        const path = event.composedPath ? event.composedPath() : [];
        return path.some(node => {
            if (!(node instanceof Element)) return false;
            if (node.matches?.('a[download], [download]')) return true;
            const label = getElementLabel(node).replace(/\s+/g, ' ').trim();
            const role = node.getAttribute('role') || '';
            return /\bdownload\b|下载/i.test(label)
                && /^(A|BUTTON|DIV|SPAN)$/.test(node.tagName)
                && (!role || /^(button|menuitem|option|link)$/.test(role));
        });
    }

    function bypassPreviewForNativeDownload() {
        lastTextSourceClick = null;
        nativeDownloadBypassUntil = Date.now() + NATIVE_DOWNLOAD_BYPASS_MS;
    }

    function getNearbyTextSourceLabel(event) {
        if (typeof document.elementsFromPoint !== 'function') return '';
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        for (const element of elements) {
            if (!(element instanceof Element)) continue;
            let node = element;
            for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
                const label = getFirstTextSourceLabel(getElementLabel(node));
                if (label) return label;
            }
        }
        return '';
    }

    function getPotentialChatFileLabel(event) {
        const path = event.composedPath ? event.composedPath() : [];
        for (const node of path) {
            if (!(node instanceof Element)) continue;
            const text = getSmallElementText(node).replace(/\s+/g, ' ').trim();
            if (!text || text.length > 220) continue;
            if (TEXT_FILE_RE.test(text)) return getFirstTextSourceLabel(text) || text;

            const looksTruncated = /(?:\.\.\.|…)$/.test(text);
            const looksFileLike = /[A-Za-z0-9][A-Za-z0-9_.-]{8,}/.test(text) && !/[。！？?!]/.test(text);
            const hasFileIcon = !!node.querySelector?.('svg');
            if ((looksTruncated || looksFileLike) && hasFileIcon) return text;
        }
        return '';
    }

    function rememberTextSourceClick(event) {
        if (!(event.target instanceof Element)) return;
        const info = findTextSourceClickTarget(event);
        const url = info ? getFileUrl(info) : '';
        const label = info ? getFileName(info, url) : (getNearbyTextSourceLabel(event) || getPotentialChatFileLabel(event));
        if (!label) return;
        const isExplicitTextFile = TEXT_FILE_RE.test(label);
        const isPotentialChatFile = !isExplicitTextFile && !!getPotentialChatFileLabel(event);
        if (!isExplicitTextFile && !isPotentialChatFile) return;
        lastTextSourceClick = {
            at: Date.now(),
            label,
            info,
            explicit: isExplicitTextFile
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
            const label = `${href} ${download} ${getElementLabel(node)}`;
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

    function getEstuaryContentClickUrl(event) {
        if (Date.now() < nativeDownloadBypassUntil) return '';
        const path = event.composedPath ? event.composedPath() : [];
        for (const node of path) {
            if (!(node instanceof Element)) continue;
            const link = node.matches?.('a[href]') ? node : node.closest?.('a[href]');
            if (link?.href && isEstuaryContentUrl(link.href)) return link.href;
        }
        return '';
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

    function getHeaderFileName(res) {
        const header = res?.headers?.get?.('content-disposition') || '';
        const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8) {
            try { return decodeURIComponent(utf8[1].replace(/["']/g, '')); } catch { return utf8[1]; }
        }
        const plain = header.match(/filename="?([^";]+)"?/i);
        return plain ? plain[1] : '';
    }

    function isTextLikeResponse(res, title) {
        if (TEXT_FILE_RE.test(title || '')) return true;
        const type = (res?.headers?.get?.('content-type') || '').toLowerCase();
        return /^text\//.test(type) || /(?:markdown|json|xml|javascript|typescript)/.test(type);
    }

    function looksProbablyText(text) {
        const sample = String(text || '').slice(0, 4096);
        if (!sample) return true;
        if (sample.includes('\u0000') || sample.includes('\ufffd')) return false;
        const controlChars = sample.match(/[\x00-\x08\x0E-\x1F]/g);
        return !controlChars || controlChars.length / sample.length < 0.01;
    }

    function triggerNativeDownload(url) {
        bypassPreviewForNativeDownload();
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    async function previewTextSourceUrl(url, title, options = {}) {
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
            const resolvedTitle = getHeaderFileName(res) || title || 'source.txt';
            const text = await res.text();
            if (options.fallbackToNative && !isTextLikeResponse(res, resolvedTitle) && !looksProbablyText(text)) {
                hidePreview();
                triggerNativeDownload(url);
                return;
            }
            showPreview(resolvedTitle, renderMarkdown(text), text);
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
        if (isExplicitDownloadClick(event)) {
            bypassPreviewForNativeDownload();
            return;
        }
        if (Date.now() < nativeDownloadBypassUntil) return;

        const estuaryUrl = getEstuaryContentClickUrl(event);
        if (estuaryUrl) {
            const recent = consumeRecentTextSourceClick();
            if (recent) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                previewTextSourceUrl(new URL(estuaryUrl, location.href).href, recent.label || 'source.txt', { fallbackToNative: !recent.explicit });
                return;
            }
        }

        rememberTextSourceClick(event);
        const info = findTextSourceClickTarget(event);
        if (!info) return;
        const url = getFileUrl(info);
        if (!url) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        previewTextSource(info);
    }, true);

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
