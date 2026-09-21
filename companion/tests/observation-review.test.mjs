// Independent adversarial contract tests. All records are synthetic; no game runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {replayFrames, validateObservation} from '../observation.mjs';
import {ControlSession} from '../control.mjs';

function frame(sequence=1, change=()=>{}) {
  const time=1000+(sequence-1)*100;
  const actor={id:'alpha',pawnId:'pawn-a',controllerId:'controller-a',generation:3,
    member:true,reciprocalBinding:true,aiOwned:true,alive:true,configured:true,authority:true,
    manual:{observable:true,revision:0,orderId:null,status:'none',persistent:false},
    healthFraction:1,heatFraction:.2,ammoAvailable:true,distanceToLeaderM:100,
    weaponRangeM:{min:0,max:500},capabilities:['focus','regroup','reposition'],
    safeRegroupKnown:true,engagements:[{targetId:'enemy-a',distanceM:250,lineOfFireKnownClear:true}],positions:[]};
  const snapshot={schemaVersion:1,session:'review-mission',sequence,observedAtMs:time,nowMs:time,
    phase:'active',authority:true,leader:{pawnId:'player',matchesNativeSquadLeader:true},
    targets:[{id:'enemy-a',knownToLance:true,visibleToLance:true,allegiance:'hostile',alive:true,observedAtMs:time,threat:.8}],lancemates:[actor]};
  const result={schemaVersion:1,kind:'observation',provenance:'MOCK_ONLY',adapterId:'independent-review',
    session:snapshot.session,sequence,observedAtMs:time,snapshot};
  change(result,snapshot,actor);
  return result;
}
const replay = xs => replayFrames(xs,{allowSynthetic:true});
const recommendations = r => r.decision?.recommendations ?? [];
const tactical = r => recommendations(r).some(x => ['FOCUS','REGROUP','REPOSITION'].includes(x.action));
const active = (actor,persistent=true) => { actor.manual={observable:true,revision:7,orderId:'player-hold',status:'active',persistent}; };

test('review: repeating a regressed generation cannot lower the accepted binding watermark',()=>{
  const frames=[frame(1),... [2,3,4].map(n=>frame(n,(f,s,a)=>{a.generation=2;}))];
  const r=replay(frames);
  assert.equal(tactical(r.results[0]),true);
  for(let n=1;n<r.results.length;n++) {
    assert.equal(r.results[n].accepted,false,`regressed generation accepted at frame ${n+1}`);
    assert.equal(tactical(r.results[n]),false,`regressed binding produced tactics at frame ${n+1}`);
  }
});

test('review: a rejected pawn change cannot become valid merely by being repeated without generation advance',()=>{
  const r=replay([frame(1),...[2,3,4].map(n=>frame(n,(f,s,a)=>{a.pawnId='replacement-pawn';}))]);
  for(let n=1;n<r.results.length;n++) {
    assert.equal(r.results[n].accepted,false,`unversioned pawn change accepted at frame ${n+1}`);
    assert.equal(tactical(r.results[n]),false);
  }
});

test('review: relabeling the same live binding cannot bypass its active human hold',()=>{
  const held=frame(1,(f,s,a)=>active(a));
  const relabeled=frame(2,(f,s,a)=>{a.id='bravo';});
  const r=replay([held,relabeled]);
  assert.equal(tactical(r.results[0]),false);
  assert.equal(tactical(r.results[1]),false,'same pawn/controller cannot lose hold under a new member label');
});

test('review: an absent held binding cannot return under a new member label with autonomy',()=>{
  const held=frame(1,(f,s,a)=>active(a));
  const absent=frame(2,(f,s,a)=>{a.id='charlie';a.pawnId='pawn-c';a.controllerId='controller-c';});
  const relabeled=frame(3,(f,s,a)=>{a.id='bravo';});
  const r=replay([held,absent,relabeled]);
  assert.equal(tactical(r.results[2]),false,'temporary absence cannot launder a held live binding');
});

test('review: target observations newer than their enclosing snapshot cannot justify focus',()=>{
  const f=frame(1,(f,s)=>{f.replayNowMs=1200;s.targets[0].observedAtMs=1100;});
  const r=replay([f]);
  assert.equal(tactical(r.results[0]),false,'caller/replay clock cannot make an internally future target part of an earlier sample');
});

