(()=>{
"use strict";
const VERSION="LOKAL MIDI VIEW SELECTOR v3 READABLE NOTATION";
const NS="http://www.w3.org/2000/svg";
const NOTE_PC={C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};

function noteToMidi(name){
  const m=String(name||"").match(/^([A-G])([#b]?)(-?\d+)/);
  if(!m)return null;
  const pc=NOTE_PC[m[1]+m[2]];
  return pc==null?null:(+m[3]+1)*12+pc;
}
function midiName(n){
  const names=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  return names[(n%12+12)%12]+(Math.floor(n/12)-1);
}
function getNotes(panel){
  return [...panel.querySelectorAll(".rollNote")].map((el,i)=>{
    const title=el.getAttribute("title")||"", label=(el.textContent||"").trim();
    const midi=noteToMidi(label)||noteToMidi(title);
    const times=[...title.matchAll(/([0-9]+(?:\.[0-9]+)?)s/g)].map(x=>+x[1]);
    return {i,label:label||"Note",midi,start:times[0]||0,dur:times[1]||.12};
  }).filter(n=>Number.isFinite(n.start)).sort((a,b)=>a.start-b.start||((a.midi||0)-(b.midi||0)));
}
function svgEl(tag,attrs={},text=""){
  const e=document.createElementNS(NS,tag); Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); if(text)e.textContent=text; return e;
}
function isDrum(notes){
  const s=notes.slice(0,30).map(n=>n.label).join(" ").toLowerCase();
  return /kick|snare|hat|tom|crash|ride|clap|cymbal|perc/.test(s)&&notes.filter(n=>n.midi!=null).length<notes.length*.6;
}
function currentInstrument(){
  const active=document.querySelector(".stemRow.active .stemName");
  if(active)return active.textContent.trim();
  return "Converted MIDI";
}
function getEditorAudio(panel){
  const root=panel.closest("#root")||document.querySelector("#root");
  if(!root)return null;
  const audios=[...root.querySelectorAll("audio")];
  return audios.find(a=>!a.closest(".modalBack"))||audios[0]||null;
}
function activeView(panel){
  return panel.querySelector(".midiViewBtn.active")?.dataset.view||"roll";
}
function findBpmInput(panel){
  const root=panel.closest("#root")||document.querySelector("#root")||document;
  return [...root.querySelectorAll('input[type="number"]')].find(x=>{const l=x.closest("label");return l&&/\bBPM\b/i.test(l.textContent||"")})||null;
}
function findQuantizeSelect(panel){
  return [...panel.querySelectorAll(".nnControlCard")].find(c=>/Time Quantize/i.test(c.querySelector("h3")?.textContent||""))?.querySelector("select")||null;
}
function timingBpm(panel){
  const input=findBpmInput(panel),v=+(input?.value||0);
  return v>=30&&v<=300?v:notationBpm(panel);
}
function formatClock(t){
  t=Math.max(0,Number(t)||0);const ms=Math.floor((t%1)*1000),sec=Math.floor(t)%60,min=Math.floor(t/60)%60,hr=Math.floor(t/3600);
  return hr+":"+String(min).padStart(2,"0")+":"+String(sec).padStart(2,"0")+":"+String(ms).padStart(3,"0");
}
function updateMidiTimingStrip(panel,t,audio){
  const strip=panel.querySelector(".midiTimingStrip");if(!strip)return;
  const bpm=timingBpm(panel),beats=Math.max(0,t)*bpm/60,bar=Math.floor(beats/4)+1,beatIn=beats%4,beat=Math.floor(beatIn)+1,sub=(beatIn%1)*4,sixteenth=Math.floor(sub)+1,ticks=Math.min(239,Math.floor((sub%1)*240));
  const pos=strip.querySelector(".mtsPosition"),clock=strip.querySelector(".mtsClock"),tempo=strip.querySelector(".mtsBpm");
  if(pos)pos.textContent=bar+"."+beat+"."+sixteenth+"."+String(ticks).padStart(3,"0");
  if(clock)clock.textContent=formatClock(t);
  if(tempo)tempo.textContent=bpm.toFixed(3);
  strip.classList.toggle("playing",!!audio&&!audio.paused);
  ensureClickScheduler(panel,audio);
}
function playMidiClick(panel,accent,when=null){
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const ctx=panel._lokalClickCtx||(panel._lokalClickCtx=new C());
    if(ctx.state==="suspended")ctx.resume();
    const o=ctx.createOscillator(),g=ctx.createGain(),now=Math.max(ctx.currentTime+.003,Number.isFinite(when)?when:ctx.currentTime+.003);
    o.type="sine";o.frequency.setValueAtTime(accent?1320:920,now);
    g.gain.setValueAtTime(accent?.10:.065,now);g.gain.exponentialRampToValueAtTime(.0001,now+.035);
    o.connect(g).connect(ctx.destination);const s=panel._lokalClickScheduler;if(s){s.nodes||(s.nodes=new Set());s.nodes.add(o);o.onended=()=>s.nodes.delete(o)}o.start(now);o.stop(now+.04);
  }catch{}
}
function stopClickScheduler(panel){
  const s=panel._lokalClickScheduler;if(!s)return;
  if(s.timer){clearInterval(s.timer);s.timer=0}if(s.nodes){s.nodes.forEach(o=>{try{o.stop()}catch{}});s.nodes.clear()}s.nextBeat=null;s.audio=null;s.bpm=0;
}
function ensureClickScheduler(panel,audio){
  if(!panel._lokalClickEnabled||!audio||audio.paused){stopClickScheduler(panel);return}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const ctx=panel._lokalClickCtx||(panel._lokalClickCtx=new C());
  if(ctx.state==="suspended")ctx.resume();
  let s=panel._lokalClickScheduler||(panel._lokalClickScheduler={timer:0,nextBeat:null,audio:null,bpm:0,lastMedia:0,nodes:new Set()});
  const bpm=timingBpm(panel),beatDur=60/bpm,media=audio.currentTime||0,beatPos=media/beatDur;
  if(s.audio!==audio||s.bpm!==bpm||s.nextBeat==null||Math.abs(media-s.lastMedia)>beatDur*1.5){
    const nearest=Math.round(beatPos);
    s.nextBeat=Math.abs(beatPos-nearest)<.055?nearest:Math.ceil(beatPos);
    s.audio=audio;s.bpm=bpm;
  }
  s.lastMedia=media;
  if(s.timer)return;
  const schedule=()=>{
    if(!panel._lokalClickEnabled||!s.audio||s.audio.paused){stopClickScheduler(panel);return}
    const a=s.audio,b=timingBpm(panel),bd=60/b,rate=Math.max(.25,a.playbackRate||1),cur=a.currentTime||0;
    if(Math.abs(b-s.bpm)>.0001){s.bpm=b;s.nextBeat=Math.ceil(cur/bd-.0001)}
    let nextTime=s.nextBeat*bd;
    if(nextTime<cur-.045||nextTime>cur+bd*2){s.nextBeat=Math.ceil(cur/bd-.0001);nextTime=s.nextBeat*bd}
    const horizon=.12*rate;
    while(nextTime<=cur+horizon){
      if(nextTime>=cur-.045){
        const when=ctx.currentTime+Math.max(.003,(nextTime-cur)/rate);
        playMidiClick(panel,s.nextBeat%4===0,when);
      }
      s.nextBeat++;nextTime=s.nextBeat*bd;
    }
    s.lastMedia=cur;
  };
  schedule();s.timer=setInterval(schedule,25);
}
function syncAltView(panel,forceScroll=false,timeOverride=null){
  const audio=getEditorAudio(panel), t=timeOverride==null?(audio?.currentTime||0):timeOverride;
  updateMidiTimingStrip(panel,t,audio);
  const pane=panel.querySelector(".midiAltView");
  if(!pane||pane.hidden)return;
  const view=activeView(panel);
  const svg=pane.querySelector("svg");
  if(svg){
    const px=+(svg.dataset.px||0), x0=+(svg.dataset.x0||0), x=x0+t*px;
    const line=svg.querySelector(".mvLivePlayhead"), cap=svg.querySelector(".mvPlayheadCap"), label=svg.querySelector(".mvPlayheadTime");
    if(line){line.setAttribute("x1",x);line.setAttribute("x2",x)}
    if(cap)cap.setAttribute("cx",x);
    if(label){label.setAttribute("x",x+7);label.textContent=t.toFixed(2)+"s"}
    let cache=svg._mvTimedCache;
    if(!cache){
      const items=[...svg.querySelectorAll(".mvTimedNote")].map(el=>{const s=+el.dataset.start||0,e=+el.dataset.end||s+.08;return{el,s,e}}).sort((a,b)=>a.s-b.s);
      cache=svg._mvTimedCache={items,maxDur:items.reduce((m,n)=>Math.max(m,n.e-n.s),.08),live:new Set()};
    }
    const items=cache.items, loTime=t-cache.maxDur-.018, hiTime=t+.018;
    let lo=0,hi=items.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].s<loTime)lo=mid+1;else hi=mid}
    const nextLive=new Set();
    for(let i=lo;i<items.length&&items[i].s<=hiTime;i++){const n=items[i];if(t>=n.s-.018&&t<=n.e+.018)nextLive.add(n.el)}
    cache.live.forEach(el=>{if(!nextLive.has(el))el.classList.remove("live")});
    nextLive.forEach(el=>{if(!cache.live.has(el))el.classList.add("live")});
    cache.live=nextLive;
    if(audio&&!audio.paused){
      const visibleLeft=pane.scrollLeft, visibleRight=visibleLeft+pane.clientWidth;
      if(forceScroll){
        pane.scrollLeft=Math.max(0,x-pane.clientWidth*(view==="score"?.62:.35));
      }else if(view==="score"){
        const target=Math.max(0,x-pane.clientWidth*.62);
        const delta=target-pane.scrollLeft;
        if(Math.abs(delta)>.08)pane.scrollLeft+=delta*.085;
      }else if(x>visibleRight-120){
        const target=Math.max(0,x-pane.clientWidth*.72);
        pane.scrollLeft+=(target-pane.scrollLeft)*.16;
      }else if(x<visibleLeft+70){
        const target=Math.max(0,x-pane.clientWidth*.28);
        pane.scrollLeft+=(target-pane.scrollLeft)*.20;
      }
    }
  }
  if(view==="list"){
    let live=null;
    pane.querySelectorAll("tr[data-start]").forEach(row=>{
      const s=+row.dataset.start||0,e=+row.dataset.end||s+.08,on=t>=s-.018&&t<=e+.018;
      row.classList.toggle("live",on);if(on&&!live)live=row;
    });
    if(live&&audio&&!audio.paused)live.scrollIntoView({block:"nearest",inline:"nearest"});
  }
}
function startPanelSync(panel){
  if(panel._lokalMidiSync)return;
  panel._lokalMidiSync={raf:0,audio:null,handlers:null,anchorTime:0,anchorPerf:0};
  const state=panel._lokalMidiSync;
  const resetClock=a=>{state.anchorTime=a?.currentTime||0;state.anchorPerf=performance.now()};
  const tick=now=>{
    const a=getEditorAudio(panel);
    if(a&&!a.paused){
      if(!state.anchorPerf)resetClock(a);
      const rate=a.playbackRate||1, predicted=state.anchorTime+(now-state.anchorPerf)/1000*rate, actual=a.currentTime||0;
      if(Math.abs(actual-predicted)>.12)resetClock(a);
      const smoothTime=Math.max(0,Math.min(a.duration||Infinity,state.anchorTime+(now-state.anchorPerf)/1000*rate));
      syncAltView(panel,false,smoothTime);
      state.raf=requestAnimationFrame(tick);
    }else{state.raf=0;state.anchorPerf=0;syncAltView(panel)}
  };
  const bind=()=>{
    const a=getEditorAudio(panel);if(!a||state.audio===a)return;
    if(state.audio&&state.handlers)Object.entries(state.handlers).forEach(([ev,fn])=>state.audio.removeEventListener(ev,fn));
    const onPlay=()=>{resetClock(a);if(!state.raf)state.raf=requestAnimationFrame(tick)};
    const onUpdate=()=>{resetClock(a);syncAltView(panel,false,a.currentTime||0)};
    state.handlers={play:onPlay,pause:()=>{stopClickScheduler(panel);onUpdate()},timeupdate:()=>{if(a.paused)onUpdate()},seeked:()=>{stopClickScheduler(panel);onUpdate()},loadedmetadata:onUpdate,ended:()=>{stopClickScheduler(panel);onUpdate()},ratechange:()=>{stopClickScheduler(panel);onUpdate()}};
    Object.entries(state.handlers).forEach(([ev,fn])=>a.addEventListener(ev,fn));
    state.audio=a;
  };
  bind();
  const finder=setInterval(()=>{if(!document.contains(panel)){clearInterval(finder);return}bind()},1000);
}

