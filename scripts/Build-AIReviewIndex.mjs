// Combines explicitly authored semantic reviews; never invents review dispositions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const sha = p => createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const collection = json(`${base}/report.json`), coverage = json(`${base}/coverage.json`);
const reviewFiles = ['combat', 'movement', 'other-units', 'control-support'].map(n => `research/coverage/${n}.json`);
const records = reviewFiles.flatMap(file => json(file).assets.map(a => ({ ...a, reviewFile: file })));
const errors = [], verified = [];
const countLines = new Map();
function checkCitation(c, owner) {
  const full = path.resolve(root, c.file);
  if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) { errors.push(`${owner}: missing/outside citation ${c.file}`); return; }
  if (!countLines.has(full)) countLines.set(full, fs.readFileSync(full, 'utf8').trimEnd().split(/\r?\n/).length);
  if (!Array.isArray(c.lines) || c.lines.length !== 2 || !c.lines.every(Number.isInteger) ||
      c.lines[0] < 1 || c.lines[1] < c.lines[0] || c.lines[1] > countLines.get(full)) errors.push(`${owner}: invalid lines ${c.file}:${c.lines}`);
}
const assets = collection.assets.map((a, id) => {
  const found = records.filter(r => r.id === id);
  if (found.length !== 1) errors.push(`Asset ${id}: ${found.length} review records`);
  const review = found[0] ?? { id, disposition: 'UNREVIEWED', summary: '', evidence: [], limitations: [] };
  if (!review.summary || !review.evidence?.length || !review.limitations?.length) errors.push(`Asset ${id}: incomplete review`);
  review.evidence?.forEach(c => checkCitation(c, `Asset ${id}`));
  const artifacts = [];
  for (const kind of ['source', 'defaults']) if (a[kind]?.file) {
    const file = `${base}/${path.basename(a[kind].file)}`, actual = sha(file), expected = a[kind].sha256.toLowerCase();
    if (actual !== expected) errors.push(`Hash mismatch ${file}`);
    artifacts.push({ kind, file, sha256: actual }); verified.push(file);
    if (!review.evidence?.some(c => c.file.replaceAll('\\', '/') === file)) errors.push(`Asset ${id}: uncited ${kind} export`);
  }
  if (a.source?.file && !['SEMANTIC_REVIEWED', 'SUPPORTING_DATA_REVIEWED'].includes(review.disposition)) errors.push(`Asset ${id}: ${review.disposition}`);
  return { ...review, package: a.package, registryClass: a.registry_asset_class ?? null,
    collectionStatus: a.status, artifacts };
});
if (records.length !== 249 || new Set(records.map(r => r.id)).size !== 249) errors.push('Review inventory is not exactly 249 unique entries');
const playbook = json('design/TACTICAL_PLAYBOOK.json');
for (const rule of playbook.rules) for (const ref of rule.evidence) {
  const artifact = assets[ref.assetId]?.artifacts.find(a => a.kind === ref.kind);
  if (!artifact) errors.push(`${rule.id}: missing evidence asset ${ref.assetId}`);
  else checkCitation({ file: artifact.file, lines: ref.lines }, rule.id);
}
function triage(p) {
  if (p === '/Script/MechWarrior') return ['NATIVE_IMPLEMENTATION_GAP', 'Native targeting, scheduling, authority and control implementations are not recovered from declarations.'];
  if (p === '/Script/VictoryBPLibrary' || p === '/Script/LowEntryJson') return ['TRANSPORT_DEPENDENCY_UNVERIFIED', 'Installed declarations do not establish bounded asynchronous shipping transport.'];
  if (p.endsWith('/MW5_FunctionLibrary')) return ['KNOWN_COLLECTION_GAP', 'Deferred large library; target AddUnitToSpawnQueue body only if needed.'];
  if (p.startsWith('/Game/AI/')) return ['KNOWN_COLLECTION_GAP', 'Invalid/redirected metadata; do not substitute an apparent alternate path without evidence.'];
  if (/LanceOrder(Window|Widget)|LanceMemberWidget|Dpad_Layout|Dpad_ActionResponse/.test(p)) return ['MANUAL_INPUT_FOLLOWUP', 'Potential completion of UI input/delegate provenance; no auto-export.'];
  if (p.startsWith('/Script/') || p.startsWith('/Engine/')) return ['ENGINE_OR_PLUGIN_REFERENCE', 'Metadata reference only; use applicable documentation for called semantics, not guessed bodies.'];
  if (/\/Audio\/|\/Textures\/|\/Materials\/|VisibiltyMarker|VisibilityMarker|PaperDoll|\/Chroma\//.test(p)) return ['PRESENTATION_OR_PERCEPTION_SUPPORT', 'Lower priority for tactical decisions; visibility markers are not perception algorithms.'];
  if (/\/Commendations\/|\/Progression\//.test(p)) return ['PILOT_PROGRESSION_BOUNDARY', 'Specific commendation/progression data outside collected scope; no inferred tactical learning.'];
  if (/\/LevelGenerators\/|\/Encounter|\/Spawners\/|\/UnitCards\/|\/TerrainChunks\/|\/MissionDirector|\/Leopard\//.test(p)) return ['SPAWN_ASSIGNMENT_FOLLOWUP', 'May affect population, initialization or encounter timing; exact behavior outside current source boundary.'];
  if (/\/Objects\/Humans\/|AbstractVTOL/.test(p)) return ['UNIT_LIFECYCLE_FOLLOWUP', 'Concrete unit implementation may refine assignment or firing; not implied by controller names.'];
  if (/\/Libraries\/|\/Modes\/DefaultGameState|PlayerControllerComponents/.test(p)) return ['LIFECYCLE_OR_HELPER_FOLLOWUP', 'Read only when a named unresolved caller/assignment requires it.'];
  return ['SUPPORTING_REFERENCE_UNREVIEWED', 'Reference inventoried; execution and significance not established. No exhaustive game-wide dependency claim.'];
}
const dependencies = coverage.unresolved_dependency_frontier.map(d => {
  const [category, reason] = triage(d.package); return { package: d.package, referencedBy: d.referenced_by,
    category, reason, classification: 'METADATA_TRIAGE_ONLY', semanticReview: 'NOT_PERFORMED' };
});
const counts = xs => xs.reduce((o, x) => (o[x] = (o[x] ?? 0) + 1, o), {});
const ledger = { schemaVersion: 1, generatedUtc: new Date().toISOString(), classification: 'STATIC_SOURCE_REVIEW',
  status: errors.length ? 'INCOMPLETE_OR_INVALID' : 'COLLECTED_SCOPE_REVIEWED_WITH_EXPLICIT_GAPS',
  meaning: 'Review of the collected exposed source and supporting data; not all native internals or gameplay.',
  applicability: 'Editor 1.1.390.0e / UE4.26.2; shipping-game validation NOT_PERFORMED',
  inventoryCount: assets.length, artifactCount: verified.length, dispositions: counts(assets.map(a => a.disposition)),
  sourceReport: { file: `${base}/report.json`, sha256: sha(`${base}/report.json`) },
  reviewInputs: reviewFiles.map(file => ({ file, sha256: sha(file) })), assets,
  dependencyTriage: { count: dependencies.length, categories: counts(dependencies.map(d => d.category)), entries: dependencies }, errors };
fs.writeFileSync(path.join(root, 'research/AI_COVERAGE_LEDGER.json'), JSON.stringify(ledger, null, 2) + '\n');
let md = '# Collected AI source review ledger\n\n' + ledger.status + '. Reviewed ' + ledger.inventoryCount +
  ' inventory entries and verified ' + verified.length + ' source/default artifact hashes. This is static review, not gameplay validation.\n\n' +
  'Each summary is authored from semantic inspection; this script only combines records and checks citations, completeness and hashes. Supporting-data review does not claim exhaustive correctness of unrelated utility/UI code.\n\n' +
  '| ID | Asset | Disposition | Reviewed meaning |\n|---|---|---|---|\n';
for (const a of assets) md += `| ${a.id} | ${a.package} | ${a.disposition} | ${a.summary.replaceAll('|', '\\|').replaceAll('\n', ' ')} |\n`;
md += '\n## Explicit gaps\n\n' + assets.filter(a => !a.artifacts.some(f => f.kind === 'source')).map(a => `- ${a.package}: ${a.summary}`).join('\n') +
  '\n\nDependency triage covers ' + dependencies.length + ' unresolved metadata references. It is categorization, not source review; the exact callers and rationales are in [the JSON ledger](AI_COVERAGE_LEDGER.json).\n';
fs.writeFileSync(path.join(root, 'research/AI_COVERAGE_LEDGER.md'), md);
console.log(JSON.stringify({ status: ledger.status, assets: assets.length, artifacts: verified.length, dispositions: ledger.dispositions, dependencies: dependencies.length, errors }, null, 2));
process.exitCode = errors.length ? 1 : 0;
