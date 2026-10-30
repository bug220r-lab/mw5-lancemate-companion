// Opt-in project component: retained local ASR over inherited pipes only.
// Not connected to the workbench. Import/construction never starts a worker.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import bootstrapPins from './runtime-bootstrap-pins.json' with { type: 'json' };
import { RUNTIME_ROOT, requireRuntimeConfiguration, verifyRuntimeDirectory } from './runtime-paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKER = path.join(ROOT, 'companion', 'resident_recognition_worker.py');
const PYTHON_ROOT = path.join(RUNTIME_ROOT, 'python');
// Independent source/ABI review: research/RESIDENT_RECOGNITION_WORKER_REVIEW.md.
const WORKER_SHA256 = 'a2053464cf54e23c159625ea2cd91e516613560b8cb076e92ad85df09c448cc5';
const PYTHON_PINS = bootstrapPins.python.files;
const GiB = 1024 ** 3, MODE = 'RESIDENT_PIPE_TRANSCRIPTION_ONLY';
const fault = code => Object.assign(new Error(code), { code });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject,settled:false}; };
const ownOptions = (x, keys) => x && Object.getPrototypeOf(x) === Object.prototype && Reflect.ownKeys(x).every(k =>
  typeof k === 'string' && keys.includes(k) && Object.hasOwn(Object.getOwnPropertyDescriptor(x,k), 'value'));
const exact = (x, keys) => ownOptions(x, keys) && Object.keys(x).length === keys.length;
const WORKER_ERRORS = new Set(['INVALID_REQUEST','FRAME_TOO_LARGE','INVALID_WAV','REPLAYED_ID','UNSUPPORTED_PLATFORM',
  'ABI_MISMATCH','INSTALLATION_REJECTED','NATIVE_INIT_FAILED','NATIVE_DECODE_FAILED','INVALID_TRANSCRIPT','RESPONSE_TOO_LARGE','WORKER_FAILED']);

function waveCopy(input) {
  if (!Buffer.isBuffer(input) || input.length < 3244 || input.length > 480044) throw fault('INVALID_RECOGNITION_WAV');
  const b = Buffer.from(input);
  if (b.toString('ascii',0,4)!=='RIFF' || b.readUInt32LE(4)!==b.length-8 || b.toString('ascii',8,16)!=='WAVEfmt ' ||
      b.readUInt32LE(16)!==16 || b.readUInt16LE(20)!==1 || b.readUInt16LE(22)!==1 || b.readUInt32LE(24)!==16000 ||
      b.readUInt32LE(28)!==32000 || b.readUInt16LE(32)!==2 || b.readUInt16LE(34)!==16 ||
      b.toString('ascii',36,40)!=='data' || b.readUInt32LE(40)!==b.length-44 || (b.length-44)%2)
    throw fault('INVALID_RECOGNITION_WAV');
  return b;
}
async function verifyFile(file, expectedHash, expectedBytes) {
  const real = await fs.realpath(file), stat = await fs.lstat(file);
  if (real.toLowerCase() !== file.toLowerCase() || stat.isSymbolicLink() || !stat.isFile() ||
      (expectedBytes !== undefined && stat.size !== expectedBytes) || stat.size > 10*1024**2) throw fault('RESIDENT_PIN_MISMATCH');
  const bytes = await fs.readFile(file);
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw fault('RESIDENT_PIN_MISMATCH');
}
async function productionPreflight() {
  await verifyRuntimeDirectory(requireRuntimeConfiguration());
  if (process.platform !== 'win32' || process.arch !== 'x64') throw fault('RESIDENT_PLATFORM_UNSUPPORTED');
  if (!/^[a-f0-9]{64}$/.test(WORKER_SHA256)) throw fault('RESIDENT_SOURCE_NOT_PINNED');
  await verifyFile(WORKER, WORKER_SHA256);
  for (const {name,bytes,sha256} of PYTHON_PINS) await verifyFile(path.join(PYTHON_ROOT,name),sha256,bytes);
  const disk = await fs.statfs(RUNTIME_ROOT);
  const availableDisk=Number(disk.bavail)*Number(disk.bsize);
  if (!Number.isFinite(availableDisk)||availableDisk<10*GiB) throw fault('RESIDENT_DISK_RESERVE');
  // The worker independently verifies the complete pinned Whisper inventory,
  // archive and model before loading any inference library. No request selects paths.
  return { python: path.join(PYTHON_ROOT,'python.exe'), worker: WORKER };
}
const defaultIo = { preflight:productionPreflight, spawn, freemem:os.freemem, now:()=>performance.now() };

