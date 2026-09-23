// MOCK_ONLY experiment supervisor tests. All execution, inventory, clocks,
// resources and receipt I/O are explicitly replaced; no native/model work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runResidentRecognitionExperiment, parseResidentExperimentArguments, reserveResidentRecognitionReceipt,
  RESIDENT_EXPERIMENT_LIMITS, RESIDENT_EXPERIMENT_CLIPS, RESIDENT_RECOGNITION_RECEIPT,
  RESIDENT_RECOGNITION_REPAIR_RECEIPT } from '../../scripts/Exercise-ResidentRecognition.mjs';
const GiB=1024**3, MODE='RESIDENT_PIPE_TRANSCRIPTION_ONLY';
const error=code=>Object.assign(Error(code),{code});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function rig(configure=()=>{}){
  const state={clock:100,wall:0,ram:6*GiB,disk:20*GiB,ops:[],receipts:[],reserved:false,closed:0,
    prepared:0,factories:0,starts:0,requests:[],stops:0,disposals:0,nativeState:'STOPPED',pid:null,sourceChecks:0,inventoryCalls:0};
  const clips=RESIDENT_EXPERIMENT_CLIPS.map((c,i)=>{const bytes=Buffer.alloc(3244,i+1);return {...c,bytes,actualSha256:sha(bytes)};});
  const status=()=>({state:state.nativeState,mode:MODE,pid:state.pid,ownsProcess:state.pid!==null,
    busy:['BUSY','STOPPING'].includes(state.nativeState),pendingPreflight:false,nativeVersion:'MOCK_ONLY b5130'});
  const engine={
    status,
    async start(){state.ops.push('start');state.starts++;state.pid=8421;state.nativeState='READY';
      if(state.onStart)await state.onStart();else state.clock+=100;return status();},
    async transcribe(bytes,{signal}){state.ops.push('transcribe');const n=state.requests.length;
      const request={bytes:Buffer.from(bytes),signal};state.requests.push(request);state.nativeState='BUSY';
      let text=[RESIDENT_EXPERIMENT_CLIPS[0].referenceText,RESIDENT_EXPERIMENT_CLIPS[1].referenceText,RESIDENT_EXPERIMENT_CLIPS[0].referenceText][n];
      let extra={};if(state.onTranscribe)extra=await state.onTranscribe(n,request)??{};
      state.clock+=100;state.nativeState='READY';
      return {schemaVersion:1,mode:MODE,text,classification:'MOCK_ONLY',transcriptTrust:'UNTRUSTED_RECOGNITION',
        commandExecution:false,microphoneCapture:false,speakerPlayback:false,elapsedMs:100,durationMs:100,...extra};},
    async stop(){state.stops++;state.ops.push('stop');
      if(!state.unconfirmed){state.nativeState='STOPPED';state.pid=null;}
      else state.nativeState='STOPPING';return {...status(),stopped:!state.unconfirmed,ownedProcessStopped:!state.unconfirmed,cleanupComplete:!state.unconfirmed};},
    async dispose(){state.disposals++;state.ops.push('dispose');if(state.onDispose)await state.onDispose();
      if(!state.unconfirmed){state.nativeState='DISPOSED';state.pid=null;}else state.nativeState='STOPPING';
      return {...status(),stopped:!state.unconfirmed,ownedProcessStopped:!state.unconfirmed,cleanupComplete:!state.unconfirmed};}
  };
  const io={
    async prepare(){state.ops.push('prepare');state.prepared++;if(state.prepareError)throw error(state.prepareError);
      return {clips,evidence:{sources:[{file:'MOCK_ONLY_SOURCE',bytes:1,sha256:'a'.repeat(64)}],modelPins:[{id:'MOCK_ONLY'}],runtimePins:{classification:'MOCK_ONLY'}}};},
    async checkSources(){state.sourceChecks++;state.ops.push('sources');if(state.changedSources&&state.sourceChecks>1)throw error('EXPERIMENT_SOURCE_CHANGED');},
    async resources(){state.ops.push('resources');return {availableRamBytes:state.ram,availableDiskBytes:state.disk};},
    freemem:()=>state.ram,
    async conflicts(){state.ops.push('inventory');state.inventoryCalls++;return {observedAt:'MOCK_ONLY',processes:state.conflicts??[]};},
    createEngine(options){state.ops.push('factory');state.factories++;state.options=options;return engine;},
    now:()=>state.clock,
    wallNow:()=>new Date(Date.UTC(2026,8,23)+state.wall++).toISOString(),
    async reserveReceipt(receipt){state.receiptPath=receipt;state.ops.push('reserve');if(state.reserved)throw error('RECEIPT_ALREADY_EXISTS');state.reserved=true;
      return {async save(report){state.ops.push('save');state.receipts.push(structuredClone(report));if(state.onSave)await state.onSave(report);},
        async close(){state.closed++;state.ops.push('close');}};},
    async receiptAvailable(receipt){state.receiptPath=receipt;state.ops.push('receipt-check');return !state.reserved;},
    async verifyPredecessor(){state.ops.push('predecessor');return {status:'EXACT_FAILED_ATTEMPT_PRESERVED',classification:'MOCK_ONLY'};}
  };
  configure(state,io,clips);return {state,io,clips,engine};
}

