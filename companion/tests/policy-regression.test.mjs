// Policy v1.0.1: conservative unknown-persistence holds. All cases MOCK_ONLY.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decideSquad, POLICY_VERSION} from '../../scripts/tactical-policy.mjs';
import {baseline} from '../../synthetic/tactical-cases.mjs';

const initiative = output => output.recommendations.some(r => ['FOCUS','REGROUP','REPOSITION'].includes(r.action));
function active(persistence=null) {
  const s=baseline();
  s.lancemates[0].manual={observable:true,revision:1,orderId:'human-one',status:'active',persistent:persistence};
  return s;
}
function next(s, status='none', persistence=false, orderId='human-one', revision=1) {
  const n=structuredClone(s); n.sequence++; n.observedAtMs+=100; n.nowMs=n.observedAtMs;
  n.targets.forEach(t=>{t.observedAtMs=n.nowMs;});
  n.lancemates[0].manual={observable:true,revision,orderId:status==='none'?null:orderId,status,persistent:persistence};
  return n;
}
function sequence(...frames) {
  let state=null;
  return frames.map(s=>{const r=decideSquad(s,state);state=r.state;return r;});
}
const held = r => r.state.actors.alpha.heldHumanOrder;

test('policy patch is versioned without changing snapshot/state schema',()=>{
  assert.equal(POLICY_VERSION,'1.0.1');
  const r=decideSquad(active());
  assert.equal(r.state.schemaVersion,1);
  assert.equal(r.classification,'MOCK_ONLY');
  assert.ok(r.recommendations.every(x=>x.dispatchable===false));
});

for(const persistence of [null,undefined,'unknown',0]) {
  test(`known active order with unproven persistence ${String(persistence)} survives disappearance`,()=>{
    const a=active(persistence);
    if(persistence===undefined) delete a.lancemates[0].manual.persistent;
    const before=structuredClone(a), b=next(a), r=sequence(a,b);
    assert.equal(initiative(r[0]),false); assert.equal(initiative(r[1]),false);
    assert.equal(held(r[1]).id,'human-one');
    assert.equal(held(r[1]).persistent,true,'conservative policy hold, not an observed game flag');
    assert.deepEqual(a,before,'unknown input must stay unknown and unmodified');
  });
}

test('unknown persistence cannot be resolved by elapsed time, completion or a weakening active report',()=>{
  const a=active(), b=next(a,'active',false), c=next(b,'completed',false);
  const r=sequence(a,b,c);
  assert.ok(r.every(x=>!initiative(x)));
  assert.equal(held(r[2]).persistent,true);
  let s=c, last=r[2];
  for(let i=0;i<20;i++) {s=next(s);last=decideSquad(s,last.state);assert.equal(initiative(last),false);}
});

test('matching explicit release permits autonomy after an unknown-persistence hold',()=>{
  const a=active(), b=next(a,'released',false);
  const r=sequence(a,b);
  assert.equal(held(r[0]).persistent,true); assert.equal(held(r[1]),null);
  assert.equal(initiative(r[1]),true);
});

test('wrong or stale release cannot clear an unknown-persistence hold',()=>{
  for(const [orderId,revision] of [['different',2],['human-one',0]]) {
    const a=active(), b=next(a,'released',false,orderId,revision), r=sequence(a,b);
    assert.equal(initiative(r[1]),false); assert.equal(held(r[1]).id,'human-one');
  }
});

test('unknown-persistence order latches before pause or binding eligibility gates',()=>{
  for(const alter of [s=>{s.phase='paused';},s=>{s.authority=null;},s=>{s.lancemates[0].aiOwned=false;}]) {
    const a=active();alter(a);
    const b=next(a);b.phase='active';b.authority=true;b.lancemates[0].aiOwned=true;
    const c=next(b), r=sequence(a,b,c);
    assert.ok(r.every(x=>!initiative(x))); assert.equal(held(r[2]).id,'human-one');
  }
});

