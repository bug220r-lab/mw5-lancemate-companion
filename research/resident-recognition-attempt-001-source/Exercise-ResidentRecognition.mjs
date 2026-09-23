// Explicit retained-ASR component experiment; default/import are inert.
// No microphone, playback, HTTP listener, game, download or command execution.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createResidentRecognition, verifyResidentRecognitionPreparation } from '../companion/resident-recognition.mjs';
import { createLocalRecognition } from '../companion/local-recognition.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GiB = 1024 ** 3, MODE = 'RESIDENT_PIPE_TRANSCRIPTION_ONLY';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const ownFunctions = (x, names) => x && Object.getPrototypeOf(x) === Object.prototype &&
  Reflect.ownKeys(x).length === names.length && names.every(k => Object.hasOwn(x,k) &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value') && typeof x[k] === 'function');
export const RESIDENT_RECOGNITION_RECEIPT = 'research/RESIDENT_RECOGNITION_COMPONENT_SMOKE.json';
export const RESIDENT_EXPERIMENT_LIMITS = Object.freeze({ startupMs:30000, requestMs:10000, stopMs:3000,
  workMs:65000, sampleMs:250, initialRamBytes:3*GiB, runningRamBytes:2*GiB, diskBytes:10*GiB });
const BASE = 'companion/local/whisper-benchmark/2026-09-21T05-14-05-115Z';
export const RESIDENT_EXPERIMENT_CLIPS = Object.freeze([
  Object.freeze({id:'VA-001',file:`${BASE}/VA-001-16k.wav`,sha256:'2107ecb69e0dedd465f4fc478430693fff78a8b59d2918e176d32d127a7856d4',referenceText:'Heard you.'}),
  Object.freeze({id:'VA-006',file:`${BASE}/VA-006-16k.wav`,sha256:'a357610e09d61c3f44dfe2cc877c6b935ad2ec4532d90232d07230c09397ac44',referenceText:'Withdrawal understood. No more target suggestions.'}),
]);
const ORDER = Object.freeze(['VA-001','VA-006','VA-001']);
const SOURCE_FILES = Object.freeze([
  'scripts/Exercise-ResidentRecognition.mjs','companion/tests/resident-recognition-experiment.test.mjs',
  'companion/resident-recognition.mjs','companion/resident_recognition_worker.py',
  'companion/tests/resident-recognition.test.mjs','companion/tests/resident-recognition-review.test.mjs',
  'companion/tests/resident-recognition-worker.test.mjs','scripts/Test-ResidentRecognitionWorker.py',
  'companion/local-recognition.mjs','companion/models.lock.json','companion/whisper-runtime-pins.json',
  'design/RESIDENT_RECOGNITION.md','research/RESIDENT_RECOGNITION_SOURCE.json',
  'research/RESIDENT_RECOGNITION_PARENT_REVIEW.md','research/RESIDENT_RECOGNITION_WORKER_REVIEW.md',
  'research/RESIDENT_RECOGNITION_EXPERIMENT_REVIEW.md',
]);
const engineOptions = Object.freeze({startupTimeoutMs:30000,requestTimeoutMs:10000,stopTimeoutMs:3000,resourceIntervalMs:250});
export const normalizeResidentTranscript = text => text.toLowerCase().replaceAll('’',"'").replace(/[^a-z0-9'\s]/g,' ').trim().replace(/\s+/g,' ');
export function parseResidentExperimentArguments(args) {
  if (!Array.isArray(args) || args.length>1 || args.some(x=>!['--check','--run'].includes(x))) fail('INVALID_ARGUMENTS');
  return args[0] ?? 'INERT';
}
async function checkedFile(relative, maxBytes=1024*1024) {
  if (!SOURCE_FILES.includes(relative) && !RESIDENT_EXPERIMENT_CLIPS.some(c=>c.file===relative)) fail('UNDECLARED_INPUT_PATH');
  const absolute=path.join(ROOT,relative), real=await fs.realpath(absolute), info=await fs.lstat(absolute);
  if(real.toLowerCase()!==absolute.toLowerCase()||info.isSymbolicLink()||!info.isFile()||info.size>maxBytes) fail('EXPERIMENT_FILE_REJECTED');
  const bytes=await fs.readFile(absolute);
  if(bytes.length!==info.size||bytes.length>maxBytes) fail('EXPERIMENT_FILE_CHANGED');
  return bytes;
}
export async function readResidentExperimentPreparation() {
  const sources=[];
  for(const file of SOURCE_FILES){const bytes=await checkedFile(file);sources.push({file,bytes:bytes.length,sha256:hash(bytes)});}
  const clips=[];
  for(const pin of RESIDENT_EXPERIMENT_CLIPS){const bytes=await checkedFile(pin.file,480044);
    if(hash(bytes)!==pin.sha256)fail('EXPERIMENT_CLIP_HASH_MISMATCH');
    clips.push({...pin,bytes,actualSha256:hash(bytes)});
  }
  const parent=await verifyResidentRecognitionPreparation();
  if(parent.status!=='PREFLIGHT_PASS_NO_INFERENCE'||parent.workerSourcePinned!==true||parent.nativeInference!=='NOT_PERFORMED')
    fail('EXPERIMENT_PARENT_PREFLIGHT_REJECTED');
  // Cold adapter start only verifies the pinned installation: it never spawns.
  const verifier=createLocalRecognition({requestTimeoutMs:30000,stopTimeoutMs:3000});
  let runtime,disposed;
  try{runtime=await verifier.start();}
  finally{disposed=await verifier.dispose();}
  if(runtime?.verification!=='PINNED_FILES_VERIFIED'||runtime.ownsProcess||disposed.ownsProcess||
      disposed.busy||disposed.cleanupPending||disposed.cleanupBlocked||disposed.state!=='DISPOSED')fail('EXPERIMENT_RUNTIME_PREFLIGHT_REJECTED');
  const lock=JSON.parse((await checkedFile('companion/models.lock.json')).toString('utf8'));
  const inventory=JSON.parse((await checkedFile('companion/whisper-runtime-pins.json')).toString('utf8'));
  return {clips,evidence:{sources,parentPreparation:parent,runtimeVerification:runtime,verifierDisposal:disposed,
    modelPins:lock.artifacts.filter(x=>['whisper-base-en','whisper-cpu'].includes(x.id)),runtimePins:inventory}};
}
async function checkSourceSnapshot(sources){
  if(sources.length!==SOURCE_FILES.length||sources.some((x,i)=>x.file!==SOURCE_FILES[i]))fail('SOURCE_SNAPSHOT_INVALID');
  for(const pin of sources){const bytes=await checkedFile(pin.file);if(bytes.length!==pin.bytes||hash(bytes)!==pin.sha256)fail('EXPERIMENT_SOURCE_CHANGED');}
}
async function resources(){const disk=await fs.statfs(ROOT);return {availableRamBytes:os.freemem(),availableDiskBytes:Number(disk.bavail)*Number(disk.bsize)};}
async function conflicts(){
  if(process.platform!=='win32')fail('EXPERIMENT_PLATFORM_UNSUPPORTED');
  const escapedRoot=ROOT.replaceAll("'","''");
  const command=`$ErrorActionPreference='Stop'; $projectRoot='${escapedRoot}'; $found=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(UE4Editor|ShaderCompileWorker|MW5Mercs.*|MechWarrior.*|llama-server|whisper-cli|whisper-server)\\.exe$' -or ($_.Name -match '^python(?:w|3(?:\\.\\d+)?)?\\.exe$' -and $_.CommandLine -and ($_.CommandLine.IndexOf($projectRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0 -or $_.CommandLine -match '(resident_recognition_worker\\.py|Kokoro-Worker\\.py)')) } | ForEach-Object { @{ pid=[int]$_.ProcessId; name=[string]$_.Name } }); ConvertTo-Json -InputObject $found -Compress`;
  const exe=path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const {stdout}=await promisify(execFile)(exe,['-NoProfile','-NonInteractive','-Command',command],
    {windowsHide:true,shell:false,timeout:5000,maxBuffer:65536,encoding:'utf8'});
  let rows;try{rows=JSON.parse(stdout.replace(/^\uFEFF/,'').trim());}catch{fail('PROCESS_INVENTORY_UNAVAILABLE');}
  if(!Array.isArray(rows)||rows.length>256||rows.some(x=>!Number.isSafeInteger(x.pid)||x.pid<=0||typeof x.name!=='string'||!/^[A-Za-z0-9_. -]{1,100}$/.test(x.name)))
    fail('PROCESS_INVENTORY_UNAVAILABLE');
  return {observedAt:new Date().toISOString(),scope:'LOCAL_GAME_MODEL_AND_PROJECT_PYTHON',processes:rows};
}
async function receiptDirectory(){const absolute=path.join(ROOT,'research'),actual=await fs.realpath(absolute),info=await fs.lstat(absolute);
  if(actual.toLowerCase()!==absolute.toLowerCase()||info.isSymbolicLink()||!info.isDirectory())fail('RECEIPT_DIRECTORY_REJECTED');}
async function receiptAvailable(){await receiptDirectory();try{await fs.lstat(path.join(ROOT,RESIDENT_RECOGNITION_RECEIPT));return false;}
  catch(error){if(error.code==='ENOENT')return true;throw error;}}
export async function reserveResidentRecognitionReceipt(openFile=fs.open){
  if(openFile===fs.open)await receiptDirectory();
  let handle;try{handle=await openFile(path.join(ROOT,RESIDENT_RECOGNITION_RECEIPT),'wx');}
  catch(error){if(error.code==='EEXIST')fail('RECEIPT_ALREADY_EXISTS');throw error;}
  return {
    async save(report){const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');if(bytes.length>1024*1024)fail('RECEIPT_TOO_LARGE');
      await handle.truncate(0);let offset=0;
      while(offset<bytes.length){const result=await handle.write(bytes,offset,bytes.length-offset,offset);
        if(!Number.isInteger(result.bytesWritten)||result.bytesWritten<=0||result.bytesWritten>bytes.length-offset)fail('RECEIPT_WRITE_FAILED');offset+=result.bytesWritten;}
      await handle.sync();},
    async close(){await handle.close();}
  };
}
const defaultIo={prepare:readResidentExperimentPreparation,checkSources:checkSourceSnapshot,resources,freemem:os.freemem,conflicts,
  createEngine:options=>createResidentRecognition(options),now:()=>performance.now(),wallNow:()=>new Date().toISOString(),
  reserveReceipt:()=>reserveResidentRecognitionReceipt(),receiptAvailable};
const safeError = error => /^[A-Z][A-Z0-9_]{1,95}$/.test(error?.code??'') ? error.code : 'RESIDENT_EXPERIMENT_FAILED';

export async function runResidentRecognitionExperiment(args=[],testIo={}){
  const action=parseResidentExperimentArguments(args);
  if(action==='INERT')return {status:'INERT',nativeInference:'NOT_PERFORMED',receipt:null};
  const mock=Reflect.ownKeys(testIo).length>0;
  if(mock&&!ownFunctions(testIo,Object.keys(defaultIo)))fail('INCOMPLETE_TEST_DEPENDENCIES');
  const io=mock?testIo:defaultIo,run=action==='--run';
  let writer=null;
  // Reservation precedes inspection and every possible worker construction/start.
  if(run)writer=await io.reserveReceipt();
  const report={schemaVersion:1,classification:mock?'MOCK_ONLY':'LOCAL_COMPONENT_SMOKE_SYNTHETIC_INPUT',mode:MODE,
    status:'PREFLIGHT',startedAt:io.wallNow(),completedAt:null,receipt:run?RESIDENT_RECOGNITION_RECEIPT:null,
    nativeInference:'NOT_PERFORMED',microphoneCapture:false,speakerPlayback:false,listenerStarted:false,
    commandExecution:false,gameTests:'NOT_PERFORMED',uiIntegration:'NOT_PERFORMED',humanRecognitionAcceptance:'NOT_PERFORMED',
    releaseAcceptance:'NOT_PERFORMED',networkCalls:0,paidApiCalls:0,settings:{...engineOptions,cpuThreads:4,gpu:false,language:'en'},
    limits:{...RESIDENT_EXPERIMENT_LIMITS},preparation:null,preflightInventory:null,postflightInventory:null,admission:null,
    memorySamples:[],minSampledAvailableRam:null,observedOwnedPids:[],startup:{status:'NOT_PERFORMED',requestInvoked:false,elapsedMs:null,runtime:null},
    samples:ORDER.map((id,i)=>({...RESIDENT_EXPERIMENT_CLIPS.find(c=>c.id===id),ordinal:i+1,status:'NOT_PERFORMED',requestInvoked:false,
      startedAt:null,elapsedMs:null,pidBefore:null,pidAfter:null,result:null,referenceMatched:null,normalizedActual:null,error:null})),
    haltReason:null,error:null,disposal:null,finalState:null,ownedProcessStopped:null,sourceSnapshotUnchanged:null,
    limitations:['Three existing synthetic requests do not establish human accuracy, a latency percentile or game-loaded acceptance.',
      'Different decoding defaults and uncontrolled background load prevent a causal speedup claim against older CLI/server results.',
      'Startup and per-request wall times are reported separately; no microphone, command parsing or game-control latency is measured.',
      'Sampled RAM is reactive, not a hard reservation; process inventories are point-in-time observations.',
      'A repeated clip checks this one sequence only, not all possible context leakage.']};
  let engine=null,monitor=null,workTimer=null,workBegan=null,stopPromise=null;
  const controller=new AbortController();
  const save=async()=>{if(writer)await writer.save(report);};
  function stopOwned(){if(engine&&!stopPromise)stopPromise=Promise.resolve().then(()=>engine.stop()).catch(()=>null);}
  function halt(code){if(!report.haltReason)report.haltReason=code;controller.abort();stopOwned();}
  function now(){const value=io.now();if(!Number.isFinite(value)||value<0)fail('EXPERIMENT_CLOCK');return value;}
  function elapsed(began){const value=now()-began;if(value<0)fail('EXPERIMENT_CLOCK');return value;}
  function sampleRam(){const free=io.freemem();if(!Number.isFinite(free)||free<0)fail('EXPERIMENT_RAM_UNAVAILABLE');
    if(report.memorySamples.length>=400)fail('EXPERIMENT_SAMPLE_LIMIT');
    report.memorySamples.push({at:io.wallNow(),availableRamBytes:free});
    report.minSampledAvailableRam=report.minSampledAvailableRam===null?free:Math.min(report.minSampledAvailableRam,free);
    const s=engine?.status();if(Number.isSafeInteger(s?.pid)&&s.pid>0&&!report.observedOwnedPids.includes(s.pid))report.observedOwnedPids.push(s.pid);
    if(free<RESIDENT_EXPERIMENT_LIMITS.runningRamBytes)fail('EXPERIMENT_RAM_RESERVE');return free;
  }
  function assertRunning(){if(controller.signal.aborted)fail(report.haltReason??'EXPERIMENT_CANCELLED');
    if(workBegan!==null&&elapsed(workBegan)>=RESIDENT_EXPERIMENT_LIMITS.workMs)fail('EXPERIMENT_WORK_DEADLINE');sampleRam();}
  async function admission(initial){const sample=await io.resources();
    if(!Number.isFinite(sample.availableRamBytes)||sample.availableRamBytes<(initial?3:2)*GiB)fail('EXPERIMENT_RAM_RESERVE');
    if(!Number.isFinite(sample.availableDiskBytes)||sample.availableDiskBytes<10*GiB)fail('EXPERIMENT_DISK_RESERVE');return sample;
  }
  async function timed(operation,ms,code,honorHalt=true){let timer,onAbort;const start=now();
    try{const choices=[Promise.resolve().then(()=>{if(honorHalt&&controller.signal.aborted)fail(report.haltReason??'EXPERIMENT_CANCELLED');return operation();}),
      new Promise((_,reject)=>{timer=setTimeout(()=>{halt(code);reject(Object.assign(Error(code),{code}));},ms);})];
      if(honorHalt)choices.push(new Promise((_,reject)=>{onAbort=()=>reject(Object.assign(Error(report.haltReason),{code:report.haltReason}));controller.signal.addEventListener('abort',onAbort,{once:true});}));
      const value=await Promise.race(choices);if(elapsed(start)>=ms){halt(code);fail(code);}return value;}
    finally{clearTimeout(timer);if(onAbort)controller.signal.removeEventListener('abort',onAbort);}
  }
  function requireReady(pid){const state=engine.status();if(state.state!=='READY'||state.busy||!state.ownsProcess||state.mode!==MODE||
      !Number.isSafeInteger(state.pid)||state.pid<=0||(pid!==undefined&&state.pid!==pid))fail('EXPERIMENT_WORKER_IDENTITY');return state;}
  try{
    await save();
    if(!run){report.receiptAvailable=await io.receiptAvailable();if(!report.receiptAvailable)fail('RECEIPT_ALREADY_EXISTS');}
    report.admission=await admission(true);sampleRam();
    const prepared=await io.prepare();report.preparation=prepared.evidence;
    if(!Array.isArray(prepared.clips)||prepared.clips.length!==2||prepared.clips.some((c,i)=>c.id!==RESIDENT_EXPERIMENT_CLIPS[i].id||
        !Buffer.isBuffer(c.bytes)||hash(c.bytes)!==c.actualSha256))fail('EXPERIMENT_PREPARATION_INVALID');
    report.preflightInventory=await io.conflicts();
    if(!Array.isArray(report.preflightInventory.processes)||report.preflightInventory.processes.length)fail('EXPERIMENT_CONFLICTING_WORKERS');
    await io.checkSources(report.preparation.sources);report.sourceSnapshotUnchanged=true;
    report.admissionBeforeStart=await admission(true);sampleRam();await save();
    if(!run){report.status='PREFLIGHT_PASS_NO_INFERENCE';}
    else{
      assertRunning();engine=io.createEngine(engineOptions);workBegan=now();
      monitor=setInterval(()=>{try{assertRunning();}catch(error){halt(safeError(error));}},RESIDENT_EXPERIMENT_LIMITS.sampleMs);
      workTimer=setTimeout(()=>halt('EXPERIMENT_WORK_DEADLINE'),RESIDENT_EXPERIMENT_LIMITS.workMs);
      // The durable prepared state means invocation is uncertain if the parent dies
      // after this checkpoint; final requestInvoked is definitive only on return.
      report.startup.status='STARTUP_PREPARED';report.startup.requestInvoked=null;await save();assertRunning();const start=now();
      try{report.startup.runtime=await timed(()=>{report.startup.status='RUNNING';report.startup.requestInvoked=true;return engine.start();},30000,'EXPERIMENT_STARTUP_DEADLINE');
        report.startup.elapsedMs=elapsed(start);report.startup.status='READY';}
      catch(error){report.startup.elapsedMs=elapsed(start);report.startup.status='FAILED';throw error;}
      assertRunning();const pid=requireReady().pid;await save();
      for(const sample of report.samples){
        await admission(false);assertRunning();const before=requireReady(pid);
        const clip=prepared.clips.find(c=>c.id===sample.id);
        if(hash(clip.bytes)!==clip.actualSha256)fail('EXPERIMENT_INPUT_MUTATED');
        sample.pidBefore=before.pid;sample.submissionPreparedAt=io.wallNow();sample.status='SUBMISSION_PREPARED';sample.requestInvoked=null;
        if(!report.samples.some(s=>s.result!==null))report.nativeInference=mock?'MOCK_SUBMISSION_PREPARED_OUTCOME_UNKNOWN':'SUBMISSION_PREPARED_OUTCOME_UNKNOWN';
        await save();assertRunning();requireReady(pid);const start=now();
        try{
          const result=await timed(()=>{sample.startedAt=io.wallNow();sample.status='RUNNING';sample.requestInvoked=true;
            if(!report.samples.some(s=>s.result!==null))report.nativeInference=mock?'MOCK_REQUESTED':'REQUESTED';
            return engine.transcribe(Buffer.from(clip.bytes),{signal:controller.signal});},10000,'EXPERIMENT_REQUEST_DEADLINE');
          sample.elapsedMs=elapsed(start);assertRunning();sample.pidAfter=requireReady(pid).pid;
          if(result.mode!==MODE||result.classification!==(mock?'MOCK_ONLY':'LOCAL_ASR_UNVERIFIED_TEXT')||result.transcriptTrust!=='UNTRUSTED_RECOGNITION'||result.commandExecution!==false||
              result.microphoneCapture!==false||result.speakerPlayback!==false||typeof result.text!=='string'||!result.text.trim()||
              result.text.length>2048||Buffer.byteLength(result.text)>4096||!Number.isFinite(result.elapsedMs)||result.elapsedMs<0||result.elapsedMs>=10000)
            fail('EXPERIMENT_RESULT_REJECTED');
          sample.result=result;sample.normalizedActual=normalizeResidentTranscript(result.text);
          sample.referenceMatched=sample.normalizedActual===normalizeResidentTranscript(sample.referenceText);
          sample.status=sample.referenceMatched?'TRANSCRIBED_REFERENCE_MATCH':'TRANSCRIPT_MISMATCH';
          report.nativeInference=mock?'MOCK_ONLY':'PERFORMED_CPU_ONLY';
          if(!sample.referenceMatched)fail('EXPERIMENT_TRANSCRIPT_MISMATCH');
          await save();
        }catch(error){sample.elapsedMs=elapsed(start);sample.error=safeError(error);if(sample.status==='RUNNING')sample.status='FAILED';throw error;}
      }
      report.status='PASS_RESIDENT_COMPONENT_SMOKE_ONLY';
    }
  }catch(error){report.error=safeError(error);halt(report.error);report.status='FAILED_OR_BLOCKED';}
  finally{
    clearInterval(monitor);clearTimeout(workTimer);
    if(engine){
      try{report.disposal=await timed(()=>engine.dispose(),3000,'EXPERIMENT_CLEANUP_DEADLINE',false);}
      catch(error){report.cleanupError=safeError(error);report.status='FAILED_OR_BLOCKED';}
      try{report.finalState=engine.status();}catch{report.finalState=null;}
      report.ownedProcessStopped=report.disposal?.stopped===true&&report.disposal?.ownedProcessStopped===true&&
        report.disposal?.cleanupComplete===true&&report.finalState?.ownsProcess===false&&report.finalState?.pid===null&&
        report.finalState?.busy===false&&!report.finalState?.pendingPreflight&&report.finalState?.state==='DISPOSED';
      if(!report.ownedProcessStopped){report.cleanupError??='EXPERIMENT_CLEANUP_UNCONFIRMED';report.status='FAILED_OR_BLOCKED';}
      try{report.postflightInventory=await io.conflicts();
        if(!Array.isArray(report.postflightInventory.processes)||report.postflightInventory.processes.length)fail('EXPERIMENT_POSTFLIGHT_CONFLICT');}
      catch(error){report.postflightError=safeError(error);report.status='FAILED_OR_BLOCKED';}
    }else report.ownedProcessStopped=true;
    if(report.preparation){try{await io.checkSources(report.preparation.sources);}catch(error){report.sourceSnapshotUnchanged=false;report.error??=safeError(error);report.status='FAILED_OR_BLOCKED';}}
    if(report.startup.requestInvoked===null){report.startup.requestInvoked=false;report.startup.status='NOT_PERFORMED';}
    for(const sample of report.samples)if(sample.requestInvoked===null){sample.requestInvoked=false;sample.status='NOT_PERFORMED';}
    if(report.samples.every(sample=>sample.requestInvoked===false))report.nativeInference='NOT_PERFORMED';
    report.completedAt=io.wallNow();report.completedCount=report.samples.filter(s=>s.result!==null).length;
    report.referenceMatchedCount=report.samples.filter(s=>s.referenceMatched===true).length;
    report.notPerformed=report.samples.filter(s=>s.requestInvoked===false).map(s=>({ordinal:s.ordinal,id:s.id}));
    try{await save();}finally{if(writer)await writer.close();}
  }
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const report=await runResidentRecognitionExperiment(process.argv.slice(2));
    console.log(JSON.stringify({status:report.status,receipt:report.receipt,completedCount:report.completedCount,
      error:report.error,haltReason:report.haltReason,ownedProcessStopped:report.ownedProcessStopped,nativeInference:report.nativeInference}));
    if(report.status==='FAILED_OR_BLOCKED')process.exitCode=1;
  }catch(error){console.log(JSON.stringify({status:'REFUSED_OR_RECEIPT_FAILED',error:safeError(error),nativeInference:'UNKNOWN_SEE_RECEIPT'}));process.exitCode=1;}
}
