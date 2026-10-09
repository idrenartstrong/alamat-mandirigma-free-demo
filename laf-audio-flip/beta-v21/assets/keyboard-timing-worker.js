const N = 2048;
const HOP = 128;
const TARGET_SR = 11025;
const MIDI_MIN = 36;
const MIDI_MAX = 96;
const MAX_POLY = 8;

function fft(re, im) {
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tr=re[i]; re[i]=re[j]; re[j]=tr;
      let ti=im[i]; im[i]=im[j]; im[j]=ti;
    }
  }
  for (let len=2; len<=N; len<<=1) {
    const ang=-2*Math.PI/len;
    const wlr=Math.cos(ang), wli=Math.sin(ang);
    for (let i=0; i<N; i+=len) {
      let wr=1, wi=0;
      for (let k=0; k<len/2; k++) {
        const ur=re[i+k], ui=im[i+k];
        const vr=re[i+k+len/2]*wr-im[i+k+len/2]*wi;
        const vi=re[i+k+len/2]*wi+im[i+k+len/2]*wr;
        re[i+k]=ur+vr; im[i+k]=ui+vi;
        re[i+k+len/2]=ur-vr; im[i+k+len/2]=ui-vi;
        const nwr=wr*wlr-wi*wli;
        wi=wr*wli+wi*wlr; wr=nwr;
      }
    }
  }
}
function binMag(re,im,bin) {
  const b=Math.max(1,Math.min(N/2-2,Math.round(bin)));
  let best=0;
  for(let d=-1;d<=1;d++){
    const rr=re[b+d],ii=im[b+d];
    const m=rr*rr+ii*ii;
    if(m>best)best=m;
  }
  return Math.sqrt(best);
}
function downsample2(src) {
  const out=new Float32Array(Math.floor(src.length/2));
  for(let i=0,j=0;j<out.length;i+=2,j++) out[j]=(src[i]+src[i+1])*0.5;
  return out;
}
const midiFreq=Array.from({length:128},(_,m)=>440*Math.pow(2,(m-69)/12));
const hann=new Float64Array(N);
for(let i=0;i<N;i++)hann[i]=0.5-0.5*Math.cos(2*Math.PI*i/(N-1));
const midiBins=Array.from({length:128},(_,m)=>{
  const b1=midiFreq[m]*N/TARGET_SR;
  return {
    b1:Math.round(b1),
    b2:2*b1<N/2?Math.round(2*b1):0,
    b3:3*b1<N/2?Math.round(3*b1):0
  };
});
function median(a,scratch){
  scratch.set(a);scratch.sort();
  return scratch[Math.floor(scratch.length/2)]||0;
}
function findGridPhase(onset, bpm, secPerFrame) {
  const sixteenth=60/Math.max(30,bpm)/4;
  const framesPer=sixteenth/secPerFrame;
  const maxPhase=Math.max(1,Math.round(framesPer));
  let bestPhase=0,bestScore=-Infinity;
  for(let p=0;p<maxPhase;p++){
    let score=0;
    for(let f=p;f<onset.length;f+=framesPer){
      const i=Math.round(f);
      score+=(onset[i]||0)*1.0+(onset[i-1]||0)*0.35+(onset[i+1]||0)*0.35;
    }
    if(score>bestScore){bestScore=score;bestPhase=p;}
  }
  return bestPhase*secPerFrame;
}
function nearestOnsetFrame(onset, frame, radius=4) {
  let best=Math.max(0,Math.min(onset.length-1,Math.round(frame)));
  let val=onset[best]||0;
  const lo=Math.max(0,best-radius),hi=Math.min(onset.length-1,best+radius);
  for(let i=lo;i<=hi;i++) if((onset[i]||0)>val){val=onset[i];best=i;}
  return best;
}
function snapTime(t, phase, step) {
  const k=Math.round((t-phase)/step);
  return Math.max(0,phase+k*step);
}
self.onmessage=async ev=>{
  const {id,audio,params={}}=ev.data||{};
  try{
    const src22=new Float32Array(audio);
    const src=downsample2(src22);
    const bpm=Math.max(30,Math.min(300,Number(params.bpm)||120));
    const secPerFrame=HOP/TARGET_SR;
    const totalFrames=Math.max(1,Math.floor((src.length-N)/HOP)+1);
    const re=new Float32Array(N),im=new Float32Array(N);
    const scores=new Float32Array(MIDI_MAX-MIDI_MIN+1);
    const medianScratch=new Float32Array(scores.length);
    const prevScores=new Float32Array(scores.length);
    const onset=new Float32Array(totalFrames);
    const active=Array.from({length:128},()=>({on:false,hits:0,miss:0,start:0,amp:0,count:0}));
    const rawNotes=[];
    const sens=(params.noteSensitivity??68)/100;
    const split=(params.splitSensitivity??58)/100;
    const ratio=Math.max(0.085,0.19-sens*0.11);
    const releaseFrames=split>0.70?4:split>0.45?5:6;
    self.postMessage({type:'status',id,stage:'Timing analysis · '+Math.round(bpm)+' BPM'});
    let prevRms=0;
    for(let f=0;f<totalFrames;f++){
      const base=f*HOP;
      let rms=0;
      for(let i=0;i<N;i++){
        const x=src[base+i]||0;
        rms+=x*x;
        re[i]=x*hann[i]; im[i]=0;
      }
      rms=Math.sqrt(rms/N);
      fft(re,im);
      let frameMax=0,scoreSum=0,flux=0;
      for(let m=MIDI_MIN;m<=MIDI_MAX;m++){
        const idx=m-MIDI_MIN,bins=midiBins[m];
        const fundamental=binMag(re,im,bins.b1);
        const h2=bins.b2?binMag(re,im,bins.b2):0;
        const h3=bins.b3?binMag(re,im,bins.b3):0;
        const score=fundamental+0.24*h2+0.10*h3;
        scores[idx]=score; scoreSum+=score;
        if(score>frameMax)frameMax=score;
        const d=score-prevScores[idx]; if(d>0)flux+=d;
      }
      onset[f]=(flux/(scoreSum+1e-9))*0.8+Math.max(0,rms-prevRms)/(rms+1e-7)*0.2;
      prevRms=rms; prevScores.set(scores);
      const med=median(scores,medianScratch);
      const threshold=Math.max(frameMax*ratio,med*(2.7+split*1.3),rms*4.2);
      const candidates=[];
      for(let m=MIDI_MIN;m<=MIDI_MAX;m++){
        const idx=m-MIDI_MIN,s=scores[idx];
        if(s<=threshold)continue;
        const left=idx>0?scores[idx-1]:0,right=idx<scores.length-1?scores[idx+1]:0;
        if(s<left||s<right)continue;
        candidates.push([s,m]);
      }
      candidates.sort((a,b)=>b[0]-a[0]);
      const selected=new Set(candidates.slice(0,MAX_POLY).map(x=>x[1]));
      for(let m=MIDI_MIN;m<=MIDI_MAX;m++){
        const idx=m-MIDI_MIN,st=active[m],isOn=selected.has(m);
        if(isOn){
          st.hits++;st.miss=0;
          if(!st.on&&st.hits>=3){st.on=true;st.start=Math.max(0,f-1);st.amp=0;st.count=0;}
          if(st.on){st.amp+=Math.min(1,scores[idx]/(frameMax||1));st.count++;}
        }else{
          st.hits=0;
          if(st.on&&++st.miss>=releaseFrames){
            const end=Math.max(st.start+1,f-releaseFrames+1);
            rawNotes.push({pitchMidi:m,startFrame:st.start,endFrame:end,amp:st.count?st.amp/st.count:0.6});
            st.on=false;st.miss=0;st.amp=0;st.count=0;
          }
        }
      }
      if(f%12===0)self.postMessage({type:'progress',id,progress:f/totalFrames*0.88});
      if(f%192===0)await new Promise(r=>setTimeout(r,0));
    }
    for(let m=MIDI_MIN;m<=MIDI_MAX;m++){
      const st=active[m];
      if(st.on)rawNotes.push({pitchMidi:m,startFrame:st.start,endFrame:totalFrames,amp:st.count?st.amp/st.count:0.6});
    }
    self.postMessage({type:'status',id,stage:'Locking notes to '+Math.round(bpm)+' BPM grid'});
    self.postMessage({type:'progress',id,progress:0.90});
    const phase=findGridPhase(onset,bpm,secPerFrame);
    const quantStep=60/bpm/4;
    const grid=[];
    for(let t=phase;t<src.length/TARGET_SR;t+=quantStep){
      const f=Math.round(t/secPerFrame);
      const strength=(onset[f]||0)+(onset[f-1]||0)*0.45+(onset[f+1]||0)*0.45;
      grid.push({t,strength});
    }
    const ranked=grid.map(x=>x.strength).sort((a,b)=>a-b);
    const onsetGate=ranked[Math.floor(ranked.length*0.68)]||0;
    const events=[];
    for(let g=1;g<grid.length-1;g++){
      const x=grid[g];
      if(x.strength>=onsetGate&&x.strength>=grid[g-1].strength&&x.strength>=grid[g+1].strength)events.push(x.t);
    }
    const snapTrigger=t=>{
      let best=snapTime(t,phase,quantStep),dist=Math.abs(best-t);
      for(const e of events){
        const d=Math.abs(e-t);
        if(d<dist&&d<=quantStep*1.6){best=e;dist=d;}
        if(e>t+quantStep*1.6)break;
      }
      return best;
    };
    const minDur=Math.max(quantStep,(params.minNoteMs??70)/1000);
    const timed=[];
    for(const n of rawNotes){
      const refinedStart=nearestOnsetFrame(onset,n.startFrame,4)*secPerFrame;
      let start=snapTrigger(refinedStart);
      let rawEnd=n.endFrame*secPerFrame;
      let end=snapTime(rawEnd,phase,quantStep);
      if(end-start<minDur)end=start+Math.max(minDur,quantStep);
      timed.push({
        pitchMidi:n.pitchMidi,
        startTimeSeconds:start,
        durationSeconds:end-start,
        amplitude:Math.max(0.15,Math.min(1,n.amp))
      });
    }
    const byPitch=new Map();
    for(const n of timed){
      if(!byPitch.has(n.pitchMidi))byPitch.set(n.pitchMidi,[]);
      byPitch.get(n.pitchMidi).push(n);
    }
    const merged=[];
    for(const arr of byPitch.values()){
      arr.sort((a,b)=>a.startTimeSeconds-b.startTimeSeconds);
      let prev=null;
      for(const n of arr){
        const prevEnd=prev?prev.startTimeSeconds+prev.durationSeconds:0;
        const retrigger=events.some(e=>Math.abs(e-n.startTimeSeconds)<=quantStep*0.22);
        if(prev&&n.startTimeSeconds<=prevEnd+quantStep*0.35&&!retrigger){
          const end=Math.max(prevEnd,n.startTimeSeconds+n.durationSeconds);
          prev.durationSeconds=end-prev.startTimeSeconds;
          prev.amplitude=Math.max(prev.amplitude,n.amplitude);
        }else{
          if(prev&&retrigger&&n.startTimeSeconds<prevEnd){
            prev.durationSeconds=Math.max(quantStep,n.startTimeSeconds-prev.startTimeSeconds);
          }
          prev={...n};merged.push(prev);
        }
      }
    }
    merged.sort((a,b)=>a.startTimeSeconds-b.startTimeSeconds||a.pitchMidi-b.pitchMidi);
    const groups=new Map();
    for(const n of merged){
      const key=Math.round((n.startTimeSeconds-phase)/quantStep);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(n);
    }
    const filtered=[];
    for(const group of groups.values()){
      group.sort((a,b)=>b.amplitude-a.amplitude);
      const keep=group.slice(0,7);
      const ends=keep.map(n=>n.startTimeSeconds+n.durationSeconds).sort((a,b)=>a-b);
      const medEnd=ends[Math.floor(ends.length/2)]||0;
      for(const n of keep){
        const end=n.startTimeSeconds+n.durationSeconds;
        if(keep.length>1&&Math.abs(end-medEnd)<=quantStep*1.05)n.durationSeconds=Math.max(quantStep,medEnd-n.startTimeSeconds);
        filtered.push(n);
      }
    }
    filtered.sort((a,b)=>a.startTimeSeconds-b.startTimeSeconds||a.pitchMidi-b.pitchMidi);
    const out=filtered
      .filter(n=>n.durationSeconds>=Math.min(minDur,quantStep))
      .map((n,i)=>({...n,id:i}));
    self.postMessage({type:'progress',id,progress:1});
    self.postMessage({type:'status',id,stage:'Timing locked · '+Math.round(bpm)+' BPM · 1/16 grid'});
    self.postMessage({type:'result',id,notes:out,bpm,phase,quantStep});
  }catch(error){
    self.postMessage({type:'error',id,message:error?.message||String(error),stack:error?.stack||''});
  }
};
