// Project-authored, explicit CPU component benchmark. No microphone, playback or game.
// Imports and no-argument invocation never start a native process.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {parsePcm16Mono} from './Exercise-Whisper.mjs';

const self=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(self),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const checked=p=>{const absolute=path.resolve(root,p),real=fs.realpathSync(absolute);assert.ok(real.startsWith(root+path.sep),'outside project');return absolute;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stats=values=>{const a=[...values].sort((x,y)=>x-y);return {count:a.length,min:a[0],median:(a[2]+a[3])/2,p95NearestRank:a[Math.ceil(a.length*.95)-1],max:a.at(-1)};};
const words=s=>s.toLowerCase().replaceAll('’',"'").replace(/[^a-z0-9'\s]/g,' ').trim().split(/\s+/).filter(Boolean);
function wordError(reference,text){const a=words(reference),b=words(text);let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(a[i-1]!==b[j-1]));row=next;}return {referenceWords:a.length,wordEdits:row[b.length]};}
async function ephemeralPort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));return port;}
async function boundedText(response,max=65536){assert.ok(response.body,'missing response body');const reader=response.body.getReader();let bytes=0,out='';try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;assert.ok(bytes<=max,'response too large');out+=Buffer.from(value).toString('utf8');}return out;}finally{await reader.cancel().catch(()=>{});}}

// Read-only preflight, independently callable without help, inference or receipt writes.
export function verifyWarmPreflight(){
  const lockPath=checked('companion/models.lock.json'),lock=read(lockPath),inventoryPath=checked('companion/whisper-runtime-pins.json');
  const modelPin=lock.artifacts.find(x=>x.id==='whisper-base-en'),runtimePin=lock.artifacts.find(x=>x.id==='whisper-cpu');
  assert.equal(runtimePin.version,'b5130');
  const model=checked(`companion/local/models/${modelPin.name}`),archive=checked(`companion/local/models/${runtimePin.name}`);
  for(const [file,pin]of[[model,modelPin],[archive,runtimePin]]){assert.equal(fs.statSync(file).size,pin.bytes);assert.equal(sha(fs.readFileSync(file)),pin.sha256);}
  const pins=read(inventoryPath);assert.equal(pins.schemaVersion,1);assert.equal(pins.artifact,'whisper-cpu');assert.equal(pins.version,runtimePin.version);
  assert.equal(pins.archiveSha256,runtimePin.sha256);assert.equal(pins.archiveBytes,runtimePin.bytes);assert.equal(pins.source,runtimePin.url);assert.equal(pins.files.length,40);
  const runtimeDir=checked('companion/local/runtimes/whisper-cpu-b5130/Release');
  const names=new Set();
  const files=pins.files.map(pin=>{
    assert.match(pin.name,/^[a-zA-Z0-9_-]+\.(dll|exe)$/i);assert.equal(pin.archiveEntry,'Release/'+pin.name);
    assert.ok(!names.has(pin.name.toLowerCase()),'duplicate runtime pin');names.add(pin.name.toLowerCase());
    assert.ok(Number.isSafeInteger(pin.bytes)&&pin.bytes>0);assert.match(pin.sha256,/^[a-f0-9]{64}$/);
    const actual=checked(path.join(runtimeDir,pin.name));assert.equal(fs.realpathSync(actual),path.join(fs.realpathSync(runtimeDir),pin.name));
    assert.equal(fs.statSync(actual).size,pin.bytes);assert.equal(sha(fs.readFileSync(actual)),pin.sha256);
    return {artifact:'whisper-cpu',path:rel(actual),bytes:pin.bytes,sha256:pin.sha256,archiveEntry:pin.archiveEntry};
  });
  const actualEntries=fs.readdirSync(runtimeDir,{withFileTypes:true});
  assert.equal(actualEntries.length,names.size,'runtime inventory differs');
  for(const entry of actualEntries)assert.ok(entry.isFile()&&!entry.isSymbolicLink()&&names.has(entry.name.toLowerCase()),'uninventoried runtime entry');
  const runtime=checked(path.join(runtimeDir,'whisper-server.exe'));assert.ok(names.has('whisper-server.exe'));
  return {model,runtime,verification:{status:'PASS',model:modelPin,runtimeArchive:runtimePin,runtimeFiles:files,inventoryFile:rel(inventoryPath),inventoryProvenance:'TRACKED_PINNED_ZIP_PAYLOAD_HASHES',inventorySha256:sha(fs.readFileSync(inventoryPath)),sourceLockSha256:sha(fs.readFileSync(lockPath))}};
}