function notationBpm(panel){
  const root=panel?.closest("#root")||document.querySelector("#root")||document.body;
  const text=(root?.innerText||"").replace(/\s+/g," ");
  const matches=[...text.matchAll(/(?:^|\s)(\d{2,3}(?:\.\d+)?)\s*BPM\b/ig)].map(m=>+m[1]).filter(v=>v>=30&&v<=300);
  if(matches.length)return matches[0];
  const nums=[...root.querySelectorAll('input[type="number"]')].map(x=>+x.value).filter(v=>v>=30&&v<=300);
  return nums[0]||120;
}
function notationPitch(midi){
  const sharp=[["C",false],["C",true],["D",false],["D",true],["E",false],["F",false],["F",true],["G",false],["G",true],["A",false],["A",true],["B",false]];
  const pair=sharp[(midi%12+12)%12],letter=pair[0],acc=pair[1],oct=Math.floor(midi/12)-1;
  const li={C:0,D:1,E:2,F:3,G:4,A:5,B:6}[letter];
  return {letter,acc,oct,diatonic:oct*7+li,name:letter+(acc?"#":"")+oct};
}
function rhythmValue(beats){
  const vals=[
    {b:4,name:"WHOLE",kind:"whole",flags:0,dot:false},
    {b:3,name:"DOTTED HALF",kind:"half",flags:0,dot:true},
    {b:2,name:"HALF",kind:"half",flags:0,dot:false},
    {b:1.5,name:"DOTTED QUARTER",kind:"quarter",flags:0,dot:true},
    {b:1,name:"QUARTER",kind:"quarter",flags:0,dot:false},
    {b:.75,name:"DOTTED EIGHTH",kind:"eighth",flags:1,dot:true},
    {b:.5,name:"EIGHTH",kind:"eighth",flags:1,dot:false},
    {b:.375,name:"DOTTED SIXTEENTH",kind:"sixteenth",flags:2,dot:true},
    {b:.25,name:"SIXTEENTH",kind:"sixteenth",flags:2,dot:false},
    {b:.1875,name:"DOTTED 32ND",kind:"32nd",flags:3,dot:true},
    {b:.125,name:"32ND",kind:"32nd",flags:3,dot:false}
  ];
  const safe=Math.max(.0625,beats||.25);
  return vals.reduce((best,v)=>Math.abs(v.b-safe)<Math.abs(best.b-safe)?v:best,vals[0]);
}
function staffY(midi,treble){
  const p=notationPitch(midi),bottomIndex=treble?(4*7+2):(2*7+4),bottomY=treble?174:334;
  return {y:bottomY-(p.diatonic-bottomIndex)*8,p};
}
function addLedgerLines(g,x,y,treble){
  const top=treble?110:270,bottom=treble?174:334;
  if(y>bottom+1){for(let ly=bottom+16;ly<=y+2;ly+=16)g.append(svgEl("line",{x1:x-12,y1:ly,x2:x+12,y2:ly,class:"mvLedger"}))}
  if(y<top-1){for(let ly=top-16;ly>=y-2;ly-=16)g.append(svgEl("line",{x1:x-12,y1:ly,x2:x+12,y2:ly,class:"mvLedger"}))}
}
function drawNotationNote(svg,n,x,bpm){
  const treble=n.midi>=60,sy=staffY(n.midi,treble),y=sy.y,p=sy.p,beatSec=60/bpm,beats=n.dur/beatSec,rv=rhythmValue(beats);
  const g=svgEl("g",{class:"mvTimedNote mvNotationNote","data-start":n.start,"data-end":n.start+Math.max(.05,n.dur),"data-midi":n.midi,"data-rhythm":rv.name});
  g.append(svgEl("title",{},p.name+" | "+rv.name+" | "+beats.toFixed(3)+" beats | "+n.dur.toFixed(3)+" s"));
  addLedgerLines(g,x,y,treble);
  if(p.acc)g.append(svgEl("text",{x:x-18,y:y+6,class:"mvAccidental","font-size":20},"â™¯"));
  const open=rv.kind==="whole"||rv.kind==="half";
  g.append(svgEl("ellipse",{cx:x,cy:y,rx:7.4,ry:5.3,class:"mvNoteHead"+(open?" open":""),transform:"rotate(-18 "+x+" "+y+")"}));
  if(rv.kind!=="whole"){
    const down=y<(treble?142:302),stemX=down?x-6.4:x+6.4,stemEnd=down?y+34:y-34;
    g.append(svgEl("line",{x1:stemX,y1:y,x2:stemX,y2:stemEnd,class:"mvNoteStem","stroke-width":1.6}));
    for(let f=0;f<rv.flags;f++){
      const fy=stemEnd+(down?-f*7:f*7);
      const path=down?("M "+stemX+" "+fy+" C "+(stemX-12)+" "+(fy+5)+", "+(stemX-13)+" "+(fy+15)+", "+(stemX-5)+" "+(fy+19)):("M "+stemX+" "+fy+" C "+(stemX+13)+" "+(fy+5)+", "+(stemX+14)+" "+(fy+15)+", "+(stemX+6)+" "+(fy+20));
      g.append(svgEl("path",{d:path,class:"mvNoteFlag"}));
    }
  }
  if(rv.dot)g.append(svgEl("circle",{cx:x+13,cy:y-1,r:2.2,class:"mvNoteDot"}));
  svg.append(g);
}