test('resident experiment: default is inert; fixed selectors and complete fake seam set are mandatory',async()=>{
  assert.equal((await runResidentRecognitionExperiment()).status,'INERT');
  assert.equal(parseResidentExperimentArguments([]),'INERT');
  for(const args of [['--run','--force'],['--run-again'],['--output','elsewhere'],null])
    assert.throws(()=>parseResidentExperimentArguments(args),/INVALID_ARGUMENTS/);
  await assert.rejects(runResidentRecognitionExperiment(['--run'],{now:()=>0}),/INCOMPLETE_TEST_DEPENDENCIES/);
});

test('resident experiment: read-only check performs preparation/inventory without receipt or worker factory',async()=>{
  const h=rig(),report=await runResidentRecognitionExperiment(['--check'],h.io);
  assert.equal(report.status,'PREFLIGHT_PASS_NO_INFERENCE');assert.equal(report.classification,'MOCK_ONLY');
  assert.equal(report.nativeInference,'NOT_PERFORMED');assert.equal(report.receipt,null);
  assert.equal(h.state.factories,0);assert.equal(h.state.starts,0);assert.equal(h.state.reserved,false);
  assert.equal(h.state.prepared,1);assert.equal(h.state.inventoryCalls,1);assert.equal(report.notPerformed.length,3);
});

test('resident experiment: fixed ordered sequence uses one PID and checkpoints ambiguous intent before actual calls',async()=>{
  const h=rig((s)=>{s.onSave=report=>{
    if(report.startup.status==='STARTUP_PREPARED'){assert.equal(s.starts,0);assert.equal(report.startup.requestInvoked,null);}
    const prepared=report.samples.find(x=>x.status==='SUBMISSION_PREPARED');
    if(prepared){assert.equal(s.requests.length,prepared.ordinal-1);assert.equal(prepared.requestInvoked,null);
      if(prepared.ordinal===1)assert.equal(report.nativeInference,'MOCK_SUBMISSION_PREPARED_OUTCOME_UNKNOWN');}
  };});
  const report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(h.state.ops[0],'reserve');assert.ok(h.state.ops.indexOf('save')<h.state.ops.indexOf('factory'));
  assert.equal(report.status,'PASS_RESIDENT_COMPONENT_SMOKE_ONLY');assert.equal(report.classification,'MOCK_ONLY');
  assert.equal(report.completedCount,3);assert.equal(report.referenceMatchedCount,3);assert.equal(report.notPerformed.length,0);
  assert.deepEqual(report.samples.map(x=>x.id),['VA-001','VA-006','VA-001']);
  assert.deepEqual(h.state.requests.map(x=>sha(x.bytes)),[h.clips[0].actualSha256,h.clips[1].actualSha256,h.clips[0].actualSha256]);
  assert.ok(report.samples.every(x=>x.requestInvoked&&x.pidBefore===8421&&x.pidAfter===8421&&x.result.commandExecution===false));
  assert.deepEqual(report.observedOwnedPids,[8421]);assert.equal(h.state.factories,1);assert.equal(h.state.starts,1);
  assert.equal(h.state.disposals,1);assert.equal(h.state.closed,1);assert.equal(report.ownedProcessStopped,true);
  assert.deepEqual(h.state.options,{startupTimeoutMs:30000,requestTimeoutMs:10000,stopTimeoutMs:3000,resourceIntervalMs:250});
  assert.equal(RESIDENT_EXPERIMENT_LIMITS.workMs,65000);assert.equal(report.releaseAcceptance,'NOT_PERFORMED');
  assert.ok(h.state.receipts.some(x=>x.startup.status==='STARTUP_PREPARED'&&x.startup.requestInvoked===null));
  assert.equal(h.state.receipts.at(-1).status,report.status);
});

