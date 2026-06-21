const fs = require('fs');
const path = require('path');
const assert = require('assert');

const script = fs.readFileSync(path.join(__dirname, '..', 'chatgpt-project-source-preview.user.js'), 'utf8');

assert(
    /function getEstuaryContentClickUrl\s*\(/.test(script),
    'source preview should detect generated estuary anchor clicks'
);

assert(
    /function getPotentialChatFileLabel\s*\(/.test(script),
    'source preview should remember chat file capsule clicks before ChatGPT creates a download anchor'
);

assert(
    /function triggerNativeDownload\s*\(/.test(script),
    'source preview should fall back to native download for unsupported estuary content'
);

assert(
    /@require\s+https:\/\/cdn\.jsdelivr\.net\/npm\/marked@[^/]+\/lib\/marked\.umd\.js/.test(script),
    'source preview should load the marked UMD browser build'
);

assert(
    /@require\s+https:\/\/cdn\.jsdelivr\.net\/npm\/dompurify@[^/]+\/dist\/purify\.min\.js/.test(script),
    'source preview should load DOMPurify for sanitized Markdown HTML'
);

assert(
    /function renderMarkdownFallback\s*\(/.test(script),
    'source preview should keep a fallback renderer when Markdown libraries are unavailable'
);

assert(
    /markedParser\.parse[\s\S]{0,500}purifier\.sanitize/.test(script),
    'source preview should render with marked and sanitize with DOMPurify'
);

assert(
    /getEstuaryContentClickUrl\(event\)[\s\S]{0,900}consumeRecentTextSourceClick\(\)/.test(script),
    'source preview click handler should consume recent chat-file clicks when estuary links are generated'
);

console.log('chatgpt-project-source-preview tests passed');