function drawRest(svg,x,y,rv,startSec,endSec){
  const g=svgEl("g",{class:"mvNotationRest","data-start":startSec,"data-end":endSec});
  g.append(svgEl("title",{},rv.name+" REST"));
  if(rv.kind==="whole")g.append(svgEl("rect",{x:x-8,y:y-8,width:16,height:5,class:"mvRestMark"}));
  else if(rv.kind==="half")g.append(svgEl("rect",{x:x-8,y:y-3,width:16,height:5,class:"mvRestMark"}));
  else if(rv.kind==="quarter"){
    g.append(svgEl("path",{d:"M "+(x+2)+" "+(y-18)+" l -7 10 l 8 8 l -8 10 l 7 11",class:"mvRestPath"}));
  }else{
    g.append(svgEl("line",{x1:x,y1:y-17,x2:x,y2:y+13,class:"mvRestPath"}));
    for(let q=0;q<rv.flags;q++)g.append(svgEl("path",{d:"M "+x+" "+(y-14+q*8)+" C "+(x+13)+" "+(y-12+q*8)+", "+(x+12)+" "+(y-2+q*8)+", "+(x+4)+" "+(y+3+q*8),class:"mvRestPath"}));
  }
  if(rv.dot)g.append(svgEl("circle",{cx:x+13,cy:y-2,r:2,class:"mvRestMark"}));
  svg.append(g);
}
function addStaffRests(svg,notes,treble,bpm,x0,beatPx,maxBeat){
  const beatSec=60/bpm, intervals=notes.filter(n=>(n.midi>=60)===treble).map(n=>[n.start/beatSec,(n.start+n.dur)/beatSec]).sort((a,b)=>a[0]-b[0]);
  if(!intervals.length)return;
  const merged=[];
  intervals.forEach(it=>{const last=merged[merged.length-1];if(last&&it[0]<=last[1]+.03)last[1]=Math.max(last[1],it[1]);else merged.push(it.slice())});
  const gaps=[];let pos=0;
  merged.forEach(it=>{if(it[0]-pos>=.12)gaps.push([pos,it[0]]);pos=Math.max(pos,it[1])});
  if(maxBeat-pos>=.12)gaps.push([pos,maxBeat]);
  const vals=[4,3,2,1.5,1,.75,.5,.375,.25,.1875,.125],y=treble?142:302;
  gaps.forEach(gap=>{
    let p=gap[0],end=gap[1],guard=0;
    while(end-p>=.115&&guard++<256){
      const measureEnd=(Math.floor(p/4)+1)*4,avail=Math.min(end,measureEnd)-p;
      let v=vals.find(q=>q<=avail+.025)||.125;
      const rv=rhythmValue(v),center=p+v/2,x=x0+center*beatPx;
      drawRest(svg,x,y,rv,p*beatSec,(p+v)*beatSec);
      p+=v;
    }
  });
}