test('resident experiment: occupied receipt refuses without preparation, worker or retry',async()=>{
  const h=rig(s=>{s.reserved=true;});
  await assert.rejects(runResidentRecognitionExperiment(['--run'],h.io),/RECEIPT_ALREADY_EXISTS/);
  assert.deepEqual(h.state.ops,['reserve']);assert.equal(h.state.prepared,0);assert.equal(h.state.factories,0);
});

for(const [name,change,expected] of [
  ['insufficient initial RAM',s=>{s.ram=2.9*GiB;},'EXPERIMENT_RAM_RESERVE'],
  ['unknown disk',s=>{s.disk=NaN;},'EXPERIMENT_DISK_RESERVE'],
  ['insufficient disk',s=>{s.disk=9.9*GiB;},'EXPERIMENT_DISK_RESERVE'],
  ['worker source unpinned',s=>{s.prepareError='RESIDENT_SOURCE_NOT_PINNED';},'RESIDENT_SOURCE_NOT_PINNED'],
  ['conflicting worker',s=>{s.conflicts=[{name:'whisper-cli.exe',pid:901}];},'EXPERIMENT_CONFLICTING_WORKERS'],
])test(`resident experiment: ${name} leaves all requests unperformed and preserves failure receipt`,async()=>{
  const h=rig(change),report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.status,'FAILED_OR_BLOCKED');assert.equal(report.error,expected);
  assert.equal(h.state.factories,0);assert.equal(report.startup.requestInvoked,false);
  assert.equal(report.notPerformed.length,3);assert.equal(report.nativeInference,'NOT_PERFORMED');assert.equal(h.state.closed,1);
  assert.equal(h.state.receipts.at(-1).error,expected);
});

test('resident experiment: reference mismatch preserves complete text but prevents remaining calls',async()=>{
  const h=rig(s=>{s.onTranscribe=async()=>({text:'Unexpected target order.'});}),report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.status,'FAILED_OR_BLOCKED');assert.equal(report.haltReason,'EXPERIMENT_TRANSCRIPT_MISMATCH');
  assert.equal(report.samples[0].status,'TRANSCRIPT_MISMATCH');assert.equal(report.samples[0].result.text,'Unexpected target order.');
  assert.equal(report.completedCount,1);assert.equal(report.referenceMatchedCount,0);assert.equal(report.notPerformed.length,2);
  assert.equal(h.state.requests.length,1);assert.equal(report.ownedProcessStopped,true);
});

test('resident experiment: second-request failure retains first result and precisely identifies unperformed remainder',async()=>{
  const h=rig(s=>{s.onTranscribe=async n=>{if(n===1)throw error('RESIDENT_WORKER_NATIVE_DECODE_FAILED');};});
  const report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.deepEqual(report.samples.map(x=>x.status),['TRANSCRIBED_REFERENCE_MATCH','FAILED','NOT_PERFORMED']);
  assert.equal(report.samples[1].result,null);assert.equal(report.samples[1].requestInvoked,true);
  assert.equal(report.completedCount,1);assert.deepEqual(report.notPerformed,[{ordinal:3,id:'VA-001'}]);
  assert.equal(h.state.requests.length,2);assert.equal(report.nativeInference,'MOCK_ONLY');assert.equal(report.ownedProcessStopped,true);
});

test('resident experiment: changed owned PID rejects result and stops without substituting a new worker',async()=>{
  const h=rig(s=>{s.onTranscribe=async()=>{s.pid=8422;};}),report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.error,'EXPERIMENT_WORKER_IDENTITY');assert.equal(report.samples[0].result,null);
  assert.equal(h.state.factories,1);assert.equal(h.state.requests.length,1);assert.equal(report.notPerformed.length,2);
});

