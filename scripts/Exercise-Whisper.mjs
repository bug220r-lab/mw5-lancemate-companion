// Authorized local component smoke only. No download, microphone, playback or game access.
// Default --prepare converts/checks inputs but never starts Whisper. --run is explicit.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

const self=fileURLToPath(import.meta.url), root=path.resolve(path.dirname(self),'..');
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const checkedPath=relativePath=>{
  const p=path.resolve(root,relativePath), resolved=fs.realpathSync(p);
  if(!resolved.startsWith(root+path.sep)) throw new Error(`Path is outside project: ${relativePath}`);
  return p;
};

export function parsePcm16Mono(buffer) {
  assert.ok(Buffer.isBuffer(buffer)&&buffer.length>=44&&buffer.length<=20*1024**2,'bounded WAV required');
  assert.equal(buffer.toString('ascii',0,4),'RIFF');assert.equal(buffer.toString('ascii',8,12),'WAVE');
  assert.equal(buffer.readUInt32LE(4)+8,buffer.length,'RIFF length');
  let fmt=null,data=null,offset=12;
  while(offset+8<=buffer.length){
    const tag=buffer.toString('ascii',offset,offset+4),length=buffer.readUInt32LE(offset+4),start=offset+8;
    assert.ok(start+length<=buffer.length,'truncated WAV chunk');
    if(tag==='fmt '){assert.equal(fmt,null,'duplicate fmt');assert.ok(length>=16);fmt={format:buffer.readUInt16LE(start),channels:buffer.readUInt16LE(start+2),sampleRate:buffer.readUInt32LE(start+4),byteRate:buffer.readUInt32LE(start+8),blockAlign:buffer.readUInt16LE(start+12),bits:buffer.readUInt16LE(start+14)};}
    if(tag==='data'){assert.equal(data,null,'duplicate data');data=buffer.subarray(start,start+length);}
    offset=start+length+(length%2);
  }
  assert.equal(offset,buffer.length,'unparsed WAV trailing bytes');
  assert.ok(fmt&&data);assert.equal(fmt.format,1,'PCM only');assert.equal(fmt.channels,1,'mono only');
  assert.equal(fmt.bits,16);assert.equal(fmt.blockAlign,2);assert.equal(fmt.byteRate,fmt.sampleRate*2);
  assert.ok([16000,24000,32000,44100,48000].includes(fmt.sampleRate),'unsupported source rate');
  assert.ok(data.length>0&&data.length%2===0);
  const samples=Array.from({length:data.length/2},(_,i)=>data.readInt16LE(i*2));
  return {...fmt,frames:samples.length,durationSeconds:samples.length/fmt.sampleRate,samples};
}

export function encodePcm16Mono(samples,sampleRate=16000){
  assert.ok(samples.length>0&&Number.isSafeInteger(sampleRate)&&sampleRate>0);
  const out=Buffer.alloc(44+samples.length*2);out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);
  out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(sampleRate,24);
  out.writeUInt32LE(sampleRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(samples.length*2,40);
  samples.forEach((n,i)=>{assert.ok(Number.isFinite(n));out.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(n))),44+i*2);});
  return out;
}

export function resample16k(pcm){
  if(pcm.sampleRate===16000)return encodePcm16Mono(pcm.samples);
  const rate=16000/pcm.sampleRate,cutoff=.47*Math.min(1,rate),radius=24;
  const output=new Array(Math.round(pcm.frames*rate));
  for(let i=0;i<output.length;i++){
    const center=i/rate,first=Math.ceil(center-radius),last=Math.floor(center+radius);
    let weighted=0,weight=0;
    for(let j=first;j<=last;j++){
      if(j<0||j>=pcm.frames)continue;
      const d=center-j,x=2*cutoff*d,sinc=Math.abs(x)<1e-12?1:Math.sin(Math.PI*x)/(Math.PI*x);
      const w=2*cutoff*sinc*(.5+.5*Math.cos(Math.PI*d/radius));
      weighted+=pcm.samples[j]*w;weight+=w;
    }
    output[i]=weighted/weight;
  }
  return encodePcm16Mono(output);
}