function renderScore(host,notes){
  host.innerHTML="";
  if(!notes.length){host.innerHTML='<div class="mvEmpty">Convert audio to MIDI first.</div>';return}
  if(isDrum(notes)){host.innerHTML='<div class="mvEmpty">Drum conversion stays in Piano Roll / Note List. Standard pitched staff notation is disabled for drum lanes.</div>';return}
  const pitched=notes.filter(n=>n.midi!=null);
  if(!pitched.length){host.innerHTML='<div class="mvEmpty">No pitched notes available for staff notation.</div>';return}
  const panel=host.closest(".pianoPanel"),bpm=notationBpm(panel),beatSec=60/bpm,zoom=Math.max(.4,Math.min(2,+(panel?.dataset.scoreZoom||1))),beatPx=72*zoom,pxPerSec=beatPx/beatSec;
  const maxT=Math.max(...pitched.map(n=>n.start+n.dur),4),maxBeat=maxT/beatSec,measures=Math.max(1,Math.ceil(maxBeat/4));
  const x0=150,width=Math.max(1080,Math.min(24000,x0+measures*4*beatPx+70)),height=440;
  const controls=document.createElement("div");controls.className="mvScoreZoomBar";controls.innerHTML=`<b>SCORE ZOOM</b><button type="button" data-score-zoom="-">−</button><span>${Math.round(zoom*100)}%</span><button type="button" data-score-zoom="+">+</button>`;host.append(controls);controls.addEventListener("click",e=>{const btn=e.target.closest("[data-score-zoom]");if(!btn||!panel)return;const now=Math.max(.4,Math.min(2,+(panel.dataset.scoreZoom||1))),next=Math.max(.4,Math.min(2,Math.round((now+(btn.dataset.scoreZoom==="+"?.15:-.15))*100)/100));if(next===now)return;panel.dataset.scoreZoom=String(next);renderScore(host,getNotes(panel));requestAnimationFrame(()=>syncAltView(panel,true))});
  const svg=svgEl("svg",{viewBox:"0 0 "+width+" "+height,width,height,class:"mvScoreSvg","data-px":pxPerSec,"data-x0":x0,"data-bpm":bpm,"data-zoom":zoom});
  svg.append(svgEl("rect",{x:0,y:0,width,height,fill:"#f7f3e8"}));
  svg.append(svgEl("text",{x:28,y:31,class:"mvScoreTitle","font-size":18,"font-weight":"700"},currentInstrument()+" | READABLE MIDI NOTATION"));
  svg.append(svgEl("text",{x:28,y:54,class:"mvScoreMeta","font-size":12},(Math.round(bpm*10)/10)+" BPM | 4/4 | pitch + duration read from converted MIDI"));
  const staffs=[{y:110,treble:true},{y:270,treble:false}];
  staffs.forEach(st=>{
    for(let k=0;k<5;k++)svg.append(svgEl("line",{x1:42,y1:st.y+k*16,x2:width-24,y2:st.y+k*16,class:"mvStaffLine"}));
    svg.append(svgEl("text",{x:52,y:st.y+47,class:"mvClef","font-size":52},st.treble?"\u{1D11E}":"\u{1D122}"));
  });
  svg.append(svgEl("line",{x1:92,y1:110,x2:92,y2:334,class:"mvBraceLine"}));
  svg.append(svgEl("text",{x:100,y:133,class:"mvTimeSig","font-size":22},"4"));
  svg.append(svgEl("text",{x:100,y:158,class:"mvTimeSig","font-size":22},"4"));
  svg.append(svgEl("text",{x:100,y:293,class:"mvTimeSig","font-size":22},"4"));
  svg.append(svgEl("text",{x:100,y:318,class:"mvTimeSig","font-size":22},"4"));
  for(let m=0;m<=measures;m++){
    const x=x0+m*4*beatPx;
    svg.append(svgEl("line",{x1:x,y1:110,x2:x,y2:334,class:"mvBarLine"}));
    if(m<measures)svg.append(svgEl("text",{x:x+5,y:92,class:"mvMeasureNo","font-size":10},"M"+(m+1)));
  }
  for(let bb=0;bb<=measures*4;bb++){
    const x=x0+bb*beatPx;
    if(bb%4!==0)svg.append(svgEl("line",{x1:x,y1:102,x2:x,y2:342,class:"mvBeatGuide"}));
  }
  addStaffRests(svg,pitched,true,bpm,x0,beatPx,measures*4);
  addStaffRests(svg,pitched,false,bpm,x0,beatPx,measures*4);
  pitched.forEach(n=>drawNotationNote(svg,n,x0+(n.start/beatSec)*beatPx,bpm));
  svg.append(svgEl("line",{x1:x0,y1:78,x2:x0,y2:350,class:"mvLivePlayhead"}));
  svg.append(svgEl("circle",{cx:x0,cy:78,r:6,class:"mvPlayheadCap"}));
  svg.append(svgEl("text",{x:x0+7,y:72,class:"mvPlayheadTime","font-size":11},"0.00s"));
  host.append(svg);
  const legend=document.createElement("div");legend.className="mvNotationLegend";
  legend.innerHTML='<b>NOTE VALUES:</b><span>&#x1D15D; Whole</span><span>&#x1D15E; Half</span><span>&#9833; Quarter</span><span>&#9834; Eighth</span><span>&#x1D161; Sixteenth</span><span>&#x1D162; 32nd</span><em>Hover a note for exact pitch, rhythmic value, beats and seconds.</em>';
  host.append(legend);
  const foot=document.createElement("div");foot.className="mvFoot";foot.textContent="Notation is derived from the converted MIDI pitch, start time and note length at the detected/selected BPM. MusicXML remains available for full notation editing and engraving.";host.append(foot);
}

