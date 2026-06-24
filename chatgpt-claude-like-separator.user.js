// ==UserScript==
// @name         ChatGPT Claude-like Separators
// @namespace    codex.local
// @version      0.1.0
// @description  Marks text-only separator paragraphs in ChatGPT so the Claude-like UserStyle can render them as warm grey rules.
// @author       duro
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function (root, factory) {
  const api = factory();

  if (
    typeof process === 'object' &&
    process.versions &&
    process.versions.node &&
    typeof module === 'object' &&
    module.exports
  ) {
    module.exports = api;
    return;
  }

  api.start(root.document);
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const SEPARATOR_CLASS = 'claude-like-separator';
  const MARKDOWN_SELECTOR = '.markdown p, .prose p';
  const BLOCKED_INLINE_SELECTOR = 'a, button, code, kbd, math, img, picture, pre, svg, table';

  function isSeparatorText(text) {
    const normalized = String(text || '').trim().replace(/\s+/g, '');

    if (normalized.length < 2 || normalized.length > 80) {
      return false;
    }

    return /^[━─—-]+$/.test(normalized);
  }

  function isPlainTextParagraph(paragraph) {
    return Boolean(paragraph) && !paragraph.querySelector(BLOCKED_INLINE_SELECTOR);
  }

  function markSeparatorParagraphs(documentRoot) {
    if (!documentRoot || !documentRoot.querySelectorAll) {
      return 0;
    }

    let changed = 0;
    const paragraphs = documentRoot.querySelectorAll(MARKDOWN_SELECTOR);

    paragraphs.forEach((paragraph) => {
      const shouldMark = isPlainTextParagraph(paragraph) && isSeparatorText(paragraph.textContent);
      const isMarked = paragraph.classList.contains(SEPARATOR_CLASS);

      if (shouldMark !== isMarked) {
        paragraph.classList.toggle(SEPARATOR_CLASS, shouldMark);
        changed += 1;
      }
    });

    return changed;
  }

  function start(documentRoot) {
    if (!documentRoot || !documentRoot.documentElement) {
      return;
    }

    let scheduled = false;
    const scheduleMark = () => {
      if (scheduled) {
        return;
      }

      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        markSeparatorParagraphs(documentRoot);
      });
    };

    markSeparatorParagraphs(documentRoot);

    const observer = new MutationObserver(scheduleMark);
    observer.observe(documentRoot.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  return {
    isSeparatorText,
    markSeparatorParagraphs,
    start,
  };
});
