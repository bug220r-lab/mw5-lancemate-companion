// Offline artifact acceptance checks. No game, editor, network or third-party code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.resolve(root, f), 'utf8');
const sha = f => createHash('sha256').update(fs.readFileSync(path.resolve(root, f))).digest('hex');
const json = f => JSON.parse(read(f));
const errors = []; const checks = [];
function check(name, predicate) { checks.push({ name, status: predicate ? 'PASS' : 'FAIL' });
  if (!predicate) errors.push(name); }
const docs = [
  'README.md', 'NEXT_CODEX_PROMPT.md', 'AGENTS.md',
  'design/OVERNIGHT_PROGRESS.md', 'design/OFFLINE_TACTICAL_PROTOTYPE.md',
  'design/TACTICAL_PLAYBOOK.md', 'design/PASSIVE_OBSERVER_HANDOFF.md',
  'research/AI_REPORT.md', 'research/AI_TECHNICAL_APPENDIX.md',
  'research/AI_COMBAT_ANALYSIS.md', 'research/AI_MOVEMENT_ANALYSIS.md',
  'research/AI_OTHER_UNITS_ANALYSIS.md', 'research/AI_CONTROL_SUPPORT_ANALYSIS.md',
  'research/OVERNIGHT_SOURCE_INDEPENDENT_REVIEW.md', 'research/CONTROL_SUPPORT_INDEPENDENT_REVIEW.md',
  'research/OTHER_UNITS_INDEPENDENT_REVIEW.md', 'research/TACTICAL_INDEPENDENT_REVIEW.md',
  'research/OVERNIGHT_HANDOFF.md'
];
check('Required documents exist', docs.every(f => fs.existsSync(path.resolve(root, f))));
const ledger = json('research/AI_COVERAGE_LEDGER.json');
check('Complete 249-entry reviewed collection with five explicit gaps', ledger.status === 'COLLECTED_SCOPE_REVIEWED_WITH_EXPLICIT_GAPS' &&
  ledger.inventoryCount === 249 && ledger.dispositions.SEMANTIC_REVIEWED === 167 &&
  ledger.dispositions.SUPPORTING_DATA_REVIEWED === 77 && ledger.dispositions.UNAVAILABLE === 5 && !ledger.errors.length);
check('372 preserved source/default artifacts', ledger.artifactCount === 372 &&
  ledger.assets.flatMap(a => a.artifacts).filter(a => a.kind === 'source').length === 244 &&
  ledger.assets.flatMap(a => a.artifacts).filter(a => a.kind === 'defaults').length === 128);
check('Raw source/default contents still match all 372 recorded hashes',
  ledger.assets.flatMap(a => a.artifacts).every(a => sha(a.file) === a.sha256));
check('Original collection receipt content still matches its recorded hash',
  sha(ledger.sourceReport.file) === ledger.sourceReport.sha256);
for (const f of ledger.reviewInputs) check(`Ledger current: ${f.file}`, sha(f.file) === f.sha256);
check('Unresolved references remain explicitly unreviewed metadata', ledger.dependencyTriage.count === 222 &&
  ledger.dependencyTriage.entries.every(d => d.classification === 'METADATA_TRIAGE_ONLY' && d.semanticReview === 'NOT_PERFORMED'));
const primary = json('research/OFFLINE_TACTICAL_RESULTS.json');
check('Primary 48 scenarios and three properties pass as MOCK_ONLY', primary.classification === 'MOCK_ONLY' &&
  primary.status === 'EXPECTATIONS_MET' && primary.scenarioCount === 48 && primary.propertyCount === 3 &&
  primary.failureCount === 0 && primary.gameplay === 'NOT_PERFORMED' && primary.nativeCalls === 0);
for (const f of primary.inputs) check(`Primary receipt current: ${f.file}`, sha(f.file) === f.sha256);
const review = read('research/TACTICAL_INDEPENDENT_REVIEW.md');
const cases = [...review.matchAll(/^\| IR\d+ \|.*\| (PASS|FAIL) \|$/gm)];
check('At least 24 independently specified adversarial cases all pass', cases.length >= 24 && cases.every(c => c[1] === 'PASS'));
check('Independent policy verdict passes and preserves synthetic boundary', review.includes('PASS — reviewed synthetic constraints hold') &&
  review.includes('MOCK_ONLY') && review.includes('NOT_PERFORMED'));
for (const m of review.matchAll(/^\| ([^|]+) \| ([a-f0-9]{64}) \|$/gm))
  check(`Independent receipt current: ${m[1].trim()}`, sha(m[1].trim()) === m[2]);
