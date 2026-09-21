// Scenario expectations derive from the design contract, not MW5 simulation.
export function baseline() {
  return { schemaVersion: 1, session: 'mission1', sequence: 1, observedAtMs: 1000, nowMs: 1000,
    phase: 'active', authority: true, leader: { pawnId: 'player', matchesNativeSquadLeader: true },
    targets: [{ id: 'enemy1', knownToLance: true, visibleToLance: true, allegiance: 'hostile',
      alive: true, observedAtMs: 1000, threat: 0.8 }],
    lancemates: [{ id: 'alpha', pawnId: 'pawn1', controllerId: 'controller1', generation: 1,
      member: true, reciprocalBinding: true, aiOwned: true, alive: true, configured: true, authority: true,
      manual: { observable: true, revision: 0, orderId: null, status: 'none', persistent: false },
      healthFraction: 1, heatFraction: 0.2, ammoAvailable: true, distanceToLeaderM: 100,
      weaponRangeM: { min: 0, max: 500 }, capabilities: ['regroup', 'focus', 'reposition'],
      safeRegroupKnown: true, engagements: [{ targetId: 'enemy1', distanceM: 300, lineOfFireKnownClear: true }], positions: [] }] };
}
const make = fn => { const x = baseline(); fn?.(x, x.lancemates[0]); return x; };
const step = (snapshot, actions, extra = {}) => ({ snapshot, expect: { actions, ...extra } });
const one = (id, purpose, fn, action, extra) => ({ id, purpose, steps: [step(make(fn), [action], extra)] });
const fresh = (s, n) => { s.sequence = n; s.nowMs = 1000 + n * 100; s.observedAtMs = s.nowMs;
  s.targets.forEach(t => { t.observedAtMs = s.nowMs; }); return s; };
const human = (a, status, persistent = false, revision = 1) => { a.manual = {
  observable: true, revision, orderId: 'human1', status, persistent }; };
const position = (id = 'position1') => ({ id, pathFeasible: true, occupied: false,
  saferThanCurrent: true, targetId: 'enemy1', distanceToTargetM: 300, lineOfFireKnownClear: true });
function squad(s) { const a = s.lancemates[0]; s.lancemates = ['alpha', 'bravo', 'charlie'].map((name, i) =>
  ({ ...structuredClone(a), id: name, pawnId: `pawn${i + 1}`, controllerId: `controller${i + 1}` })); }