export async function main(args=process.argv.slice(2)){
  if(args.length===0){console.log('Explicit --run benchmarks six existing synthetic clips on CPU. No download, microphone or playback.');return;}
  assert.deepEqual(args,['--run'],'only --run is supported');
  const report={schemaVersion:1,classification:'LOCAL_COMPONENT_BENCHMARK_SYNTHETIC_INPUT',startedAt:new Date().toISOString(),status:'VERIFYING',execution:'NOT_PERFORMED',threads:4,mode:'CPU_ONLY',clips:[],
    microphoneCapture:false,automaticPlayback:false,gameWorkload:'NOT_PERFORMED',humanRecordingAcceptance:'NOT_PERFORMED',uiIntegration:'NOT_PERFORMED',paidApiCalls:0,externalNetworkCalls:0,
    host:{platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,totalRamBytes:os.totalmem(),availableRamBytesAtStart:os.freemem()},
    script:{file:rel(self),sha256:sha(fs.readFileSync(self))},
    sources:[{url:'https://github.com/ggml-org/whisper.cpp/blob/b5130/examples/server/server.cpp',accessedAt:'2026-09-21',locations:['52-65 server options','697-699 wildcard CORS','766-832 inference upload and reset','1093-1141 load and health','1165-1179 binding']},
      {url:'https://github.com/ggml-org/whisper.cpp/blob/b5130/examples/server/README.md',accessedAt:'2026-09-21',locations:['67-85 request examples']}],
    limits:['Six synthetic Zira clips; nearest-rank p95 is the maximum of only six samples.',
      'Warm means one resident model after readiness, with no discarded warm-up clip. Startup time recorded separately.',
      'HTTP upload-to-complete-response latency; no PTT capture, intent parsing, game workload or human recording acceptance.',
      'Cold CLI comparison is historical, not randomized or matched for background CPU load; server and CLI default decoding may differ.',
      'Runtime files match the tracked inventory derived from the pinned official release ZIP; current preflight performs no model inference.',
      'Unmodified server has no verified authentication, wildcard CORS, model-load and fallback HTML routes. Random path is not authentication.',
      'Request timeout cancels this client; native inference cancellation on disconnect is unproven. Finally terminates the owned process.']};
  const output=path.join(root,'research/WARM_WHISPER_COMPONENT_BENCHMARK.json');
  const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  let child=null,closed=null,logs='',spawnError=null,prefix='',base='',exited=false;
  const redact=s=>s.replaceAll(root,'<PROJECT>').replaceAll(prefix||'__not_a_path__','/<EPHEMERAL_PATH>');
  try{
    const {model,runtime,verification}=verifyWarmPreflight();report.verification=verification;
    const coldPath=checked('research/WHISPER_COMPONENT_BENCHMARK.json'),cold=read(coldPath);assert.equal(cold.clips.length,6);
    assert.deepEqual(cold.clips.map(c=>c.id),['VA-001','VA-002','VA-003','VA-004','VA-005','VA-006']);
    const clips=cold.clips.map(c=>{const file=checked(c.prepared.file),buffer=fs.readFileSync(file),pcm=parsePcm16Mono(buffer);assert.equal(sha(buffer),c.prepared.sha256);assert.equal(pcm.sampleRate,16000);return {id:c.id,referenceText:c.referenceText,prepared:c.prepared,coldWallTimeMs:c.wallTimeMs,buffer};});
    report.coldComparison={file:rel(coldPath),sha256:sha(fs.readFileSync(coldPath)),summary:cold.summary};
    const help=spawnSync(runtime,['--help'],{encoding:'utf8',windowsHide:true,shell:false,timeout:15000,maxBuffer:1048576});
    assert.equal(help.status,0);const helpText=(help.stdout??'')+(help.stderr??'');
    for(const flag of ['--host','--port','--request-path','--public','--no-gpu','--threads','--model'])assert.ok(helpText.includes(flag));
    report.help={status:'PASS',sha256:sha(Buffer.from(helpText)),text:redact(helpText)};
    const port=await ephemeralPort();prefix='/bench-'+randomBytes(24).toString('hex');base=`http://127.0.0.1:${port}${prefix}`;
    const publicPath=path.join(path.dirname(runtime),'nonexistent-benchmark-public');assert.ok(!fs.existsSync(publicPath));
    const argsNative=['--model',model,'--threads','4','--processors','1','--language','en','--no-gpu','--host','127.0.0.1','--port',String(port),'--request-path',prefix,'--public',publicPath];
    report.transport={bind:'127.0.0.1',port,ephemeralRandomRequestPath:true,authentication:'UNSUPPORTED_IN_INSPECTED_SERVER',conversion:false,staticPublicDirectory:'NONEXISTENT',fallbackHtmlRoute:'STILL_PRESENT',tls:false};
    report.arguments=argsNative.map(redact);report.execution='RUNNING';report.status='STARTING';persist();
    const started=performance.now();
    child=spawn(runtime,argsNative,{cwd:path.dirname(runtime),windowsHide:true,shell:false,stdio:['ignore','pipe','pipe'],env:{...process.env,OMP_NUM_THREADS:'4',MKL_NUM_THREADS:'4'}});
    report.processId=child.pid??null;
    closed=new Promise(resolve=>{child.once('error',error=>{spawnError=error;});child.once('close',(code,signal)=>{exited=true;report.processExit={code,signal};resolve();});});
    for(const stream of[child.stdout,child.stderr])stream.on('data',chunk=>{logs=(logs+chunk.toString('utf8')).slice(-65536);});
    let ready=false;
    while(performance.now()-started<30000){
      if(exited||spawnError)throw new Error('owned server failed during startup');
      try{const response=await fetch(base+'/health',{signal:AbortSignal.timeout(500),redirect:'error'});if(response.ok&&JSON.parse(await boundedText(response,4096)).status==='ok'){ready=true;break;}}catch{}
      await delay(100);
    }
    assert.ok(ready,'server readiness deadline');report.startupToReadyMs=Number((performance.now()-started).toFixed(3));
    report.status='BENCHMARKING';persist();
    for(const clip of clips){
      assert.ok(!exited&&!spawnError,'owned server unavailable');
      const form=new FormData();form.set('file',new Blob([clip.buffer],{type:'audio/wav'}),`${clip.id}.wav`);form.set('response_format','json');form.set('temperature','0.0');
      const begin=performance.now(),response=await fetch(base+'/inference',{method:'POST',body:form,signal:AbortSignal.timeout(30000),redirect:'error'});
      const raw=await boundedText(response),wallTimeMs=Number((performance.now()-begin).toFixed(3));assert.equal(response.status,200);
      const payload=JSON.parse(raw);assert.equal(typeof payload.text,'string');assert.ok(payload.text.length>0&&payload.text.length<=4096);
      const transcript=payload.text.trim(),entry={id:clip.id,referenceText:clip.referenceText,prepared:clip.prepared,wallTimeMs,transcript,wordError:wordError(clip.referenceText,transcript),coldWallTimeMs:clip.coldWallTimeMs,improvementVsColdMs:Number((clip.coldWallTimeMs-wallTimeMs).toFixed(3)),responseSha256:sha(Buffer.from(raw)),status:'TRANSCRIBED'};
      report.clips.push(entry);persist();console.log(JSON.stringify({id:entry.id,wallTimeMs,transcript}));
    }
    const wordEdits=report.clips.reduce((s,c)=>s+c.wordError.wordEdits,0),referenceWords=report.clips.reduce((s,c)=>s+c.wordError.referenceWords,0),timing=stats(report.clips.map(c=>c.wallTimeMs));
    report.summary={clipCount:6,wallTimeMs:timing,recognitionTargetMs:1500,observedSampleP95MeetsTarget:timing.p95NearestRank<=1500,wordEdits,referenceWords,aggregateWordErrorRate:wordEdits/referenceWords,coldP95Ms:cold.summary.wallTimeMs.p95NearestRank,p95ImprovementPercent:100*(1-timing.p95NearestRank/cold.summary.wallTimeMs.p95NearestRank),releaseAcceptance:'NOT_PERFORMED'};
    report.execution='PERFORMED_CPU_ONLY';report.status='SMOKE_COMPLETED';
  }catch(error){report.status='FAILED';report.failure=error.message;process.exitCode=1;}
  finally{
    if(child&&!exited){child.kill();await Promise.race([closed,delay(3000)]);if(!exited){child.kill('SIGKILL');await Promise.race([closed,delay(3000)]);}}
    report.ownedProcessStopped=child?exited:true;
    report.logs={text:redact(logs),boundedTailBytes:65536,noGpuLogConfirmed:/use gpu\s*=\s*0/i.test(logs)};
    if(child&&!exited){report.status='FAILED';report.failure='Owned process termination not confirmed';process.exitCode=1;}
    report.completedAt=new Date().toISOString();report.host.availableRamBytesAtEnd=os.freemem();persist();
  }
  console.log(JSON.stringify({status:report.status,summary:report.summary,ownedProcessStopped:report.ownedProcessStopped,report:rel(output)}));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===self)await main();