test('resident experiment: request elapsed deadline rejects late text without waiting ten actual seconds',async()=>{
  const h=rig(s=>{s.onTranscribe=async()=>{s.clock+=10000;};}),report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.haltReason,'EXPERIMENT_REQUEST_DEADLINE');assert.equal(report.samples[0].result,null);
  assert.equal(report.samples[0].status,'FAILED');assert.equal(report.notPerformed.length,2);assert.equal(report.ownedProcessStopped,true);
});

test('resident experiment: startup deadline does not invoke any transcription',async()=>{
  const h=rig(s=>{s.onStart=async()=>{s.clock+=30000;};}),report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.haltReason,'EXPERIMENT_STARTUP_DEADLINE');assert.equal(report.startup.status,'FAILED');
  assert.equal(report.startup.requestInvoked,true);assert.equal(h.state.requests.length,0);assert.equal(report.notPerformed.length,3);
});

test('resident experiment: RAM loss after durable prepared checkpoint leaves actual request uninvoked',async()=>{
  const h=rig(s=>{s.onSave=report=>{if(report.samples[0].status==='SUBMISSION_PREPARED')s.ram=1.5*GiB;};});
  const report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.error,'EXPERIMENT_RAM_RESERVE');assert.equal(h.state.requests.length,0);
  assert.equal(report.samples[0].requestInvoked,false);assert.equal(report.samples[0].status,'NOT_PERFORMED');
  assert.equal(report.nativeInference,'NOT_PERFORMED');
  assert.equal(report.notPerformed.length,3);assert.equal(report.ownedProcessStopped,true);
  assert.ok(h.state.receipts.some(x=>x.samples[0].status==='SUBMISSION_PREPARED'&&x.samples[0].requestInvoked===null));
});

test('resident experiment: active RAM loss cancels pending transcription and retains failed/unperformed distinction',async()=>{
  const h=rig(s=>{s.onTranscribe=async(_n,{signal})=>{s.ram=1.5*GiB;await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));throw error('RECOGNITION_ABORTED');};});
  const report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.haltReason,'EXPERIMENT_RAM_RESERVE');assert.equal(report.samples[0].requestInvoked,true);
  assert.equal(report.samples[0].status,'FAILED');assert.equal(report.samples[0].result,null);
  assert.equal(report.notPerformed.length,2);assert.ok(h.state.stops>=1);assert.equal(report.ownedProcessStopped,true);
});

test('resident experiment: source change or unconfirmed disposal prevents a success claim',async()=>{
  const changed=rig(s=>{s.changedSources=true;});const first=await runResidentRecognitionExperiment(['--run'],changed.io);
  assert.equal(first.completedCount,3);assert.equal(first.status,'FAILED_OR_BLOCKED');assert.equal(first.sourceSnapshotUnchanged,false);
  const held=rig(s=>{s.unconfirmed=true;});const second=await runResidentRecognitionExperiment(['--run'],held.io);
  assert.equal(second.completedCount,3);assert.equal(second.status,'FAILED_OR_BLOCKED');assert.equal(second.ownedProcessStopped,false);
  assert.equal(second.cleanupError,'EXPERIMENT_CLEANUP_UNCONFIRMED');
});

test('resident experiment: checkpoint write failure before start launches nothing and closes exclusive receipt',async()=>{
  const h=rig(s=>{let once=true;s.onSave=report=>{if(once&&report.startup.status==='STARTUP_PREPARED'){once=false;throw error('RECEIPT_WRITE_FAILED');}};});
  const report=await runResidentRecognitionExperiment(['--run'],h.io);
  assert.equal(report.error,'RECEIPT_WRITE_FAILED');assert.equal(h.state.starts,0);assert.equal(report.startup.requestInvoked,false);
  assert.equal(h.state.closed,1);assert.equal(report.notPerformed.length,3);
});