function sequenceCase(id, purpose, first, second, actions1, actions2, extra = {}) {
  const a = make(first), b = fresh(structuredClone(a), 2); second(b, b.lancemates[0]);
  return { id, purpose, steps: [step(a, actions1), step(b, actions2, extra)] };
}
export const cases = [
  one('T01', 'Use a known visible hostile inside weapon range', null, 'FOCUS', { targetIds: ['enemy1'] }),
  one('T02', 'Reposition a short-range mech using supplied path evidence', (s, a) => { a.weaponRangeM.max = 150;
    a.positions = [{ ...position(), distanceToTargetM: 100 }]; }, 'REPOSITION'),
  one('T03', 'Protect a damaged mech with a supplied safer position', (s, a) => { a.healthFraction = 0.2;
    a.positions = [position()]; }, 'REPOSITION'),
  one('T04', 'Regroup a damaged mech only along a stipulated safe route', (s, a) => { a.healthFraction = 0.2; }, 'REGROUP'),
  one('T05', 'Do not invent a safe retreat', (s, a) => { a.healthFraction = 0.2; a.safeRegroupKnown = false; }, 'MAINTAIN'),
  one('T06', 'Regroup an isolated mech under fire', (s, a) => { a.distanceToLeaderM = 700; }, 'REGROUP'),
  one('T07', 'Do not follow an unverified native leader', (s, a) => { a.distanceToLeaderM = 700;
    s.leader.matchesNativeSquadLeader = false; }, 'FOCUS'),
  one('T08', 'Leave cooling to native combat', (s, a) => { a.heatFraction = 0.95; }, 'MAINTAIN'),
  one('T09', 'Do not recommend shooting without a usable ammunition opportunity', (s, a) => { a.ammoAvailable = false; }, 'MAINTAIN'),
  one('T10', 'Lost visibility is not a current firing opportunity', s => { s.targets[0].visibleToLance = false; }, 'MAINTAIN'),
  one('T11', 'Dead targets are ineligible', s => { s.targets[0].alive = false; }, 'MAINTAIN'),
  one('T12', 'Friendly targets are ineligible', s => { s.targets[0].allegiance = 'friendly'; }, 'MAINTAIN'),
  one('T13', 'Hidden targets cannot inform selection', s => { s.targets[0].knownToLance = false; }, 'MAINTAIN'),
  one('T14', 'Stale target observations cannot inform selection', s => { s.nowMs = 2101; s.observedAtMs = 2101; }, 'MAINTAIN'),
  { id: 'T15', purpose: 'Distribute a three-mech lance when an alternative target exists', steps: [step(make(s => {
    squad(s); s.targets.push({ ...s.targets[0], id: 'enemy2', threat: 0.7 });
    s.lancemates.forEach(a => a.engagements.push({ ...a.engagements[0], targetId: 'enemy2' }));
  }), ['FOCUS', 'FOCUS', 'FOCUS'], { targetIds: ['enemy1', 'enemy1', 'enemy2'] })] },
  { id: 'T16', purpose: 'A supplied location cannot be reserved by two teammates', steps: [step(make(s => {
    squad(s); s.lancemates.forEach(a => { a.weaponRangeM.max = 150;
      a.positions = [{ ...position(), distanceToTargetM: 100 }]; });
  }), ['REPOSITION', 'MAINTAIN', 'MAINTAIN'])] },
  sequenceCase('T17', 'Keep a useful target despite a small threat fluctuation', null, (s, a) => {
    s.targets.push({ ...s.targets[0], id: 'enemy2', threat: 0.9 });
    a.engagements.push({ ...a.engagements[0], targetId: 'enemy2' });
  }, ['FOCUS'], ['FOCUS'], { targetIds: ['enemy1'] }),
  one('T18', 'Human order immediately takes precedence', (s, a) => { human(a, 'active'); }, 'MAINTAIN'),
  sequenceCase('T19', 'Resume after matching verified completion', (s, a) => human(a, 'active'),
    (s, a) => human(a, 'completed'), ['MAINTAIN'], ['FOCUS']),
  sequenceCase('T20', 'A persistent order is not released by completion', (s, a) => human(a, 'active', true),
    (s, a) => human(a, 'completed', true), ['MAINTAIN'], ['DEFER']),
  sequenceCase('T21', 'Explicit release returns initiative', (s, a) => human(a, 'active', true),
    (s, a) => human(a, 'released', true), ['MAINTAIN'], ['FOCUS']),
  sequenceCase('T22', 'Missing order is not evidence of completion', (s, a) => human(a, 'active'),
    (s, a) => { a.manual = baseline().lancemates[0].manual; a.manual.revision = 1; }, ['MAINTAIN'], ['DEFER']),
  one('T23', 'Stale snapshots do not permit recommendations', s => { s.nowMs = 2001; }, 'DEFER'),
  sequenceCase('T24', 'Reject replayed sequence', null, s => { s.sequence = 1; }, ['FOCUS'], ['DEFER']),
  one('T25', 'Future observations are invalid', s => { s.observedAtMs = 1001; }, 'DEFER'),
  one('T26', 'Pause blocks tactical initiative', s => { s.phase = 'paused'; }, 'DEFER'),
  one('T27', 'Loading blocks tactical initiative', s => { s.phase = 'loading'; }, 'DEFER'),
  one('T28', 'Unknown world authority blocks tactical initiative', s => { s.authority = null; }, 'DEFER'),
  one('T29', 'Never direct a human-possessed mech', (s, a) => { a.aiOwned = false; }, 'DEFER'),
  sequenceCase('T30', 'Changed possession binding requires reobservation', null, (s, a) => {
    a.pawnId = 'newpawn'; a.generation = 2; }, ['FOCUS'], ['DEFER']),
  { id: 'T31', purpose: 'Duplicate recipients make the snapshot ambiguous', steps: [step(make(s => {
    s.lancemates.push(structuredClone(s.lancemates[0])); }), ['DEFER', 'DEFER'])] },
  one('T32', 'Missing heat observation is unknown, not zero', (s, a) => { delete a.heatFraction; }, 'DEFER'),
  one('T33', 'Unsupported actions are not selected', (s, a) => { a.capabilities = []; }, 'MAINTAIN'),
  one('T34', 'Unknown path cannot support repositioning', (s, a) => { a.weaponRangeM.max = 150;
    a.positions = [{ ...position(), distanceToTargetM: 100, pathFeasible: null }]; }, 'MAINTAIN'),
  one('T35', 'Unknown line of fire is not clear', (s, a) => { a.engagements[0].lineOfFireKnownClear = null; }, 'MAINTAIN'),
  one('T36', 'Occupied positions are excluded', (s, a) => { a.weaponRangeM.max = 150;
    a.positions = [{ ...position(), distanceToTargetM: 100, occupied: true }]; }, 'MAINTAIN'),
  one('T37', 'Correct leader alone does not establish a safe regroup path', (s, a) => {
    a.distanceToLeaderM = 700; a.safeRegroupKnown = null; }, 'FOCUS'),
  one('T38', 'Do not infer manual state from absent fields', (s, a) => { delete a.manual; }, 'DEFER'),
  sequenceCase('T39', 'Unrelated completion cannot release a player order', (s, a) => human(a, 'active'),
    (s, a) => { human(a, 'completed'); a.manual.orderId = 'different'; }, ['MAINTAIN'], ['DEFER']),
  sequenceCase('T40', 'Manual observation revision must not go backward', (s, a) => human(a, 'active', false, 2),
    (s, a) => human(a, 'released', false, 1), ['MAINTAIN'], ['DEFER']),
  one('T41', 'Unknown individual authority blocks that recipient', (s, a) => { a.authority = null; }, 'DEFER'),
  one('T42', 'Out-of-squad recipient is ineligible', (s, a) => { a.member = false; }, 'DEFER'),
  one('T43', 'Dead recipient is ineligible', (s, a) => { a.alive = false; }, 'DEFER'),
  { id: 'T44', purpose: 'Mixed weapon envelopes produce complementary recommendations', steps: [step(make(s => {
    squad(s); s.lancemates[1].weaponRangeM = { min: 0, max: 150 };
    s.lancemates[1].positions = [{ ...position(), distanceToTargetM: 100 }];
    s.lancemates[2].weaponRangeM = { min: 400, max: 800 };
  }), ['FOCUS', 'REPOSITION', 'MAINTAIN'])] },
  sequenceCase('T45', 'A large threat change can justify a new target', s => { s.targets[0].threat = 0.5; }, (s, a) => {
    s.targets.push({ ...s.targets[0], id: 'enemy2', threat: 0.9 });
    a.engagements.push({ ...a.engagements[0], targetId: 'enemy2' });
  }, ['FOCUS'], ['FOCUS'], { targetIds: ['enemy2'] }),
  one('T46', 'Unknown tactical values remain unknown', (s, a) => { a.healthFraction = null; }, 'DEFER'),
  one('T47', 'Unknown snapshot structure fails closed', s => { s.schemaVersion = 9; }, 'DEFER'),
  sequenceCase('T48', 'Mission replacement does not inherit target hysteresis', null, s => {
    s.session = 'mission2'; s.targets[0].visibleToLance = false; }, ['FOCUS'], ['MAINTAIN']),
];
