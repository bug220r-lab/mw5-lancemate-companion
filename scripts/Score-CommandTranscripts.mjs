// One explicit local JSON input; JSON stdout only. Never opens corpus references.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreCommandTranscriptCorpus, COMMAND_TRANSCRIPT_LIMITS } from '../companion/command-transcript-evaluation.mjs';

const fault = code => Object.assign(new Error(code), { code });
const samePath = (left, right) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
export async function readBoundedCommandCorpus(file) {
  if (typeof file !== 'string' || !file || file.includes('\0') || file.startsWith('\\\\') || file.startsWith('//'))
    throw fault('INVALID_INPUT_PATH');
  const absolute = path.resolve(file), before = await fs.lstat(absolute);
  if (!before.isFile() || before.isSymbolicLink() || !samePath(await fs.realpath(absolute), absolute)) throw fault('INPUT_NOT_REGULAR_LOCAL_FILE');
  if (before.size > COMMAND_TRANSCRIPT_LIMITS.bytes) throw fault('CORPUS_BYTE_LIMIT');
  const handle = await fs.open(absolute, 'r');
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) throw fault('INPUT_CHANGED');
    const bytes = Buffer.alloc(COMMAND_TRANSCRIPT_LIMITS.bytes + 1); let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await handle.read(bytes, used, bytes.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > COMMAND_TRANSCRIPT_LIMITS.bytes) throw fault('CORPUS_BYTE_LIMIT');
    const after = await handle.stat();
    if (after.size !== before.size || used !== before.size || after.mtimeMs !== before.mtimeMs) throw fault('INPUT_CHANGED');
    return bytes.subarray(0, used);
  } finally { await handle.close(); }
}

export const COMMAND_TRANSCRIPT_HELP = 'Usage: node scripts/Score-CommandTranscripts.mjs --input <local-json-file>\n' +
  'Print supplied-transcript parser replay JSON only. No ASR, dispatch, latency or native acceptance.\n' +
  'Exit 0: all supplied cases match or descriptive NO_CASES; 1: scored mismatches; 2: invalid input/usage.\n';

/** Injected reader/output seams support in-process tests; the scorer stays real. */
export async function runCommandTranscriptCli(args, { readInput = readBoundedCommandCorpus,
  stdout = text => process.stdout.write(text), stderr = text => process.stderr.write(text) } = {}) {
  if (args.length === 1 && args[0] === '--help') { stdout(COMMAND_TRANSCRIPT_HELP); return 0; }
  if (args.length !== 2 || args[0] !== '--input' || typeof args[1] !== 'string' || !args[1]) {
    stderr('INVALID_ARGUMENTS\n' + COMMAND_TRANSCRIPT_HELP); return 2;
  }
  try {
    const bytes = await readInput(args[1]);
    if (!(bytes instanceof Uint8Array)) throw fault('INVALID_INPUT_BYTES');
    if (bytes.byteLength > COMMAND_TRANSCRIPT_LIMITS.bytes) throw fault('CORPUS_BYTE_LIMIT');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw fault('INVALID_INPUT_UTF8'); }
    const report = scoreCommandTranscriptCorpus(text);
    stdout(JSON.stringify(report, null, 2) + '\n');
    return report.summary.mismatched ? 1 : 0;
  } catch (error) {
    const code = /^[A-Z_]{1,96}$/.test(error?.code || '') ? error.code : 'INPUT_READ_OR_SCORING_FAILED';
    stderr(code + '\n'); return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await runCommandTranscriptCli(process.argv.slice(2));