test('resident experiment: fixed exclusive receipt handles partial writes and refuses zero progress',async()=>{
  const calls=[],pieces=[];let synced=0,closed=0;
  const writer=await reserveResidentRecognitionReceipt(async(file,flags)=>{calls.push({file,flags});return {
    async truncate(size){assert.equal(size,0);},async write(bytes,offset,length,position){assert.equal(offset,position);
      const count=Math.min(3,length);pieces.push(Buffer.from(bytes.subarray(offset,offset+count)));return {bytesWritten:count};},
    async sync(){synced++;},async close(){closed++;}};});
  await writer.save({classification:'MOCK_ONLY',status:'DONE'});await writer.close();
  assert.equal(calls[0].flags,'wx');assert.ok(calls[0].file.replaceAll('\\','/').endsWith(RESIDENT_RECOGNITION_RECEIPT));
  assert.deepEqual(JSON.parse(Buffer.concat(pieces).toString('utf8')),{classification:'MOCK_ONLY',status:'DONE'});
  assert.equal(synced,1);assert.equal(closed,1);
  const stalled=await reserveResidentRecognitionReceipt(async()=>({async truncate(){},async write(){return {bytesWritten:0};},async sync(){throw Error('not reached');},async close(){}}));
  await assert.rejects(stalled.save({}),/RECEIPT_WRITE_FAILED/);await stalled.close();
  await assert.rejects(reserveResidentRecognitionReceipt(async()=>{throw error('EEXIST');}),/RECEIPT_ALREADY_EXISTS/);
});

test('resident repair: predecessor gate and separate exclusive output preserve original attempt',async()=>{
  const h=rig(),r=await runResidentRecognitionExperiment(['--run-repair'],h.io);
  assert.equal(r.status,'PASS_RESIDENT_COMPONENT_SMOKE_ONLY');
  assert.equal(r.receipt,RESIDENT_RECOGNITION_REPAIR_RECEIPT);
  assert.notEqual(r.receipt,RESIDENT_RECOGNITION_RECEIPT);
  assert.equal(h.state.receiptPath,r.receipt);
  assert.equal(r.attempt,'TIMESTAMP_REPAIR_TRIAL');
  assert.deepEqual(h.state.ops.slice(0,2),['predecessor','reserve']);
  assert.equal(h.state.ops.filter(x=>x==='predecessor').length,2);
  assert.equal(h.state.starts,1);assert.equal(h.state.requests.length,3);
});

test('resident repair: check stays read-only and selects only the new receipt',async()=>{
  const h=rig(),r=await runResidentRecognitionExperiment(['--check-repair'],h.io);
  assert.equal(r.status,'PREFLIGHT_PASS_NO_INFERENCE');assert.equal(h.state.starts,0);
  assert.equal(h.state.receiptPath,RESIDENT_RECOGNITION_REPAIR_RECEIPT);
  assert.equal(h.state.reserved,false);assert.equal(r.receipt,null);
});

test('resident repair: changed historical evidence prevents reservation and worker construction',async()=>{
  const h=rig((s,io)=>{io.verifyPredecessor=async()=>{throw error('REPAIR_PREDECESSOR_CHANGED');};});
  await assert.rejects(runResidentRecognitionExperiment(['--run-repair'],h.io),/REPAIR_PREDECESSOR_CHANGED/);
  assert.equal(h.state.reserved,false);assert.equal(h.state.prepared,0);assert.equal(h.state.factories,0);
});

test('resident repair: historical drift during run prevents success after cleanup',async()=>{
  const h=rig((s,io)=>{let checks=0;io.verifyPredecessor=async()=>{if(++checks>1)throw error('REPAIR_PREDECESSOR_CHANGED');return {};};});
  const r=await runResidentRecognitionExperiment(['--run-repair'],h.io);
  assert.equal(r.status,'FAILED_OR_BLOCKED');assert.equal(r.error,'REPAIR_PREDECESSOR_CHANGED');
  assert.equal(r.ownedProcessStopped,true);assert.equal(r.sourceSnapshotUnchanged,false);
});

test('resident repair: receipt reservation rejects arbitrary paths before file I/O',async()=>{
  let opens=0;
  await assert.rejects(reserveResidentRecognitionReceipt(async()=>{opens++;},'research/anything.json'),/UNDECLARED_RECEIPT_PATH/);
  assert.equal(opens,0);
});
