// Deterministic reference/resource audit; no production diagnostics or forced GC.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require(process.env.RAIL_JSDOM || 'jsdom');
const script = process.argv[2] || require.resolve('../chatgpt-conversation-rail.user.js');
function fixture() {
  const dom = new JSDOM('<div id="scroll" data-role="messages-scroll" style="overflow-y:auto"><div class="message-list"></div></div>',{url:'https://chatgpt.com/dots/home',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,scroll=d.querySelector('#scroll');let content=d.querySelector('.message-list'),clock=0,id=0;
  const timers=new Map(),frames=new Map(),idle=new Map(),observers=new Set(),listeners=new Map();
  w.setTimeout=(fn,ms=0)=>{const key=++id;timers.set(key,{fn,at:clock+ms});return key;};w.clearTimeout=key=>timers.delete(key);
  w.requestAnimationFrame=fn=>{const key=++id;frames.set(key,fn);return key;};w.cancelAnimationFrame=key=>frames.delete(key);
  w.requestIdleCallback=fn=>{const key=++id;idle.set(key,fn);return key;};w.cancelIdleCallback=key=>idle.delete(key);
  w.matchMedia=()=>({matches:true});
  const NativeObserver=w.MutationObserver;
  w.MutationObserver=class extends NativeObserver {constructor(fn){super(fn);this.targets=new Set();observers.add(this);}observe(target,options){this.targets.add(target);super.observe(target,options);}disconnect(){this.targets.clear();super.disconnect();}};
  w.ResizeObserver=class {constructor(){this.targets=new Set();observers.add(this);}observe(target){this.targets.add(target);}disconnect(){this.targets.clear();}};
  const tracked=new Map([[d,new Set(['keydown','wheel','touchstart','pointerdown','visibilitychange'])],[w,new Set(['resize','popstate','pagehide'])],[scroll,new Set(['scroll'])]]);
  const add=w.EventTarget.prototype.addEventListener,remove=w.EventTarget.prototype.removeEventListener;
  function keyFor(target,type,fn,options,adding){
    if(!tracked.get(target)?.has(type))return;
    let types=listeners.get(target);if(!types){types=new Map();listeners.set(target,types);}let fns=types.get(type);if(!fns){fns=new Map();types.set(type,fns);}let captures=fns.get(fn);if(!captures){captures=new Set();fns.set(fn,captures);}
    const capture=typeof options==='boolean'?options:Boolean(options?.capture);if(adding)captures.add(capture);else captures.delete(capture);
  }
  w.EventTarget.prototype.addEventListener=function(type,fn,options){keyFor(this,type,fn,options,true);return add.call(this,type,fn,options);};
  w.EventTarget.prototype.removeEventListener=function(type,fn,options){keyFor(this,type,fn,options,false);return remove.call(this,type,fn,options);};
  Object.defineProperties(scroll,{clientHeight:{get:()=>700},scrollHeight:{get:()=>44000}});
  const rect=(top,height)=>({top,bottom:top+height,left:0,right:700,width:700,height});scroll.getBoundingClientRect=()=>rect(0,700);scroll.scrollTo=({top})=>{scroll.scrollTop=top;};
  const key=i=>`message:memory~memory~CalpicoMessage~msg-${i}`;
  function mount(start,replaceRoot=false){
    if(replaceRoot){const next=d.createElement('div');next.className='message-list';content.replaceWith(next);content=next;}
    content.getBoundingClientRect=()=>rect(-scroll.scrollTop,44000);content.replaceChildren();
    for(let i=start;i<start+7;i++)for(const user of [true,false]){
      const el=d.createElement('article');el.className='message-row'+(user?' self':'');el.dataset.messageId=user?key(i).slice(8):`memory~memory~CalpicoMessage~answer-${i}`;
      el.innerHTML=`<div class="message-text">${user?'Question':'Answer'} ${i}</div>`;el.getBoundingClientRect=()=>rect(i*220+(user?0:100)-scroll.scrollTop,user?100:120);content.append(el);
    }
  }
  mount(193);
  const source=fs.readFileSync(script,'utf8').replace('      stats,\n      flush:',`      stats, audit: {refresh,bind,navigate,buildIndex,restore,
        references:()=>({cached:cache.size,users:[...cache.values()].filter(r=>r.element).length,answers:[...cache.values()].filter(r=>r.responseElement).length,
          detached:[...cache.values()].filter(r=>r.element&&!r.element.isConnected||r.responseElement&&!r.responseElement.isConnected).length,
          restoring:Boolean(restoreJob),staleWeak:staleElements instanceof WeakMap})},\n      flush:`);
  assert.ok(source.includes('references:()=>'), 'audit injection matches controller export');w.module={exports:{}};w.eval(source);const api=w.module.exports;
  const thread='dots:/dots/home:memory~memory';const memory=new Map([[api.cacheKey(thread),api.encodeSaved(thread,Array.from({length:200},(_,i)=>({key:key(i),top:i*220,bottom:(i+1)*220,prompt:`Question ${i}`,answer:`Answer ${i}`})),true,44000,true)]]);
  const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const originalPush=w.history.pushState,c=api.start(d,{storage});
  return {w,d,scroll,c,api,storage,key,mount,originalPush,frames,timers,idle,
    advance(ms){clock+=ms;for(const [k,t]of [...timers])if(t.at<=clock){timers.delete(k);t.fn();}},
    resources(){let count=0;for(const types of listeners.values())for(const fns of types.values())for(const captures of fns.values())count+=captures.size;
      return {observerTargets:[...observers].reduce((n,o)=>n+o.targets.size,0),listeners:count,timers:timers.size,frames:frames.size,idle:idle.size};},
    close(){c.stop();dom.window.close();}};
}
async function run(){
  let f=fixture();let peakTargets=0;
  for(let i=0;i<100;i++){
    f.mount((i*7)%193,i%2===0);f.c.audit.bind();f.c.audit.refresh();const refs=f.c.audit.references();
    assert.equal(refs.cached,200,'metadata survives virtualization');assert.equal(refs.users,7);assert.equal(refs.answers,7);
    assert.equal(refs.detached,0,'cache must not retain unmounted user/answer DOM');peakTargets=Math.max(peakTargets,f.resources().observerTargets);
  }
  f.mount(0,true);f.d.querySelector('.self .message-text').textContent='Modified question';f.c.audit.bind();
  f.advance(1500);assert.equal(f.idle.size,1,'dirty cache save is waiting for idle time');
  const ownHook=f.w.history.pushState;const externalHook=function(...args){return ownHook.apply(this,args);};f.w.history.pushState=externalHook;
  f.c.stop();assert.equal(f.c.audit.references().cached,0,'a retained stopped controller releases all records');
  assert.deepEqual(f.resources(),{observerTargets:0,listeners:0,timers:0,frames:0,idle:0},'all registered resources released');
  assert.equal(f.w.history.pushState,externalHook,'do not overwrite another script’s later history wrapper');
  const stoppedStats=JSON.stringify(f.c.stats);f.w.history.pushState({},'', '/c/after-stop');assert.equal(JSON.stringify(f.c.stats),stoppedStats,'retained history hook is inert after stop');f.close();
  f=fixture();f.c.audit.restore({route:'/dots/home#memory~memory',container:f.scroll,saved:0,offset:0});assert.ok(f.c.audit.references().restoring);
  f.w.history.pushState({},'', '/c/other');assert.ok(!f.c.audit.references().restoring,'route change cancels restore and its old container reference');assert.ok(f.c.audit.references().staleWeak,'stale route suppression is weak');f.c.stop();assert.equal(f.resources().timers,0);f.close();
  f=fixture();f.c.audit.navigate(f.key(0));assert.ok(f.c.snapshot().loadingTarget);f.c.stop();await Promise.resolve();
  assert.deepEqual(f.resources(),{observerTargets:0,listeners:0,timers:0,frames:0,idle:0},'stop resolves pending target waits without orphan timers');f.close();
  f=fixture();const scan=f.c.audit.buildIndex();assert.ok(f.c.snapshot().indexing);f.c.stop();await scan;
  assert.deepEqual(f.resources(),{observerTargets:0,listeners:0,timers:0,frames:0,idle:0},'stop resolves pending indexing waits without restoring stopped UI');assert.equal(f.w.history.pushState,f.originalPush);f.close();
  f=fixture();const activeResources=f.resources();f.c.stop();const stoppedControllers=[];
  for(let i=0;i<20;i++){const c=f.api.start(f.d,{storage:f.storage});
    assert.equal(f.resources().listeners,activeResources.listeners,'restart does not accumulate global listeners');
    assert.equal(f.resources().observerTargets,activeResources.observerTargets,'restart does not accumulate observer targets');
    c.stop();stoppedControllers.push(c);assert.equal(c.snapshot().count,0);
    assert.deepEqual(f.resources(),{observerTargets:0,listeners:0,timers:0,frames:0,idle:0});assert.equal(f.w.history.pushState,f.originalPush);
  }
  assert.ok(stoppedControllers.every(c=>c.audit.references().cached===0));f.close();
  f=fixture();const root=f.d.querySelector('#duro-conversation-rail').shadowRoot,panel=root.querySelector('.preview');
  root.querySelector(`.mark[data-key="${f.key(193)}"]`).dispatchEvent(new f.w.Event('pointerover',{bubbles:true}));panel.dispatchEvent(new f.w.Event('pointerenter'));
  panel.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}));assert.ok(f.resources().frames>0,'wheel browsing queues a bounded frame');
  f.c.stop();assert.deepEqual(f.resources(),{observerTargets:0,listeners:0,timers:0,frames:0,idle:0},'stop cancels wheel frames and quiet-period timers');f.close();
  console.log(JSON.stringify({result:'PASS',cycles:100,restartCycles:20,cachedRecords:200,mountedUsers:7,mountedAnswers:7,detachedCacheReferences:0,peakObserverTargets:peakTargets,afterStop:{observerTargets:0,listeners:0,timers:0,frames:0,idle:0},checks:['idle save cancellation','route restore cancellation','weak stale suppression','external history ownership','stopped controller release','target/index wait teardown','repeated start/stop']},null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
