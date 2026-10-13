// Script/DOM regression harness; jsdom has no layout, paint or GPU cost.
// Install the dev dependency, then: node tests/conversation-rail.performance.test.js [baseline.js]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {performance} = require('node:perf_hooks');
const {JSDOM} = require(process.env.RAIL_JSDOM || 'jsdom');
const current = require.resolve('../chatgpt-conversation-rail.user.js');
const baseline = process.argv[2];
const results = [];
function fixture(file, count) {
  const dom = new JSDOM('<html><body><div id="scroll" style="overflow-y:auto"><main data-thread-find-target="conversation"></main></div></body></html>', {url:'https://chatgpt.com/c/performance',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, d=w.document, content=d.querySelector('main'), scroll=d.querySelector('#scroll');
  const records=Array.from({length:count},(_,i)=>({key:'turn:message-'+i,top:i*220,bottom:(i+1)*220,prompt:'Question '+i,answer:'Answer '+i}));
  let heightChange=0, observerCalls=0, layoutReads=0, time=0, id=0;
  const timers=new Map(), frames=new Map();
  w.setTimeout=(fn,ms)=>{const key=++id;timers.set(key,{fn,at:time+ms});return key;};
  w.clearTimeout=key=>timers.delete(key);
  w.requestAnimationFrame=fn=>{const key=++id;frames.set(key,fn);return key;};
  w.cancelAnimationFrame=key=>frames.delete(key);
  w.matchMedia=()=>({matches:true});
  w.ResizeObserver=class{observe(){}disconnect(){}};
  const NativeObserver=w.MutationObserver;
  w.MutationObserver=class extends NativeObserver{observe(...args){observerCalls++;return super.observe(...args);}};
  Object.defineProperties(scroll,{clientHeight:{get(){layoutReads++;return 700;}},scrollHeight:{get(){layoutReads++;return count*220+heightChange;}}});
  function rect(top,height){layoutReads++;return {top,bottom:top+height,height,width:700,left:0,right:700};}
  scroll.getBoundingClientRect=()=>rect(0,700);
  content.getBoundingClientRect=()=>rect(-scroll.scrollTop,count*220+heightChange);
  scroll.scrollTo=({top})=>{scroll.scrollTop=top;};
  for(let i=count-7;i<count;i++){
    const el=d.createElement('div');el.dataset.turnKey='message-'+i;
    el.innerHTML='<div data-user-message-bubble>Question '+i+'</div><div class="markdown">Answer '+i+'</div>';
    el.getBoundingClientRect=()=>rect(i*220-scroll.scrollTop,220+(i===count-1?heightChange:0));content.append(el);
  }
  let source=fs.readFileSync(file,'utf8');
  source=source.replace('      stats,\n      flush:', '      stats, audit: { refresh, render, watch, schedule },\n      flush:');
  source=source.replaceAll('cache.values()', '(stats.cacheWalks = (stats.cacheWalks || 0) + cache.size, cache.values())');
  source=source.replace('function rebuildIndexes() {','function rebuildIndexes() { stats.indexBuilds = (stats.indexBuilds || 0) + 1;');
  w.module={exports:{}};w.eval(source);const api=w.module.exports;
  const memory=new Map([[api.cacheKey('performance'),api.encodeSaved('performance',records,true,count*220,true)]]);
  const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const initStart=performance.now(), c=api.start(d,{storage});const startupMs=performance.now()-initStart;
  const host=d.querySelector('#duro-conversation-rail'), shadow=host.shadowRoot;
  const changes=new NativeObserver(()=>{});changes.observe(shadow,{attributes:true,subtree:true,childList:true});
  function advance(ms){time+=ms;for(const [key,t] of [...timers])if(t.at<=time){timers.delete(key);t.fn();}}
  return {dom,w,d,c,content,scroll,changes,startupMs,advance,
    frame(){const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(time));},
    mutate(){heightChange++;content.lastElementChild.querySelector('.markdown').textContent='Stream '+heightChange;},
    observeCalls:()=>observerCalls,layoutReads:()=>layoutReads,
    close(){c.stop();changes.disconnect();dom.window.close();}};
}
function median(samples){return samples.slice().sort((a,b)=>a-b)[samples.length>>1];}
function run(file,label,count,verify){
  const f=fixture(file,count), c=f.c;
  for(let i=0;i<20;i++)c.audit.refresh();
  f.changes.takeRecords();const before={...c.stats}, observes=f.observeCalls(), reads=f.layoutReads();
  const samples=[];
  for(let i=0;i<100;i++){f.mutate();const start=performance.now();c.audit.refresh();samples.push(performance.now()-start);}
  const refresh={medianMs:median(samples),p95Ms:samples.slice().sort((a,b)=>a-b)[95],indexBuilds:c.stats.indexBuilds-before.indexBuilds,cacheVisits:(c.stats.cacheWalks||0)-(before.cacheWalks||0),observerObserveCalls:f.observeCalls()-observes,layoutReads:f.layoutReads()-reads};
  f.changes.takeRecords();const start=performance.now();for(let i=0;i<100;i++)c.audit.render();
  const render={totalMs:performance.now()-start,domMutations:f.changes.takeRecords().length};
  const prior={...c.stats};f.advance(5000);const after={...c.stats};f.advance(5000);
  const idleStable=JSON.stringify(c.stats)===JSON.stringify(after);
  if(verify){
    assert.equal(refresh.indexBuilds,0,'height/text changes do not rebuild the full index');
    assert.equal(refresh.cacheVisits,0,'stable virtual window does not walk all cached records');
    assert.equal(refresh.observerObserveCalls,0,'unchanged targets do not reconnect observers');
    assert.equal(render.domMutations,0,'unchanged rail renders do not rewrite DOM');
    assert.ok(idleStable,'no periodic idle work');
    // A synchronous refresh consumes the already queued refresh, rather than orphaning it.
    c.audit.schedule();c.audit.refresh();const refreshed=c.stats.refreshes;f.advance(180);assert.equal(c.stats.refreshes,refreshed);
    const geometryBefore=c.stats.geometryReads, framesBefore=c.stats.scrollFrames;
    for(let i=0;i<100;i++)f.scroll.dispatchEvent(new f.w.Event('scroll'));f.frame();
    assert.equal(c.stats.scrollFrames,framesBefore+1,'scroll events coalesce into one frame');
    assert.equal(c.stats.geometryReads,geometryBefore,'scroll frame does not measure transcript geometry');
    const mounted=f.content.lastElementChild;mounted.remove();c.audit.refresh();
    assert.ok(f.d.querySelector('#duro-conversation-rail').shadowRoot.querySelector('[data-key="turn:message-'+(count-1)+'"]').hasAttribute('data-unloaded'),'unmounted node is visibly marked');
    assert.equal(c.snapshot().count,count,'unmount retains cached latest nodes');
    f.content.append(mounted);c.audit.refresh();
    const el=f.d.createElement('div');el.dataset.turnKey='new-message';el.innerHTML='<div data-user-message-bubble>New question</div>';
    el.getBoundingClientRect=()=>({top:count*220,bottom:(count+1)*220,height:220});f.content.append(el);c.audit.refresh();
    assert.equal(c.snapshot().count,count+1,'new messages extend the index');
    assert.equal(c.snapshot().entries.at(-1).key,'turn:new-message');
    assert.ok(c.snapshot().mountedMarks<=52,'rail buttons remain bounded');
    // Observer topology must update when a mounted wrapper is replaced.
    const observed=f.observeCalls();const clone=f.content.firstElementChild.cloneNode(true);clone.getBoundingClientRect=f.content.firstElementChild.getBoundingClientRect;
    f.content.firstElementChild.replaceWith(clone);c.audit.refresh();assert.ok(f.observeCalls()>observed);
    clone.querySelector('[data-user-message-bubble]').textContent='Edited question';
    const clone2=clone.cloneNode(true);clone2.getBoundingClientRect=clone.getBoundingClientRect;clone.replaceWith(clone2);c.audit.refresh();
    assert.equal(c.snapshot().entries.find(r=>r.key==='turn:message-'+(count-7)).prompt,'Edited question','remount updates metadata without breaking cached order');
  }
  results.push({label,cached:count,mounted:7,startupMs:f.startupMs,refresh100:refresh,unchangedRender100:render,idleStable});f.close();
}
function previewRegression(){
  const f=fixture(current,1000), root=f.d.querySelector('#duro-conversation-rail').shadowRoot;
  const mark=root.querySelector('.mark[data-key="turn:message-993"]'), panel=root.querySelector('.preview');
  mark.dispatchEvent(new f.w.Event('pointerover',{bubbles:true}));
  panel.dispatchEvent(new f.w.Event('pointerenter'));
  assert.equal(panel.querySelectorAll('.preview-card').length,7);
  f.changes.takeRecords();
  for(let i=0;i<100;i++)f.c.audit.refresh();
  assert.equal(f.changes.takeRecords().length,0,'an unchanged expanded panel does not rewrite DOM during refresh');
  const reads=f.layoutReads(), refreshes=f.c.stats.refreshes;
  for(let i=0;i<100;i++)panel.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:120,bubbles:true,composed:true,cancelable:true}));
  assert.ok(panel.querySelectorAll('.preview-card').length<=7,'rapid wheel browsing keeps preview DOM bounded');
  assert.equal(f.c.stats.refreshes,refreshes,'preview wheel does not scan the transcript');
  assert.equal(f.layoutReads(),reads,'preview wheel does not measure transcript geometry');
  assert.equal(panel.querySelector('[data-center]').dataset.key,'turn:message-999');
  f.close();
}
previewRegression();
for(const count of [100,1000,10000]){if(baseline)run(baseline,'0.2.0',count,false);run(current,'current',count,!process.env.RAIL_BASELINE_ONLY);}
console.log(JSON.stringify({method:'Node + jsdom, 7 mounted turns, 20 warmups, 100 synchronous height/text refreshes; no browser layout/paint/GPU measurement',results},null,2));
