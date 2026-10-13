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


const { encodeSaved, decodeSaved, createIndexStore, cacheKey } = require('../chatgpt-conversation-rail.user.js');
const now=Date.now();
const records=[{key:'turn:stable-a',top:-200,bottom:0,prompt:'<script>not HTML</script>',answer:'A'.repeat(300),element:{privateDOM:true}},{key:'turn:stable-b',top:0,bottom:200,prompt:'B',answer:'C'}];
const raw=encodeSaved('thread-a',records,true,200,true,now);
const decoded=decodeSaved(raw,'thread-a',now);
assert.equal(decoded.complete,true);
assert.deepEqual(decoded.entries.map(item=>item.key),records.map(item=>item.key));
assert.equal(decoded.entries[0].element,null);
assert.equal(decoded.entries[0].answer.length,140);
assert.ok(!raw.includes('privateDOM'));
assert.equal(decodeSaved(raw,'thread-b',now),null);
assert.equal(decodeSaved(raw,'thread-a',now+365*86400000).entries.length,2);
assert.equal(decodeSaved('{broken','thread-a',now),null);
const corrupt=JSON.parse(raw);corrupt.entries.push(corrupt.entries[0]);
assert.equal(decodeSaved(JSON.stringify(corrupt),'thread-a',now),null);
corrupt.entries.pop();corrupt.entries[0][1]='not a coordinate';
assert.equal(decodeSaved(JSON.stringify(corrupt),'thread-a',now),null);
assert.equal(encodeSaved('legacy',[{key:'turn:conversation-turn-0',top:0,bottom:100}],true,100,true),null);
const memory=new Map();
const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
const stats={storageReads:0,storageWrites:0};const store=createIndexStore(storage,stats);
for(let i=0;i<35;i++)assert.equal(store.write('thread-'+i,encodeSaved('thread-'+i,records,true,200,true)),true);
assert.ok(!memory.has(cacheKey('thread-0')));
assert.ok(memory.has(cacheKey('thread-34')));
assert.equal([...memory.keys()].filter(key=>key.includes(':thread:')).length,32);
assert.equal(store.read('thread-34').entries.length,2);
const blocked=createIndexStore({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}},stats);
assert.equal(blocked.read('thread-x'),null);
assert.equal(blocked.write('thread-x',raw),false);
console.log('Persistence: bounded schema, long-term retention, thread isolation, eviction and storage failures passed');

const {mergeSaved}=require('../chatgpt-conversation-rail.user.js');
const completeSaved={entries:[{key:'turn:old',top:0,bottom:100},{key:'turn:latest',top:100,bottom:200}],complete:true,end:200,tail:true};
const combined=mergeSaved(completeSaved,[{key:'turn:latest',top:0,bottom:100},{key:'turn:new',top:100,bottom:200}],false,200,true);
assert.deepEqual(combined.entries.map(item=>item.key),['turn:old','turn:latest','turn:new']);
assert.equal(combined.entries[0].top,-100);
assert.equal(combined.complete,true);
assert.equal(mergeSaved(completeSaved,completeSaved.entries,false,200,true).complete,false);
store.read('thread-3');
store.write('thread-35',encodeSaved('thread-35',records,true,200,true));
assert.ok(memory.has(cacheKey('thread-3')));
assert.ok(!memory.has(cacheKey('thread-4')));
console.log('Persistence: partial snapshots preserve other-tab discoveries and reads refresh retention');

const {searchNodes}=require('../chatgpt-conversation-rail.user.js');
const searchItems=[{key:'a',prompt:'恢复方案 ABC',answer:'检查失败样本'},{key:'b',prompt:'普通提问',answer:'恢复阶段 abc'},{key:'c',prompt:'<script> literal [x]',answer:'No match'}];
assert.deepEqual(searchNodes(searchItems,'恢复').map(i=>i.key),['a','b']);
assert.deepEqual(searchNodes(searchItems,'恢复 ＡＢＣ').map(i=>i.key),['a','b']);
assert.deepEqual(searchNodes(searchItems,'恢复 样本').map(i=>i.key),['a']);
assert.deepEqual(searchNodes(searchItems,'[x]').map(i=>i.key),['c']);
assert.deepEqual(searchNodes(searchItems,'<script>').map(i=>i.key),['c']);
assert.deepEqual(searchNodes(searchItems,'   '),[]);
assert.deepEqual(searchNodes(searchItems,'missing'),[]);
const manySearch=Array.from({length:10000},(_,i)=>({key:'node-'+i,prompt:'缓存问题 '+i,answer:i%2?'恢复阶段':'检查结果'}));
assert.equal(searchNodes(manySearch,'恢复').length,5000);
console.log('Search: cached question/answer matching, Unicode/case, multiple keywords, literal syntax and 10,000-node search passed');
