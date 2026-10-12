const assert = require('node:assert/strict');
const { activeAt, railRange, threadIdentity, mergeTimeline } = require('../chatgpt-conversation-rail.user.js');

assert.equal(activeAt([], 10), -1);
const items = [0, 100, 400, 900].map(top => ({ top }));
for (const [position, expected] of [[-1, 0], [0, 0], [99, 0], [100, 1], [399, 1], [400, 2], [9000, 3]]) {
  assert.equal(activeAt(items, position), expected);
}
assert.deepEqual(railRange(10000, 50000, 420), { start: 4996, end: 5046 });
assert.deepEqual(railRange(3, 0, 420), { start: 0, end: 3 });
assert.deepEqual(railRange(10000, 99990, 420), { start: 9995, end: 10000 });
// Exercise search complexity at a scale much larger than a typical conversation.
let reads = 0;
const long = Array.from({ length: 100000 }, (_, i) => ({ get top() { reads++; return i * 100; } }));
assert.equal(activeAt(long, 9876543), 98765);
assert.ok(reads <= 17, `binary search read ${reads} entries`);
console.log('Conversation rail: binary search and bounded rendering passed');

assert.equal(threadIdentity('/c/thread-1'), threadIdentity('/g/project/c/thread-1'));
assert.notEqual(threadIdentity('/c/thread-1'), threadIdentity('/c/thread-2'));
assert.equal(threadIdentity('/g/project'), '/g/project');

const cached = new Map([['latest-1', {top: 6000}], ['latest-2', {top: 6200}]]);
assert.deepEqual(mergeTimeline(['latest-1','latest-2'], [{key:'older-1',top:0},{key:'older-2',top:220}], cached), ['older-1','older-2','latest-1','latest-2']);
assert.deepEqual(mergeTimeline(['first','latest'], [{key:'middle',top:200}], new Map(), 'first'), ['first','middle','latest']);
assert.deepEqual(mergeTimeline(['first','latest'], [{key:'new',top:0},{key:'latest',top:900}], new Map()), ['first','new','latest']);