test('review: explicit stale engagement evidence cannot be treated as freshly derived range and clear fire',()=>{
  const f=frame(20,(f,s,a)=>{a.engagements[0].observedAtMs=1000;});
  const r=replay([f]);
  assert.equal(tactical(r.results[0]),false,'stale supplied range/fire evidence must not be silently promoted by the envelope timestamp');
});

test('review: explicit future position evidence cannot justify a protective reposition',()=>{
  const f=frame(1,(f,s,a)=>{a.healthFraction=.1;a.safeRegroupKnown=false;
    a.positions=[{id:'cover',pathFeasible:true,occupied:false,saferThanCurrent:true,
      targetId:'enemy-a',distanceToTargetM:250,lineOfFireKnownClear:true,observedAtMs:2000}];});
  assert.equal(tactical(replay([f]).results[0]),false,'future path/position claims cannot authorize repositioning');
});

test('review: an observed active human order with unknown persistence cannot vanish on a later none report',()=>{
  const unknown=frame(1,(f,s,a)=>active(a,null));
  const none=frame(2,(f,s,a)=>{a.manual.revision=7;});
  const r=replay([unknown,none]);
  assert.equal(tactical(r.results[0]),false);
  assert.equal(tactical(r.results[1]),false,'unknown persistence requires verified completion/release, not disappearance');
});

test('review: null knowledge/visibility and targets stale relative to caller time do not justify focus',()=>{
  for(const change of [
    (f,s)=>{s.targets[0].visibleToLance=null;},
    (f,s)=>{s.targets[0].knownToLance=null;},
    (f,s)=>{f.replayNowMs=2000;s.targets[0].observedAtMs=999;},
    (f,s)=>{s.targets[0].observedAtMs=1001;},
  ]) assert.equal(tactical(replay([frame(1,change)]).results[0]),false);
});

test('review: timestamp/sequence rejection cannot release a previously latched human order',()=>{
  const hold=frame(1,(f,s,a)=>active(a));
  const stale=frame(2,(f,s,a)=>{active(a);a.manual.status='released';f.replayNowMs=10000;});
  const none=frame(3,(f,s,a)=>{a.manual.revision=7;});
  const r=replay([hold,stale,none]);
  assert.equal(r.results[1].decision,null);
  assert.equal(tactical(r.results[2]),false);
});

test('review: caller time remains authoritative and validation does not bless asserted game provenance',()=>{
  const f=frame(1,(f,s)=>{f.provenance='GAME_OBSERVED';s.nowMs=1e9;});
  const r=validateObservation(f,{nowMs:1100});
  assert.equal(r.classification,'GAME_OBSERVED_UNVALIDATED');
  assert.equal(r.snapshot.nowMs,1100);
  for(const x of recommendations(replayFrames([f]).results[0])) assert.equal(x.dispatchable,false);
});

for(const humanGeneration of [3,4]) test(`review: human possession at generation ${humanGeneration} revokes that generation for AI return`,()=>{
  const frames=[frame(1),frame(2,(f,s,a)=>{a.aiOwned=false;a.generation=humanGeneration;}),
    frame(3,(f,s,a)=>{a.generation=humanGeneration;}),frame(4,(f,s,a)=>{a.generation=humanGeneration;}),
    frame(5,(f,s,a)=>{a.generation=humanGeneration+1;}),frame(6,(f,s,a)=>{a.generation=humanGeneration+1;})];
  const r=replay(frames);
  for(const index of [1,2,3]) {
    assert.equal(r.results[index].accepted,false,`ownership transition accepted old generation at frame ${index+1}`);
    assert.equal(tactical(r.results[index]),false);
  }
  assert.equal(tactical(r.results[4]),false,'first valid new-generation frame is a binding reobservation');
  assert.equal(tactical(r.results[5]),true,'fresh coherent generation can restore independent tactics');
  let now=0;
  const control=new ControlSession({mode:'MOCK_ONLY',now:()=>now});
  const receipts=frames.map(f=>{now=f.observedAtMs;return control.ingest(f);});
  for(const index of [1,2,3]) {
    assert.equal(receipts[index].ok,false,`control accepted old generation at frame ${index+1}`);
    assert.equal(receipts[index].recommendations.some(x=>['FOCUS','REGROUP','REPOSITION'].includes(x.action)),false);
  }
});
