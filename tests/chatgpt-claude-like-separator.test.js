const assert = require('assert');

const {
  isSeparatorText,
  markSeparatorParagraphs,
} = require('../chatgpt-claude-like-separator.user.js');

function createParagraph(textContent, hasBlockedInline = false) {
  const classes = new Set();

  return {
    textContent,
    querySelector: () => (hasBlockedInline ? {} : null),
    classList: {
      contains: (className) => classes.has(className),
      toggle: (className, force) => {
        if (force) {
          classes.add(className);
        } else {
          classes.delete(className);
        }
      },
    },
  };
}

assert.strictEqual(isSeparatorText('━━━━━━━━━━━━'), true);
assert.strictEqual(isSeparatorText('────────────'), true);
assert.strictEqual(isSeparatorText('---'), true);
assert.strictEqual(isSeparatorText('———'), true);
assert.strictEqual(isSeparatorText('━ ━ ━ ━'), true);

assert.strictEqual(isSeparatorText('这是普通段落'), false);
assert.strictEqual(isSeparatorText('Phase 1 —— 有效'), false);
assert.strictEqual(isSeparatorText(''), false);
assert.strictEqual(isSeparatorText('━━ ok ━━'), false);

const separatorParagraph = createParagraph('━━━━━━━━━━━━');
const normalParagraph = createParagraph('这是普通段落');
const codeParagraph = createParagraph('---', true);

assert.strictEqual(
  markSeparatorParagraphs({
    querySelectorAll: () => [separatorParagraph, normalParagraph, codeParagraph],
  }),
  1
);
assert.strictEqual(separatorParagraph.classList.contains('claude-like-separator'), true);
assert.strictEqual(normalParagraph.classList.contains('claude-like-separator'), false);
assert.strictEqual(codeParagraph.classList.contains('claude-like-separator'), false);

console.log('chatgpt-claude-like-separator tests passed');