function tabPosition(midi,bass=false){
  const opens=bass?[28,33,38,43]:[40,45,50,55,59,64];
  let best=null;
  opens.forEach((open,i)=>{const fret=midi-open;if(fret>=0&&fret<=24&&(!best||fret<best.fret))best={string:i,fret}});
  return best;
}
function renderTab(host,notes){
  host.innerHTML="";
  if(!notes.length){host.innerHTML='<div class="mvEmpty">Convert audio to MIDI first.</div>';return}
  if(isDrum(notes)){host.innerHTML='<div class="mvEmpty">Guitar Tab is for pitched guitar/bass-style MIDI. Drum lanes remain available in Piano Roll and Note List.</div>';return}
  const pitched=notes.filter(n=>n.midi!=null), bass=/bass/i.test(currentInstrument());
  const strings=bass?["E","A","D","G"]:["E","A","D","G","B","e"], count=strings.length;
  const maxT=Math.max(...pitched.map(n=>n.start+n.dur),4), px=92, width=Math.max(1080,Math.min(14000,150+maxT*px)), height=115+count*42;
  const svg=svgEl("svg",{viewBox:`0 0 ${width} ${height}`,width,height,class:"mvTabSvg","data-px":px,"data-x0":75});
  svg.append(svgEl("rect",{x:0,y:0,width,height,fill:"#0b1214"}));
  svg.append(svgEl("text",{x:28,y:34,fill:"#d9ff65","font-size":18,"font-weight":"700"},(bass?"BASS":"GUITAR")+" TAB Â· STANDARD TUNING"));
  for(let s=0;s<count;s++){const y=75+s*42;svg.append(svgEl("text",{x:30,y:y+5,fill:"#a9bbb7","font-size":15,"font-weight":"700"},strings[s]));svg.append(svgEl("line",{x1:58,y1:y,x2:width-24,y2:y,stroke:"#617175","stroke-width":1.3}))}
  pitched.forEach(n=>{const p=tabPosition(n.midi,bass);if(!p)return;const y=75+p.string*42,x=75+n.start*px;const g=svgEl("g",{class:"mvTimedNote mvTabNote","data-start":n.start,"data-end":n.start+Math.max(.05,n.dur)});g.append(svgEl("rect",{x:x-7,y:y-12,width:Math.max(20,String(p.fret).length*11+12),height:24,rx:6,class:"mvTabFret","stroke-width":1}));g.append(svgEl("text",{x:x+3,y:y+5,class:"mvTabText","font-size":15,"font-weight":"700","text-anchor":"middle"},String(p.fret)));svg.append(g)});
  svg.append(svgEl("line",{x1:75,y1:52,x2:75,y2:height-28,class:"mvLivePlayhead"}));
  svg.append(svgEl("circle",{cx:75,cy:52,r:6,class:"mvPlayheadCap"}));
  svg.append(svgEl("text",{x:82,y:46,class:"mvPlayheadTime","font-size":11},"0.00s"));
  host.append(svg);
  const note=document.createElement("div");note.className="mvFoot";note.textContent="Tab preview maps converted pitches to practical standard-tuning fret positions. MIDI timing is unchanged.";host.append(note);
}
function renderList(host,notes){
  host.innerHTML="";
  const wrap=document.createElement("div");wrap.className="mvNoteList";
  const table=document.createElement("table");table.innerHTML="<thead><tr><th>#</th><th>NOTE</th><th>MIDI</th><th>START</th><th>LENGTH</th></tr></thead>";
  const body=document.createElement("tbody");
  notes.forEach((n,i)=>{const tr=document.createElement("tr");tr.dataset.start=n.start;tr.dataset.end=n.start+Math.max(.05,n.dur);tr.innerHTML=`<td>${i+1}</td><td>${n.label}</td><td>${n.midi??"â€”"}</td><td>${n.start.toFixed(3)} s</td><td>${n.dur.toFixed(3)} s</td>`;body.append(tr)});
  table.append(body);wrap.append(table);host.append(wrap);
}
function setView(panel,view){
  const shell=panel.querySelector(".nnShell"), pane=panel.querySelector(".midiAltView");
  if(!shell||!pane)return;
  panel.querySelectorAll(".midiViewBtn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  if(view==="roll"){shell.style.display="";pane.hidden=true;return}
  shell.style.display="none";pane.hidden=false;
  const notes=getNotes(panel);
  if(view==="score")renderScore(pane,notes);
  else if(view==="tab")renderTab(pane,notes);
  else renderList(pane,notes);
  requestAnimationFrame(()=>syncAltView(panel,true));
}
function install(panel){
  if(panel.dataset.midiViewSelector)return; panel.dataset.midiViewSelector="1";
  const header=panel.querySelector(".nnHeader"); if(!header)return;
  const bar=document.createElement("div");bar.className="midiViewSelector";
  bar.innerHTML=`<div class="midiViewLeft"><b>CONVERTED MIDI VIEW</b>
    <button class="midiViewBtn active" data-view="roll">PIANO ROLL</button>
    <button class="midiViewBtn" data-view="score">SHEET MUSIC</button>
    <button class="midiViewBtn" data-view="tab">GUITAR TAB</button>
    <button class="midiViewBtn" data-view="list">NOTE LIST</button></div>
    <label class="midiSpeed">PLAYBACK SPEED <select aria-label="MIDI reference playback speed"><option value=".5">50%</option><option value=".75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label>`;
  header.insertAdjacentElement("afterend",bar);
  const timing=document.createElement("div");timing.className="midiTimingStrip";
  timing.innerHTML=`<div class="mtsCell mtsQuant"><small>GRID / QUANTIZE</small><select aria-label="MIDI grid quantize"><option value="8">1/8</option><option value="16" selected>1/16</option><option value="32">1/32</option></select></div>
    <div class="mtsCell mtsSync"><small>SYNC MODE</small><b>INTERNAL</b></div>
    <div class="mtsCell mtsPos"><small>POSITION</small><strong class="mtsPosition">1.1.1.000</strong><span class="mtsClock">0:00:00:000</span></div>
    <button type="button" class="mtsClick" aria-pressed="false" title="Metronome click"><span>♩</span><small>CLICK</small></button>
    <div class="mtsCell mtsTempo"><strong class="mtsBpm">120.000</strong><button type="button" class="mtsTap">TAP</button></div>
    <div class="mtsCell mtsSig"><small>TIME SIG</small><strong>4/4</strong></div>`;
  bar.insertAdjacentElement("afterend",timing);
  const qNative=findQuantizeSelect(panel),qUi=timing.querySelector(".mtsQuant select");
  if(qNative&&["8","16","32"].includes(qNative.value))qUi.value=qNative.value;
  qUi.addEventListener("change",()=>{const q=findQuantizeSelect(panel);if(q){const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;set?set.call(q,qUi.value):q.value=qUi.value;q.dispatchEvent(new Event("change",{bubbles:true}))}});
  timing.querySelector(".mtsClick").addEventListener("click",e=>{panel._lokalClickEnabled=!panel._lokalClickEnabled;e.currentTarget.classList.toggle("active",panel._lokalClickEnabled);e.currentTarget.setAttribute("aria-pressed",String(!!panel._lokalClickEnabled));stopClickScheduler(panel);if(panel._lokalClickEnabled)ensureClickScheduler(panel,getEditorAudio(panel))});
  timing.querySelector(".mtsTap").addEventListener("click",()=>{const now=performance.now();let taps=panel._lokalTapTimes||(panel._lokalTapTimes=[]);if(taps.length&&now-taps[taps.length-1]>2500)taps=[];taps.push(now);panel._lokalTapTimes=taps.slice(-6);if(panel._lokalTapTimes.length>=2){const a=panel._lokalTapTimes,ints=[];for(let i=1;i<a.length;i++)ints.push(a[i]-a[i-1]);const avg=ints.reduce((x,y)=>x+y,0)/ints.length,bpm=Math.max(30,Math.min(300,Math.round(600000/avg)/10)),input=findBpmInput(panel);if(input){const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;set?set.call(input,String(bpm)):input.value=String(bpm);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))}timing.querySelector(".mtsBpm").textContent=bpm.toFixed(3)}});
  const pane=document.createElement("div");pane.className="midiAltView";pane.hidden=true;
  const shell=panel.querySelector(".nnShell");shell.insertAdjacentElement("afterend",pane);
  bar.addEventListener("click",e=>{const btn=e.target.closest(".midiViewBtn");if(btn)setView(panel,btn.dataset.view)});
  bar.querySelector("select").addEventListener("change",e=>{const a=[...document.querySelectorAll("audio")].find(x=>x.closest("#root"));if(a){a.playbackRate=+e.target.value;a.defaultPlaybackRate=+e.target.value}});
  let noteRefresh=0;
  const noteObserver=new MutationObserver(()=>{
    const active=panel.querySelector(".midiViewBtn.active");
    if(!active||active.dataset.view==="roll"||pane.hidden)return;
    clearTimeout(noteRefresh);
    noteRefresh=setTimeout(()=>{
      if(document.contains(panel)&&!pane.hidden)setView(panel,active.dataset.view);
    },220);
  });
  const roll=panel.querySelector(".pianoRoll");if(roll)noteObserver.observe(roll,{childList:true});
  if(window._lokalMidiKeyHandler)window.removeEventListener("keydown",window._lokalMidiKeyHandler);
  const keyHandler=e=>{
    if(!document.contains(panel)||e.altKey||e.ctrlKey||e.metaKey)return;
    const target=e.target,tag=(target?.tagName||"").toLowerCase();
    if(target?.isContentEditable||["input","textarea","select"].includes(tag))return;
    const audio=getEditorAudio(panel);if(!audio)return;
    if(e.code==="Space"){
      e.preventDefault();if(e.repeat)return;
      if(audio.paused)audio.play().catch(err=>console.error("MIDI keyboard play error",err));
      else audio.pause();
      return;
    }
    if(e.code==="ArrowLeft"||e.code==="ArrowRight"){
      e.preventDefault();
      const step=e.code==="ArrowLeft"?-10:10,dur=Number.isFinite(audio.duration)?audio.duration:Infinity;
      audio.currentTime=Math.max(0,Math.min(dur,(audio.currentTime||0)+step));
      stopClickScheduler(panel);syncAltView(panel,true,audio.currentTime||0);
    }
  };
  window._lokalMidiKeyHandler=keyHandler;window.addEventListener("keydown",keyHandler);
  panel.title="MIDI shortcuts: ← rewind 10s · → forward 10s · Space play/stop";
  startPanelSync(panel);
  syncAltView(panel);
}
function scan(root=document){
  if(root.nodeType===1&&root.matches?.(".pianoPanel"))install(root);
  root.querySelectorAll?.(".pianoPanel").forEach(install);
}
let scanQueued=false,scanRoots=new Set;
new MutationObserver(records=>{
  for(const rec of records)for(const node of rec.addedNodes)if(node.nodeType===1)scanRoots.add(node);
  if(scanQueued)return;scanQueued=true;
  requestAnimationFrame(()=>{scanQueued=false;const roots=[...scanRoots];scanRoots.clear();roots.forEach(scan)});
}).observe(document.documentElement,{childList:true,subtree:true});
scan();
console.info(VERSION+" ready");
})();