// Read-only artifact/resource verification. Never constructs or starts a worker.
export async function verifyResidentRecognitionPreparation() {
  await productionPreflight();
  return {status:'PREFLIGHT_PASS_NO_INFERENCE', workerSourcePinned:true, nativeInference:'NOT_PERFORMED'};
}

function workerEnvironment() {
  const environment = {...process.env, MW5_COMPANION_RUNTIME_ROOT:RUNTIME_ROOT,
    OMP_NUM_THREADS:'4', MKL_NUM_THREADS:'4', CUDA_VISIBLE_DEVICES:'-1'};
  // Windows environment names are case-insensitive. Never pass the loader's
  // optional out-of-tree DLL override into the isolated child.
  for(const name of Object.keys(environment)) if(name.toUpperCase()==='GGML_BACKEND_PATH') delete environment[name];
  return environment;
}

export function createResidentRecognition(options={}, testIo={}) {
  if (!ownOptions(options,['startupTimeoutMs','requestTimeoutMs','stopTimeoutMs','resourceIntervalMs']) ||
      !ownOptions(testIo,Object.keys(defaultIo)) || Object.values(testIo).some(x=>typeof x!=='function')) throw fault('INVALID_RECOGNITION_OPTIONS');
  const {startupTimeoutMs=30000,requestTimeoutMs=10000,stopTimeoutMs=3000,resourceIntervalMs=250}=options;
  for(const [value,max] of [[startupTimeoutMs,120000],[requestTimeoutMs,30000],[stopTimeoutMs,10000],[resourceIntervalMs,1000]])
    if(!Number.isInteger(value)||value<1||value>max) throw fault('INVALID_RECOGNITION_OPTIONS');
  const io={...defaultIo,...testIo}, mock=Object.keys(testIo).length>0;
  let owned=null, job=null, disposed=false, lastError=null, nextId=0, minRam=null;
  function finish(p,error,value) {
    if(!p||p.settled)return; p.settled=true; clearTimeout(p.timer); p.signal?.removeEventListener('abort',p.onAbort);
    if(error)p.reject(fault(error));else p.resolve(value);
  }
  function finalize(rec) {
    if(rec.preflightPending || (rec.child&&!rec.closed))return;
    clearInterval(rec.monitor); clearTimeout(rec.boot.timer); rec.done.resolve();
    if(owned===rec)owned=null;
  }
  function terminate(rec) {
    if(!rec.child||rec.closed||rec.killAttempted)return;
    rec.killAttempted=true;
    try {rec.child.kill();}catch { /* Closure, not kill's return, releases ownership. */ }
  }
  function fail(rec,code) {
    if(owned!==rec)return;
    // Teardown can emit additional pipe/process errors. Preserve the cause that
    // first revoked this worker; closure/cleanup flags report shutdown separately.
    rec.failure ??= code; code=rec.failure;
    rec.stopping=true; lastError=code;
    finish(rec.boot,code);
    if(job?.owner===rec){finish(job,code);job=null;}
    terminate(rec); finalize(rec);
  }
  function resourceCheck(rec,initial=false) {
    let free;try{free=io.freemem();}catch{free=NaN;}
    if(!Number.isFinite(free)||free<(initial?3:2)*GiB){ if(rec)fail(rec,'RESIDENT_RAM_RESERVE');throw fault('RESIDENT_RAM_RESERVE'); }
    minRam=minRam===null?free:Math.min(minRam,free); return free;
  }
  function status() {
    return { state:owned?(owned.stopping?'STOPPING':job?'BUSY':owned.ready?'READY':'STARTING'):disposed?'DISPOSED':'STOPPED',
      mode:MODE, classification:mock?'MOCK_ONLY':'LOCAL_ASR_UNVERIFIED_TEXT', transcriptTrust:'UNTRUSTED_RECOGNITION',
      busy:!!job||!!owned&&(!owned.ready||owned.stopping), ownsProcess:!!owned?.child&&!owned.closed, pid:owned?.child?.pid??null,
      processStopConfirmed:!owned?.child||owned.closed, pendingPreflight:!!owned?.preflightPending,
      nativeVersion:owned?.nativeVersion??null, minSampledAvailableRam:minRam,lastError,
      microphoneCapture:false,speakerPlayback:false,listenerStarted:false,commandExecution:false,gameTests:'NOT_PERFORMED' };
  }
  function message(rec,m) {
    if(owned!==rec||rec.stopping||rec.closed)return;
    if(exact(m,['v','type','code','id'])&&m.v===1&&m.type==='error'&&WORKER_ERRORS.has(m.code)&&
       (m.id===null || (job?.owner===rec&&m.id===job.id)))return fail(rec,'RESIDENT_WORKER_'+m.code);
    if(!rec.ready) {
      if(!exact(m,['v','type','mode','nativeVersion'])||m.v!==1||m.type!=='ready'||m.mode!==MODE||
         typeof m.nativeVersion!=='string'||!/^[\x20-\x7e]{1,128}$/.test(m.nativeVersion))return fail(rec,'RESIDENT_PROTOCOL');
      let now;try{now=io.now();}catch{now=NaN;}
      if(!Number.isFinite(now)||now<rec.startedAt)return fail(rec,'RESIDENT_CLOCK');
      if(now-rec.startedAt>=startupTimeoutMs)return fail(rec,'RESIDENT_START_TIMEOUT');
      rec.ready=true;rec.nativeVersion=m.nativeVersion;finish(rec.boot,null,status());return;
    }
    const work=job;
    if(!work||work.owner!==rec||!exact(m,['v','type','id','text'])||m.v!==1||m.type!=='result'||m.id!==work.id||
       typeof m.text!=='string'||!m.text.trim()||m.text.length>2048||Buffer.byteLength(m.text)>4096||
       /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(m.text))return fail(rec,'RESIDENT_PROTOCOL');
    if(work.signal?.aborted)return fail(rec,'RECOGNITION_ABORTED');
    let now;try{now=io.now();}catch{now=NaN;}
    if(!Number.isFinite(now)||now<work.startedAt)return fail(rec,'RESIDENT_CLOCK');
    if(now-work.startedAt>=requestTimeoutMs)return fail(rec,'RECOGNITION_TIMEOUT');
    job=null;finish(work,null,{schemaVersion:1,text:m.text.trim(),mode:MODE,
      transcriptTrust:'UNTRUSTED_RECOGNITION',classification:mock?'MOCK_ONLY':'LOCAL_ASR_UNVERIFIED_TEXT',
      durationMs:work.durationMs,elapsedMs:now-work.startedAt,commandExecution:false,microphoneCapture:false,speakerPlayback:false});
  }
  function stdout(rec,chunk) {
    if(owned!==rec||rec.stopping||rec.closed)return;
    const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    if(b.length>65536)return fail(rec,'RESIDENT_OUTPUT_LIMIT');
    rec.buffer=Buffer.concat([rec.buffer,b]);
    for(;;){
      const end=rec.buffer.indexOf(10);
      if(end<0){if(rec.buffer.length>8192)fail(rec,'RESIDENT_OUTPUT_LIMIT');return;}
      if(end>8192)return fail(rec,'RESIDENT_OUTPUT_LIMIT');
      const line=rec.buffer.subarray(0,end);rec.buffer=rec.buffer.subarray(end+1);
      let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(line));}catch{return fail(rec,'RESIDENT_PROTOCOL');}
      message(rec,m);if(rec.stopping||rec.closed||owned!==rec)return;
    }
  }
  function start() {
    if(disposed)return Promise.reject(fault('RECOGNITION_DISPOSED'));
    if(owned)return owned.stopping?Promise.reject(fault('RECOGNITION_BUSY')):owned.ready?Promise.resolve(status()):owned.boot.promise;
    lastError=null;
    const rec={boot:deferred(),done:deferred(),preflightPending:true,ready:false,stopping:false,child:null,closed:false,
      buffer:Buffer.alloc(0),stderrBytes:0,killAttempted:false,failure:null};owned=rec;
    rec.boot.timer=setTimeout(()=>fail(rec,'RESIDENT_START_TIMEOUT'),startupTimeoutMs);
    rec.monitor=setInterval(()=>{if(owned===rec&&!rec.stopping){try{resourceCheck(rec);}catch{}}},resourceIntervalMs);
    rec.monitor.unref?.();
    void(async()=>{
      try{
        rec.startedAt=io.now();if(!Number.isFinite(rec.startedAt)||rec.startedAt<0)throw fault('RESIDENT_CLOCK');
        resourceCheck(rec,true);const files=await io.preflight();
        if(owned!==rec||rec.stopping||disposed)return;
        const startupNow=io.now();
        if(!Number.isFinite(startupNow)||startupNow<rec.startedAt)throw fault('RESIDENT_CLOCK');
        if(startupNow-rec.startedAt>=startupTimeoutMs)throw fault('RESIDENT_START_TIMEOUT');
        resourceCheck(rec,true);
        const child=io.spawn(files.python,['-I','-S','-u',files.worker,'--serve'],{cwd:ROOT,windowsHide:true,shell:false,
          stdio:['pipe','pipe','pipe'],env:workerEnvironment()});
        rec.child=child;
        child.once('close',()=>{
          rec.closed=true;
          if(owned===rec&&!rec.stopping)fail(rec,'RESIDENT_PROCESS_EXITED');
          finalize(rec);
        });
        child.on('error',()=>{if(!rec.closed)fail(rec,'RESIDENT_PROCESS_FAILED');});
        child.stdout.on('data',chunk=>stdout(rec,chunk));
        child.stderr.on('data',chunk=>{if(owned!==rec||rec.closed)return;rec.stderrBytes+=Buffer.byteLength(chunk);
          if(rec.stderrBytes>131072)fail(rec,'RESIDENT_OUTPUT_LIMIT');});
        for(const stream of [child.stdin,child.stdout,child.stderr])stream.on('error',()=>{if(!rec.closed)fail(rec,'RESIDENT_PIPE_FAILED');});
      }catch(error){
        const safe=['RESIDENT_PLATFORM_UNSUPPORTED','RESIDENT_SOURCE_NOT_PINNED','RESIDENT_PIN_MISMATCH','RESIDENT_DISK_RESERVE','RESIDENT_RAM_RESERVE','RESIDENT_CLOCK','RESIDENT_START_TIMEOUT'];
        fail(rec,safe.includes(error?.code)?error.code:'RESIDENT_PREFLIGHT_FAILED');
      }finally{rec.preflightPending=false;finalize(rec);}
    })();return rec.boot.promise;
  }
  async function transcribe(input,requestOptions={}) {
    if(!ownOptions(requestOptions,['signal']))throw fault('INVALID_RECOGNITION_OPTIONS');
    const {signal}=requestOptions;
    if(signal!==undefined&&!(signal instanceof AbortSignal))throw fault('INVALID_ABORT_SIGNAL');
    if(signal?.aborted)throw fault('RECOGNITION_ABORTED');
    const wave=waveCopy(input),rec=owned;
    if(disposed)throw fault('RECOGNITION_DISPOSED');
    if(job)throw fault('RECOGNITION_BUSY');
    if(!rec?.ready||rec.stopping||rec.closed)throw fault('RECOGNITION_NOT_READY');
    resourceCheck(rec);
    let now;try{now=io.now();}catch{now=NaN;}
    if(!Number.isFinite(now)||now<0||nextId>=Number.MAX_SAFE_INTEGER)throw fault('RESIDENT_CLOCK');
    const work={...deferred(),owner:rec,id:++nextId,signal,startedAt:now,durationMs:(wave.length-44)/32};job=work;
    work.onAbort=()=>{if(job===work)fail(rec,'RECOGNITION_ABORTED');};
    work.timer=setTimeout(()=>{if(job===work)fail(rec,'RECOGNITION_TIMEOUT');},requestTimeoutMs);
    signal?.addEventListener('abort',work.onAbort,{once:true});
    if(signal?.aborted)work.onAbort();
    if(!work.settled)try{
      rec.child.stdin.write(JSON.stringify({v:1,type:'transcribe',id:work.id,wav:wave.toString('base64')})+'\n',error=>{
        if(error&&job===work&&owned===rec)fail(rec,'RESIDENT_PIPE_FAILED');
      });
    }catch{fail(rec,'RESIDENT_PIPE_FAILED');}
    return work.promise;
  }
  async function stop() {
    const rec=owned;
    if(rec){
      rec.stopping=true;finish(rec.boot,'RECOGNITION_STOPPED');
      const busy=job?.owner===rec;
      if(busy){finish(job,'RECOGNITION_STOPPED');job=null;terminate(rec);}
      else if(rec.child&&!rec.closed)try{rec.child.stdin.end(JSON.stringify({v:1,type:'stop'})+'\n');}catch{terminate(rec);}
      const killTimer=setTimeout(()=>terminate(rec),Math.max(1,Math.floor(stopTimeoutMs/2)));
      let timer;await Promise.race([rec.done.promise,new Promise(resolve=>{timer=setTimeout(resolve,stopTimeoutMs);})]);
      clearTimeout(timer);clearTimeout(killTimer);finalize(rec);
      if(owned===rec)lastError=rec.failure??'RESIDENT_STOP_UNCONFIRMED';
    }
    return {...status(),stopped:!owned,ownedProcessStopped:!owned?.child||owned.closed,cleanupComplete:!owned};
  }
  async function dispose(){disposed=true;return stop();}
  return Object.freeze({start,transcribe,stop,dispose,status});
}
