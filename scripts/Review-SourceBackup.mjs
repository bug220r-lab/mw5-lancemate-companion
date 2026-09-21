// Project-authored, offline source-backup review. This never stages, commits,
// contacts GitHub, reads .git contents, or prints matched credential values.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = 'research/SOURCE_BACKUP_REVIEW.json';
const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['.md', '.json', '.mjs', '.js', '.py', '.ps1', '.cmd', '.html', '.css', '.txt']);
const SOURCE_ROOTS = new Set(['audio', 'companion', 'design', 'research', 'scripts', 'synthetic']);
const ROOT_FILES = new Set(['.gitignore', 'AGENTS.md', 'README.md', 'NEXT_CODEX_PROMPT.md', 'START_COMPANION.cmd']);
const SKIP_TREES = new Map([
  ['.git', 'Git administration and credentials are outside source review; directory was not opened.'],
  ['companion/local', 'Downloaded models, native runtimes, virtual environments, generated media and local runtime logs.'],
  ['tmp', 'Scratch work, downloaded third-party source/media and intermediate inspection material.'],
  ['research/evidence', 'Raw proprietary game/editor exports, generated native declarations, screenshots and downloaded third-party source.'],
]);
const MEDIA = new Set(['.wav', '.mp3', '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf']);
const BINARY = new Set(['.exe', '.dll', '.zip', '.7z', '.tar', '.gz', '.whl', '.bin', '.gguf', '.onnx', '.pt', '.pth', '.pak', '.uasset', '.umap', '.copy', '.pyc', '.pyd', '.sqlite', '.sqlite3', '.db']);
const LOCAL_NAME = /^(?:\.env(?:\..*)?|credentials(?:\..*)?|secrets?(?:\..*)?|token(?:\..*)?|id_rsa|id_ed25519|cookies(?:\..*)?)$/i;

