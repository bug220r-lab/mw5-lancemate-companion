import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tests = (await readdir(path.join(root, 'companion/tests'))).filter(f => f.endsWith('.test.mjs')).sort()
  .map(f => `companion/tests/${f}`);
const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests],
  { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 ** 2 });
const text = (run.stdout || '') + (run.stderr || '');
const logFile = `tmp/companion-verification-${Date.now()}.tap`;
await mkdir(path.join(root, 'tmp'), { recursive: true });
await writeFile(path.join(root, logFile), text, { flag: 'wx' });
// A tail-only excerpt can omit an early failure in a large suite.
const failureBlocks = [];
const lines = text.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (!/^not ok /.test(lines[i])) continue;
  const block = [lines[i]];
  while (++i < lines.length) { block.push(lines[i]); if (/^\s+\.\.\.$/.test(lines[i])) break; }
  failureBlocks.push(block.join('\n').slice(0, 8000));
}
const count = key => Number(text.match(new RegExp(`^# ${key} (\\d+)`, 'm'))?.[1] ?? 0);
const files = [...tests, ...(await readdir(path.join(root, 'companion'))).filter(f => /\.(mjs|json)$/.test(f)).map(f => `companion/${f}`),
  ...(await readdir(path.join(root, 'companion/public'))).filter(f => /\.(js|html|css)$/.test(f)).map(f => `companion/public/${f}`),
  'START_COMPANION.cmd','scripts/Kokoro-Worker.py','scripts/tactical-policy.mjs','synthetic/tactical-cases.mjs','synthetic/release-benchmark.json',
  'scripts/Exercise-ConversationGrounding.mjs','synthetic/conversation-grounding-cases.json',
  'scripts/Exercise-LocalRecognition.mjs','scripts/Exercise-ConversationCache.mjs',
  'scripts/Exercise-ConversationIdentity.mjs','synthetic/conversation-identity-cases.json',
  'scripts/Exercise-ConversationRelativeFacts.mjs','synthetic/conversation-relative-facts-cases.json',
  'scripts/Install-SmollmCandidate.mjs','scripts/Inspect-SmollmMetadata.mjs',
  'scripts/Exercise-ConversationModelTransfer.mjs','synthetic/conversation-model-transfer-cases.json'];
const hashes = [];
for (const file of files) hashes.push({ file, sha256: createHash('sha256').update(await readFile(path.join(root, file))).digest('hex') });
const receipt = { schemaVersion: 1, recordedAt: new Date().toISOString(), classification: 'MOCK_ONLY',
  status: run.status === 0 && count('tests') > 0 && count('fail') === 0 ? 'PASS' : 'FAIL',
  tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'),
  legacyAssertions: '48 scenarios + 31 independent adversarial cases + 3 properties retained via policy regression wrappers; historical receipts unchanged',
  nodeVersion: process.version, testFiles: tests, hashes, gameTests: 'NOT_PERFORMED', nativeAdapter: 'NOT_BUILT',
  localFullTestLog: { file: logFile, sha256: createHash('sha256').update(text).digest('hex'), includedInSourceBackup: false },
  visualBrowserCheck: 'SEPARATE_RECEIPT: research/WORKBENCH_BROWSER_VALIDATION_2026-09-22.json records bounded real-browser checks with synthetic game state. This test run does not repeat them or establish microphone/audio/game acceptance.',
  failures: run.status === 0 ? [] : [...(failureBlocks.length ? failureBlocks : [text.slice(-16000)]), run.error?.message ?? null] };
await writeFile(path.join(root, 'research/COMPANION_VALIDATION.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, tests: receipt.tests, passed: receipt.passed, failed: receipt.failed,
  classification: receipt.classification, gameTests: receipt.gameTests }));
process.exitCode = receipt.status === 'PASS' ? 0 : 1;