check('Original failing independent review retained', read('research/TACTICAL_INDEPENDENT_REVIEW_BEFORE_FIX.md').includes('FAIL — counterexamples require correction'));
const sourceReview = read('research/OVERNIGHT_SOURCE_INDEPENDENT_REVIEW.md');
check('Independent source integration review passes', /Final status: \*\*PASS —/.test(sourceReview) && sourceReview.includes('NOT_PERFORMED'));
const reviewedSources = [...sourceReview.matchAll(/^\| ([^|]+) \| `([a-f0-9]{64})` \|$/gm)];
check('Independent source review identifies all six inspected artifacts', reviewedSources.length === 6);
for (const m of reviewedSources)
  check(`Source-review identity current: ${m[1].trim()}`, sha(m[1].trim()) === m[2]);
const playbook = json('design/TACTICAL_PLAYBOOK.json');
const evidenceIds = new Set(playbook.rules.map(r => r.id));
check('Versioned playbook includes all six fully specified rules', playbook.version === '1.0.0' &&
  evidenceIds.size === 6 && playbook.rules.every(r => r.evidence.length && r.requiredObservations.length &&
    r.assumptions.length && r.abortConditions.length && r.status && r.expectedBenefit));
check('Every primary recommendation is unexecutable and references the playbook', primary.scenarios.every(c => c.traces.every(t =>
  t.recommendations.every(r => r.dispatchable === false && r.evidence.length && r.evidence.every(e => evidenceIds.has(e))))));
let localLinks = 0; let sourceLineLinks = 0; let anchors = 0;
const anchorCache = new Map();
const headingSlug = s => s.replace(/[*`]/g, '').toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
for (const doc of docs.filter(f => fs.existsSync(path.resolve(root, f)))) {
  for (const m of read(doc).matchAll(/\[[^\]\n]+\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
    let url = m[1] ?? m[2];
    if (/^(https?:|mailto:|codex:)/i.test(url)) continue;
    let [file, anchor] = url.split('#');
    const line = file.match(/:(\d+)$/); if (line) file = file.slice(0, -line[0].length);
    file = decodeURIComponent(file);
    const resolved = file ? path.resolve(path.dirname(path.resolve(root, doc)), file) : path.resolve(root, doc);
    localLinks++;
    if (resolved === path.resolve(root, 'research/OVERNIGHT_VALIDATION.json')) continue; // output produced below
    if (!fs.existsSync(resolved)) { errors.push(`Broken link ${doc}: ${url}`); continue; }
    if (line) { sourceLineLinks++; const count = read(resolved).trimEnd().split(/\r?\n/).length;
      if (+line[1] < 1 || +line[1] > count) errors.push(`Invalid line ${doc}: ${url}`); }
    if (anchor && path.extname(resolved).toLowerCase() === '.md') {
      anchors++;
      if (!anchorCache.has(resolved)) anchorCache.set(resolved,
        new Set([...read(resolved).matchAll(/^#{1,6}\s+(.+)$/gm)].map(h => headingSlug(h[1]))));
      if (!anchorCache.get(resolved).has(decodeURIComponent(anchor))) errors.push(`Broken anchor ${doc}: ${url}`);
    }
  }
}
const artifacts = [...docs, 'design/TACTICAL_PLAYBOOK.json', 'scripts/tactical-policy.mjs',
  'synthetic/tactical-cases.mjs', 'scripts/Exercise-TacticalPolicy.mjs', 'scripts/Review-TacticalPolicy.mjs',
  'scripts/Build-AIReviewIndex.mjs', 'scripts/Verify-OvernightPackage.mjs',
  'research/AI_COVERAGE_LEDGER.json', 'research/OFFLINE_TACTICAL_RESULTS.json',
  'research/TACTICAL_INDEPENDENT_REVIEW_BEFORE_FIX.md'];
const report = { schemaVersion: 1, generatedUtc: new Date().toISOString(),
  status: errors.length ? 'FAIL' : 'PASS_OFFLINE_PACKAGE', classification: 'STATIC_AND_MOCK_ONLY',
  gameplay: 'NOT_PERFORMED', nativeCalls: 0, checks, linkChecks: { localLinks, sourceLineLinks, anchors },
  scenarioCounts: { primary: primary.scenarioCount, generalProperties: primary.propertyCount, independent: cases.length },
  artifacts: artifacts.filter(f => fs.existsSync(path.resolve(root, f))).map(file => ({ file, sha256: sha(file) })), errors };
fs.writeFileSync(path.resolve(root, 'research/OVERNIGHT_VALIDATION.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: checks.length, ...report.linkChecks,
  scenarioCounts: report.scenarioCounts, errors }, null, 2));
process.exitCode = errors.length ? 1 : 0;