test('unknown-persistence hold survives absence and a subsequent nonpersistent completion',()=>{
  const a=active(), b=next(a), c=next(b,'completed',false);
  b.lancemates[0].id='bravo';b.lancemates[0].pawnId='pawn-b';b.lancemates[0].controllerId='controller-b';
  const r=sequence(a,b,c);
  assert.equal(initiative(r[2]),false); assert.equal(held(r[2]).persistent,true);
});

test('stale/future snapshot and unobserved or unidentified commands do not manufacture a human hold',()=>{
  for(const alter of [s=>{s.nowMs=s.observedAtMs+1001;},s=>{s.nowMs=s.observedAtMs-1;},
    s=>{s.lancemates[0].manual.observable=false;},s=>{s.lancemates[0].manual.orderId=null;},
    s=>{s.lancemates[0].manual.revision=null;}]) {
    const a=active();alter(a);const r=decideSquad(a);
    assert.equal(initiative(r),false);assert.ok(!r.state.actors.alpha?.heldHumanOrder);
  }
});

test('new unknown order cannot supersede a newer held human order by regressing revision',()=>{
  const a=active(true);a.lancemates[0].manual.revision=5;
  const b=next(a,'active',null,'older-order',4), r=sequence(a,b);
  assert.equal(held(r[1]).id,'human-one');assert.equal(held(r[1]).revision,5);
});

test('existing known nonpersistent completion and mission reset behavior remain unchanged',()=>{
  const a=active(false), b=next(a,'completed',false), r=sequence(a,b);
  assert.equal(initiative(r[1]),true);
  const unknown=active(), fresh=baseline();fresh.session='different-mission';
  assert.equal(initiative(sequence(unknown,fresh)[1]),true);
});

// Execute the existing project-owned suites, replacing only their receipt writer
// with an in-memory sink. The exact historical paths are allowlisted; unexpected
// writes throw. Assertions check unchanged on-disk hashes before/after. This
// reruns the ORIGINAL assertions, not a reimplementation of their branches.
for(const [runner,receipt,count,kind] of [
  ['Exercise-TacticalPolicy.mjs','OFFLINE_TACTICAL_RESULTS.json',48,'scenarios'],
  ['Review-TacticalPolicy.mjs','TACTICAL_INDEPENDENT_REVIEW.md',31,'review'],
]) test(`historical ${runner} passes without overwriting its receipt`, async t=>{
  const receiptUrl=new URL(`../../research/${receipt}`,import.meta.url);
  const expectedPath=fileURLToPath(receiptUrl);
  const digest=()=>createHash('sha256').update(fs.readFileSync(receiptUrl)).digest('hex');
  const before=digest(), captures=[], oldExitCode=process.exitCode;
  const writer=t.mock.method(fs,'writeFileSync',(path,content)=>{
    assert.equal(String(path),expectedPath,'unexpected write was blocked');
    captures.push(String(content));
  });
  try {
    await import(new URL(`../../scripts/${runner}?policy-regression-v1.0.1`,import.meta.url));
    assert.equal(process.exitCode,0);
    assert.equal(captures.length,1);
    if(kind==='scenarios') {
      const report=JSON.parse(captures[0]);
      assert.equal(report.scenarioCount,count);assert.equal(report.propertyCount,3);
      assert.equal(report.failureCount,0);assert.equal(report.policyVersion,'1.0.1');
      assert.equal(report.classification,'MOCK_ONLY');assert.equal(report.gameplay,'NOT_PERFORMED');
    } else {
      assert.ok(captures[0].includes(`${count}/${count} independent adversarial cases pass`));
      assert.ok(captures[0].includes('PASS — reviewed synthetic constraints hold'));
    }
  } finally {
    writer.mock.restore();process.exitCode=oldExitCode;
    assert.equal(digest(),before,'historical receipt must remain byte-for-byte unchanged');
  }
});