// These rules emit only a type and source line. Deliberately no matched values,
// value hashes, excerpts or JSON values are put in the receipt or stdout.
const RULES = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  ['GITHUB_TOKEN', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['OPENAI_OR_PROVIDER_KEY', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/g],
  ['HUGGINGFACE_TOKEN', /\bhf_[A-Za-z0-9]{20,}\b/g],
  ['AWS_ACCESS_KEY', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  ['BEARER_CREDENTIAL', /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi],
  ['EMBEDDED_URL_CREDENTIAL', /https?:\/\/[^\s/@:'"<>]+:[^\s/@'"<>]+@/gi],
  ['SIGNED_OR_AUTHENTICATED_URL', /[?&](?:access_token|refresh_token|auth|token|signature|X-Amz-Signature|X-Goog-Signature|sig)=[^\s&#'"<>]{8,}/gi],
  ['EPIC_LOGIN_COMMAND', /-(?:AUTH_PASSWORD|AUTH_LOGIN)=([^\s"']{4,}|"[^"\r\n]{4,}"|'[^'\r\n]{4,}')/gi],
  ['STEAM_ACCOUNT_ID', /\b76561\d{12}\b/g],
];
const LITERAL_CREDENTIAL = /["']?\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|secret[_-]?key|authorization|xi-api-key)\b["']?\s*[:=]\s*(["'])([^"'\r\n]{4,})\1/gi;
const PLACEHOLDER = /^(?:<[^>]+>|\$\{[^}]+\}|(?:your|example|placeholder|dummy|fake|test|not[-_ ]?a[-_ ]?real|redacted|none|null|undefined)(?:[-_ ].*)?|Bearer\s+\$.*)$/i;

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.split(path.sep).join('/');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

export function scanText(text) {
  const findings = [];
  for (const [rule, regex] of RULES) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) findings.push({ rule, line: lineAt(text, match.index), disposition: 'REQUIRES_REVIEW' });
  }
  LITERAL_CREDENTIAL.lastIndex = 0;
  for (const match of text.matchAll(LITERAL_CREDENTIAL)) {
    // Explicit documentation placeholders are harmless, but still counted.
    findings.push({ rule: 'CREDENTIAL_LITERAL', line: lineAt(text, match.index), disposition: PLACEHOLDER.test(match[2]) ? 'PLACEHOLDER_ONLY' : 'REQUIRES_REVIEW' });
  }
  const seen = new Set();
  return findings.filter(item => { const k = `${item.rule}:${item.line}:${item.disposition}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function category(rel) {
  if (rel.startsWith('scripts/') || rel.startsWith('companion/') || rel.endsWith('.cmd')) return 'PROJECT_SOURCE_OR_CONFIGURATION';
  if (rel.startsWith('synthetic/')) return 'PROJECT_SYNTHETIC_FIXTURE';
  if (rel.startsWith('research/')) return 'AUTHORED_RESEARCH_OR_RECEIPT';
  if (rel.startsWith('audio/')) return 'AUDITION_TEXT_OR_METADATA_ONLY';
  return 'PROJECT_DOCUMENTATION';
}

function contentNotes(text, rel) {
  const notes = [];
  if (/C:[\\/]+Users[\\/]+jlewi/i.test(text)) notes.push('Contains the local Windows username/path; personal project backup is intended to remain private.');
  if (/(?:research[\\/]evidence[\\/]|(?:\.\.\/)?evidence\/)/.test(text)) notes.push('References evidence deliberately excluded from this source-only backup; those paths will not resolve in a clean checkout.');
  if (/"(?:runtimeLog|stderr|stdout|log_lines|log_fields|launch_arguments)"\s*:/.test(text)) notes.push('Contains bounded authored execution/log metadata; scanned for credentials, not treated as a raw account-log dump.');
  if (rel.startsWith('audio/')) notes.push('Audio payloads are deliberately excluded; this retains only original text, settings, provenance and feedback.');
  return notes;
}

export function reviewSource(root = ROOT) {
  const reviewed = [], excluded = [], blockers = [];
  function walk(relative = '') {
    const absolute = path.join(root, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = slash(path.join(relative, entry.name));
      const abs = path.join(root, rel);
      if (SKIP_TREES.has(rel)) { excluded.push({ path: `${rel}/`, kind: 'WHOLE_TREE', reason: SKIP_TREES.get(rel), contentRead: false }); continue; }
      if (entry.isSymbolicLink() || fs.lstatSync(abs).isSymbolicLink()) { excluded.push({ path: rel, kind: 'LINK', reason: 'Do not follow symlinks/reparse links into other projects or external data.', contentRead: false }); continue; }
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__' || entry.name === 'node_modules' || entry.name === '.venv') { excluded.push({ path: `${rel}/`, kind: 'WHOLE_TREE', reason: 'Local dependency/cache directory.', contentRead: false }); continue; }
        if (!relative && !SOURCE_ROOTS.has(entry.name)) { blockers.push({ path: rel, reason: 'Unrecognized top-level directory requires a separate scope decision.' }); continue; }
        walk(rel); continue;
      }
      if (!entry.isFile()) { blockers.push({ path: rel, reason: 'Nonregular filesystem entry.' }); continue; }
      if (rel === REPORT) continue; // Self receipt is appended to the explicit allowlist without a recursive self hash.
      const ext = path.extname(rel).toLowerCase();
      const stat = fs.statSync(abs);
      const reasons = [];
      if (MEDIA.has(ext)) reasons.push('Media payload: source-only backup retains authored manifests rather than audio/screenshots/downloaded documents.');
      if (BINARY.has(ext)) reasons.push('Binary/model/archive/game asset/database payload is excluded.');
      if (LOCAL_NAME.test(entry.name) || ['.log', '.pem', '.key', '.pfx', '.p12', '.jks'].includes(ext)) reasons.push('Potential credential, private key or local log file is excluded without reading its values.');
      if (reasons.length) { excluded.push({ path: rel, kind: 'FILE', bytes: stat.size, reason: reasons.join(' '), contentRead: false }); continue; }
      if (!relative && !ROOT_FILES.has(entry.name)) { blockers.push({ path: rel, reason: 'Unrecognized top-level file.' }); continue; }
      if (!(TEXT_EXTENSIONS.has(ext) || rel === '.gitignore')) { blockers.push({ path: rel, reason: 'Unrecognized file type; cannot assume original text source.' }); continue; }
      if (stat.size > MAX_TEXT_BYTES) { blockers.push({ path: rel, reason: 'Text exceeds bounded review size; needs explicit inspection.', bytes: stat.size }); continue; }
      const bytes = fs.readFileSync(abs);
      if (bytes.includes(0)) { blockers.push({ path: rel, reason: 'NUL bytes in apparent text; classify encoding/binary content explicitly.' }); continue; }
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { blockers.push({ path: rel, reason: 'Not valid UTF-8; separate content review needed.' }); continue; }
      const findings = scanText(text);
      const unresolved = findings.some(item => item.disposition === 'REQUIRES_REVIEW');
      const jsonError = ext === '.json' ? (() => { try { JSON.parse(text.replace(/^\uFEFF/, '')); return false; } catch { return true; } })() : false;
      const record = { path: rel, bytes: bytes.length, sha256: hash(bytes), lines: text.split('\n').length, category: category(rel), contentRead: true, credentialScan: findings.length ? findings : 'NO_PATTERN_MATCHES', notes: contentNotes(text, rel) };
      if (unresolved || jsonError) {
        excluded.push({ ...record, kind: 'FILE', reason: jsonError ? 'Malformed JSON requires review.' : 'Credential/account pattern requires manual disposition; values are never printed.' });
        blockers.push({ path: rel, reason: jsonError ? 'Malformed JSON' : 'Unresolved redacted credential/account pattern', findings });
      } else reviewed.push(record);
    }
  }
  walk();
  const ignoreText = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  const patterns = [
    '/companion/local/', '/tmp/', '/research/evidence/', '__pycache__/', '*.pyc',
    'node_modules/', '.venv/', '.env', '.env.*', '*.log', '*.pem', '*.key', '*.pfx', '*.p12',
    '*.wav', '*.mp3', '*.mp4', '*.webm', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp', '*.pdf',
    '*.exe', '*.dll', '*.zip', '*.7z', '*.whl', '*.bin', '*.gguf', '*.onnx', '*.pt', '*.pth', '*.pak', '*.uasset', '*.umap', '*.COPY',
  ];
  const present = new Set(ignoreText.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')));
  return {
    schemaVersion: 1, reviewedAt: new Date().toISOString(), reviewer: 'Independent project-local source-content review',
    status: blockers.length ? 'REQUIRES_REVIEW' : 'READY_FOR_PRIVATE_SOURCE_CHECKPOINT',
    target: { owner: 'bug220r-lab', repository: 'mw5-lancemate-companion', requiredVisibility: 'private', remoteCreationOrUploadByThisScript: false, unrelatedRepository: 'sales-assist must not be touched' },
    scope: 'Original source, design/research reports, synthetic fixtures and bounded authored receipts; not a whole-machine or complete raw-evidence backup.',
    checks: { candidateContentsRead: true, utf8Validated: true, jsonParsed: true, sha256Recorded: true, credentialPatternScan: true, secretValuesLogged: false, symlinksFollowed: false, excludedTreeContentsRead: false, gitHistoryRead: false, stagingOrCommitOrNetworkPerformed: false },
    counts: { includedFiles: reviewed.length + 1, includedBytesExcludingThisReceipt: reviewed.reduce((a, x) => a + x.bytes, 0), excludedEntries: excluded.length, unresolved: blockers.length },
    gitignore: { sha256: hash(Buffer.from(ignoreText)), currentPatterns: [...present], recommendedPatterns: patterns, recommendedAdditions: patterns.filter(p => !present.has(p)) },
    includePaths: [...reviewed.map(x => x.path), REPORT].sort(), reviewedFiles: reviewed,
    reportSelf: { path: REPORT, included: true, hash: 'OMITTED_TO_AVOID_SELF_REFERENCE', content: 'Generated from path/hash/count/redacted rule metadata only; no matching credential values.' },
    contentReviewDispositions: [
      { paths: ['audio/elevenlabs-audition-001/generation.json'], decision: 'INCLUDE_TEXT_METADATA', basis: 'Generation provenance, public voice labels, fictional script, settings, credit counts and local file hashes; no account/login fields, service URLs or downloaded speech bytes.' },
      { paths: ['research/EDITOR_COMPLETION.json', 'research/EDITOR_RECOVERY_2026-09-20.json', 'research/PASSIVE_OBSERVER_LOCAL_SNAPSHOT.json'], decision: 'INCLUDE_AUTHORED_BOUNDED_RECEIPTS', basis: 'Installed build/file identities, disk facts and bounded installation error/success evidence. Account/login field and credential scans found no unresolved match; actual launcher/account log files are not included.' },
      { paths: ['research/LOCAL_CONVERSATION_COMPONENT_BENCHMARK.json', 'research/LOCAL_CONVERSATION_FALLBACK_BENCHMARK.json', 'research/KOKORO_COMPONENT_BENCHMARK.json', 'research/WHISPER_COMPONENT_BENCHMARK.json'], decision: 'INCLUDE_COMPONENT_RESULTS', basis: 'Project-authored local component timing/transcription/output receipts. Runtime snippets concern build/loading/performance/file failures and loopback endpoints; downloaded dependencies and full native run logs remain under excluded companion/local/.' },
      { paths: ['research/AI_RESEARCH_SCOPE.json', 'research/COLLECTOR_ASSET_SCOPE.json', 'research/EDITOR_SERIALIZED_NAME_EVIDENCE.json', 'research/AI_COVERAGE_LEDGER.json', 'research/coverage/'], decision: 'INCLUDE_ANALYSIS_INVENTORIES', basis: 'Original collector/analysis inventories and references, not raw Blueprint/default export bodies or native API stubs. Underlying raw source remains excluded under research/evidence/.' },
    ],
    excluded, blockers,
    limitations: [
      'Pattern scans cannot prove the absence of every possible secret, copyright concern or personal datum. No actual credential is printed or copied by the scanner.',
      'Original authored reports may retain this personal project username, hardware, paths, timestamps, public artifact identifiers and brief source citations. Visibility must remain private.',
      'Whole excluded trees were not opened or enumerated recursively. Their total size and contents are intentionally not claimed.',
      'Raw exports, native game/editor files, downloaded third-party repositories/models/runtimes and media are not backed up. Some documentary evidence links will be local-only.',
      'A restored source checkout cannot reverify excluded export hashes or rerun audio/model component benchmarks without separately restoring their local inputs. Preserve the current local evidence directory independently; any later native recollection needs its own bounded authorization and is not performed by this script.',
      'Results are a hash-pinned working-tree snapshot. Re-run review after any active-author changes and verify hashes immediately before staging; no Git history or remote was audited here.',
      'No game/editor, paid API, audio generation, deployment, staging, commit, push or remote modification was performed by this reviewer.'
    ],
  };
}

function selfTest() {
  const key = 'gh' + 'p_' + 'a'.repeat(32);
  const samples = [key, '-----BEGIN ' + 'PRIVATE KEY-----', 'https://host/x?access_' + 'token=' + 'z'.repeat(20), '-AUTH_' + 'PASSWORD=' + 'z'.repeat(20), '"api_' + 'key":"' + 'z'.repeat(24) + '"'];
  for (const sample of samples) {
    const result = scanText(sample);
    assert.ok(result.some(item => item.disposition === 'REQUIRES_REVIEW'));
    assert.ok(!JSON.stringify(result).includes(sample));
  }
  assert.equal(scanText('"api_' + 'key":"<YOUR_KEY>"')[0].disposition, 'PLACEHOLDER_ONLY');
  assert.deepEqual(scanText('https://huggingface.co/Qwen/model/resolve/hash/file.gguf'), []);
  assert.deepEqual(scanText('const apiKey = process.env.KEY;'), []);
  console.log(JSON.stringify({ status: 'PASS', assertions: 13, scope: 'Scanner detection and redacted output only; no real credentials used.' }));
}

function verifyExisting() {
  const receipt = JSON.parse(fs.readFileSync(path.join(ROOT, REPORT), 'utf8'));
  const drift = receipt.reviewedFiles.filter(item => !fs.existsSync(path.join(ROOT, item.path)) || hash(fs.readFileSync(path.join(ROOT, item.path))) !== item.sha256).map(item => item.path);
  console.log(JSON.stringify({ status: drift.length ? 'DRIFT_REQUIRES_REVIEW' : 'PINNED_CONTENT_UNCHANGED', filesChecked: receipt.reviewedFiles.length, changedPaths: drift }));
  if (drift.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest();
  else if (process.argv.includes('--verify')) verifyExisting();
  else {
    const receipt = reviewSource();
    fs.writeFileSync(path.join(ROOT, REPORT), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ status: receipt.status, counts: receipt.counts, report: REPORT, blockers: receipt.blockers, gitignoreAdditions: receipt.gitignore.recommendedAdditions }, null, 2));
    if (receipt.blockers.length) process.exitCode = 1;
  }
}