function converterChecks(){
  const sine=frequency=>Array.from({length:24000},(_,i)=>12000*Math.sin(2*Math.PI*frequency*i/24000));
  const rms=values=>Math.sqrt(values.reduce((sum,n)=>sum+n*n/values.length,0));
  const low=parsePcm16Mono(resample16k(parsePcm16Mono(encodePcm16Mono(sine(1000),24000))));
  const high=parsePcm16Mono(resample16k(parsePcm16Mono(encodePcm16Mono(sine(10000),24000))));
  assert.equal(low.frames,16000);assert.equal(low.sampleRate,16000);
  assert.ok(Math.abs(rms(low.samples)/(12000/Math.sqrt(2))-1)<.02,'1 kHz amplitude preservation');
  assert.ok(rms(high.samples.slice(64,-64))/rms(low.samples.slice(64,-64))<.03,'alias suppression');
  assert.throws(()=>parsePcm16Mono(Buffer.alloc(44)));
  return {status:'PASS',checks:['24kHz to16kHz duration/format','1kHz RMS within2%','10kHz alias attenuation greaterthan30dB','malformed header rejected']};
}

function words(text){return text.toLowerCase().replaceAll('’',"'").replace(/[^a-z0-9'\s]/g,' ').trim().split(/\s+/).filter(Boolean);}
function wordError(reference,hypothesis){
  const a=words(reference),b=words(hypothesis);let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(a[i-1]!==b[j-1]));row=next;}
  return {referenceWords:a.length,hypothesisWords:b.length,wordEdits:row[b.length],rate:a.length?row[b.length]/a.length:null};
}
const stats=values=>{
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return {count:values.length,min:sorted[0],median:sorted.length%2?sorted[Math.floor(sorted.length/2)]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,p95NearestRank:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};
};

export function main(args=process.argv.slice(2)){
  const run=args.includes('--run'),prepare=args.includes('--prepare');
  assert.ok(!(run&&prepare),'choose --prepare or --run');
  let threads=4,python=path.join(process.env.USERPROFILE??'',' .cache'.trim(),'codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
  for(let i=0;i<args.length;i++){
    if(['--run','--prepare'].includes(args[i]))continue;
    if(args[i]==='--threads'){threads=Number(args[++i]);continue;}
    if(args[i]==='--python'){python=args[++i];continue;}
    throw new Error(`Unexpected argument: ${args[i]}`);
  }
  assert.ok([2,4].includes(threads),'thread count must be2or4');assert.ok(path.isAbsolute(python)&&fs.existsSync(python),'bundled Python path required');
  const runId=new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
  const outputParent=path.join(root,'companion/local/whisper-benchmark');fs.mkdirSync(outputParent,{recursive:true});
  const outputDir=path.join(outputParent,runId);fs.mkdirSync(outputDir);
  const report={schemaVersion:1,classification:'LOCAL_COMPONENT_BENCHMARK',runId,startedAt:new Date().toISOString(),
    status:run?'RUNNING':'PREPARING',execution:'NOT_PERFORMED',mode:'CPU_ONLY',threads,clips:[],
    gameWorkload:'NOT_PERFORMED',humanRecordingAcceptance:'NOT_PERFORMED',microphoneCapture:false,automaticPlayback:false,
    networkCalls:0,paidApiCalls:0,limits:['Six existing synthetic Zira clips, not100 human command recordings.',
      'Per-clip new-process wall time includes model load; not push-to-talk or in-game latency.',
      'Background activity is uncontrolled (other installation work may occur); no matched game workload.',
      'Word error is against the source script; no intent, recipient, natural-speech or noisy-game acceptance.'],
    host:{platform:process.platform,arch:process.arch,cpuModel:os.cpus()[0]?.model??null,logicalProcessors:os.cpus().length,totalRamBytes:os.totalmem(),availableRamBytesAtStart:os.freemem()},
    script:{file:relative(self),sha256:sha(fs.readFileSync(self))}};
  const persist=()=>{
    const text=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(path.join(outputDir,'report.json'),text);
    fs.writeFileSync(path.join(root,'research/WHISPER_COMPONENT_BENCHMARK.json'),text);
  };
  try{
    const lockPath=checkedPath('companion/models.lock.json'),lock=readJson(lockPath),runtimeInventoryPath=checkedPath('companion/local/runtimes/runtime-files.json');
    const runtimeLock=lock.artifacts.find(x=>x.id==='whisper-cpu'),modelLock=lock.artifacts.find(x=>x.id==='whisper-base-en');
    assert.ok(runtimeLock&&modelLock);assert.equal(runtimeLock.version,'b5130');
    const model=checkedPath(`companion/local/models/${modelLock.name}`),archive=checkedPath(`companion/local/models/${runtimeLock.name}`);
    for(const [file,pinned]of[[model,modelLock],[archive,runtimeLock]]){
      assert.equal(fs.statSync(file).size,pinned.bytes);assert.equal(sha(fs.readFileSync(file)),pinned.sha256);
    }
    const runtime=checkedPath('companion/local/runtimes/whisper-cpu-b5130/Release/whisper-cli.exe');
    const runtimeFiles=readJson(runtimeInventoryPath).files.filter(x=>x.artifact==='whisper-cpu'&&(/\.dll$/i.test(x.path)||path.resolve(root,x.path)===runtime));
    assert.ok(runtimeFiles.some(x=>path.resolve(root,x.path)===runtime),'executable missing from verified inventory');
    for(const file of runtimeFiles){const actual=checkedPath(file.path);assert.equal(fs.statSync(actual).size,file.bytes);assert.equal(sha(fs.readFileSync(actual)),file.sha256);}
    report.artifacts={lock:{file:relative(lockPath),sha256:sha(fs.readFileSync(lockPath))},runtimeArchive:runtimeLock,model:modelLock,runtimeFiles,
      runtimeInventory:{file:relative(runtimeInventoryPath),sha256:sha(fs.readFileSync(runtimeInventoryPath))}};
    report.converter={method:'project-authored48-tap Hann-windowed sinc low-pass resampling to16kHz PCM16mono',selfChecks:converterChecks()};
    const textManifestPath=checkedPath('synthetic/zira-audition.json'),lines=readJson(textManifestPath).lines;
    assert.deepEqual(lines.map(x=>x.id),['VA-001','VA-002','VA-003','VA-004','VA-005','VA-006']);
    report.textManifest={file:relative(textManifestPath),sha256:sha(fs.readFileSync(textManifestPath))};
    for(const line of lines){
      const source=checkedPath(`audio/zira-audition-001/${line.id}-clean.wav`),sourceBuffer=fs.readFileSync(source),pcm=parsePcm16Mono(sourceBuffer);
      const output=path.join(outputDir,`${line.id}-16k.wav`),converted=resample16k(pcm);fs.writeFileSync(output,converted,{flag:'wx'});
      const result=parsePcm16Mono(converted);assert.ok(Math.abs(result.durationSeconds-pcm.durationSeconds)<=1/16000);
      report.clips.push({id:line.id,referenceText:line.text,status:'PREPARED',source:{file:relative(source),sha256:sha(sourceBuffer),sampleRate:pcm.sampleRate,frames:pcm.frames,durationSeconds:pcm.durationSeconds},
        prepared:{file:relative(output),sha256:sha(converted),sampleRate:result.sampleRate,frames:result.frames,durationSeconds:result.durationSeconds}});
    }
    const validationCode=`import sys,json,wave,hashlib,struct,platform\nrows=[]\nfor p in sys.argv[1:]:\n with wave.open(p,'rb') as w:\n  assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getframerate()==16000 and w.getcomptype()=='NONE'\n  n=w.getnframes(); raw=w.readframes(n); assert len(raw)==n*2 and n>0\n  vals=struct.unpack('<%dh'%n,raw); peak=max(abs(x) for x in vals); assert peak>0\n  rows.append({'file':p,'frames':n,'sampleRate':16000,'channels':1,'bits':16,'peakAbs':peak,'clippedSamples':sum(abs(x)>=32767 for x in vals),'sha256':hashlib.sha256(open(p,'rb').read()).hexdigest()})\nprint(json.dumps({'status':'PASS','pythonVersion':platform.python_version(),'files':rows}))`;
    const py=spawnSync(python,['-c',validationCode,...report.clips.map(x=>path.join(root,x.prepared.file))],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    assert.equal(py.status,0,`independent WAV validation failed: ${py.stderr}`);
    report.converter.independentPythonValidation=JSON.parse(py.stdout);
    for(let i=0;i<report.clips.length;i++)assert.equal(report.converter.independentPythonValidation.files[i].sha256,report.clips[i].prepared.sha256);
    if(!run){report.status='PREPARED';report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,execution:report.execution,report:'research/WHISPER_COMPONENT_BENCHMARK.json'}));return report;}
    const help=spawnSync(runtime,['--help'],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    const helpText=(help.stdout??'')+(help.stderr??'');fs.writeFileSync(path.join(outputDir,'whisper-help.txt'),helpText);
    for(const flag of ['--no-gpu','--threads','--model','--file','--output-txt','--output-json','--output-file'])assert.ok(helpText.includes(flag),`pinned executable does not document ${flag}`);
    report.execution='RUNNING';report.help={exitCode:help.status,file:relative(path.join(outputDir,'whisper-help.txt')),sha256:sha(Buffer.from(helpText))};persist();
    for(const clip of report.clips){
      const prefix=path.join(outputDir,clip.id),arguments_=['--model',model,'--file',path.join(root,clip.prepared.file),'--threads',String(threads),'--language','en','--no-gpu','--output-txt','--output-json','--output-file',prefix];
      clip.arguments=arguments_;clip.startedAt=new Date().toISOString();const started=performance.now();
      const child=spawnSync(runtime,arguments_,{cwd:path.dirname(runtime),encoding:'utf8',windowsHide:true,shell:false,timeout:120000,maxBuffer:4*1024*1024,env:{...process.env,OMP_NUM_THREADS:String(threads),MKL_NUM_THREADS:String(threads)}});
      clip.wallTimeMs=Number((performance.now()-started).toFixed(3));clip.completedAt=new Date().toISOString();clip.exitCode=child.status;clip.signal=child.signal;clip.error=child.error?.message??null;
      for(const [label,text]of[['stdout',child.stdout??''],['stderr',child.stderr??'']]){const file=`${prefix}.${label}.log`;fs.writeFileSync(file,text);clip[label]={file:relative(file),sha256:sha(Buffer.from(text))};}
      clip.timingLines=(child.stderr??'').split(/\r?\n/).filter(s=>/time\s*=|n_threads\s*=|use gpu\s*=/i.test(s));
      clip.noGpuLogConfirmed=/use gpu\s*=\s*0/i.test(child.stderr??'');
      if(child.status!==0||child.error){clip.status='FAILED';persist();throw new Error(`${clip.id}: Whisper exited unsuccessfully`);}
      const transcriptPath=`${prefix}.txt`,jsonPath=`${prefix}.json`;
      assert.ok(fs.existsSync(transcriptPath)&&fs.existsSync(jsonPath),'missing native output artifacts');
      clip.transcript=fs.readFileSync(transcriptPath,'utf8').trim();
      clip.outputs=[transcriptPath,jsonPath].map(file=>({file:relative(file),sha256:sha(fs.readFileSync(file)),bytes:fs.statSync(file).size}));
      clip.wordError=wordError(clip.referenceText,clip.transcript);clip.realTimeFactor=clip.wallTimeMs/(clip.prepared.durationSeconds*1000);
      clip.status=clip.transcript?'TRANSCRIBED':'EMPTY_TRANSCRIPT';persist();
      console.log(JSON.stringify({clip:clip.id,status:clip.status,wallTimeMs:clip.wallTimeMs,transcript:clip.transcript}));
    }
    report.execution='PERFORMED_CPU_ONLY';report.status=report.clips.every(x=>x.status==='TRANSCRIBED')?'SMOKE_COMPLETED':'SMOKE_WITH_EMPTY_TRANSCRIPT';
    const totalWords=report.clips.reduce((n,c)=>n+c.wordError.referenceWords,0),totalEdits=report.clips.reduce((n,c)=>n+c.wordError.wordEdits,0);
    report.summary={clipCount:report.clips.length,totalSourceAudioSeconds:report.clips.reduce((n,c)=>n+c.source.durationSeconds,0),wallTimeMs:stats(report.clips.map(x=>x.wallTimeMs)),realTimeFactor:stats(report.clips.map(x=>x.realTimeFactor)),wordEdits:totalEdits,referenceWords:totalWords,aggregateWordErrorRate:totalEdits/totalWords,
      noGpuLogConfirmedForEveryClip:report.clips.every(x=>x.noGpuLogConfirmed),releaseAcceptance:'NOT_PERFORMED'};
    report.completedAt=new Date().toISOString();report.host.availableRamBytesAtEnd=os.freemem();persist();
    console.log(JSON.stringify({status:report.status,summary:report.summary,report:'research/WHISPER_COMPONENT_BENCHMARK.json'}));return report;
  }catch(error){report.status='FAILED';report.failure=error.message;report.completedAt=new Date().toISOString();persist();throw error;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===self){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
