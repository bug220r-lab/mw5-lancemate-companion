// Read-only saved-source inventory for the separate Phase A diagnostic mod.
// Hashes do not establish editor-memory equality, graph correctness, cooking or runtime behavior.
import fs from 'node:fs';
import path from 'node:path';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR_ROOT = 'C:\\Program Files\\Epic Games\\MechWarrior5Editor\\MW5Mercs';
const BACKUP_RELATIVE = 'research/evidence/editor-authored/LanceObserverProbe-20260925-053007-reviewed/BACKUP_MANIFEST.json';
const BACKUP_SHA256 = '3185505b5b83449cda09beb343884bfcbf029d756ef7823f3c1b25902c6f52a4';
const ORIGINAL_DESCRIPTOR = { bytes: 356, sha256: '475c4ed15264743f84d326f28903079d3d72f102985d10c8a7ede4ccf7d5cea3' };
const STOCK_CONTROLLER = { bytes: 53635, sha256: '7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6' };
const ORIGINAL_NAME = 'LanceObserverProbe';
const DIAGNOSTIC_NAME = 'LanceObserverDiagnosticControl';
const ORIGINAL_PATHS = [
  'ActiveMod.txt', 'LanceObserverProbe.uplugin',
  'Config/Input/LanceObserverProbeInput.ini', 'Config/Tags/LanceObserverProbeTags.ini',
  'Content/BP_LanceObserverProbeComponent.uasset', 'Content/WBP_LanceObserverProbeReadout.uasset',
  'Content/DA_LanceObserverProbeRegistration.uasset', 'Resources/Icon128.png',
];
const DIAGNOSTIC_PATHS = [
  'ActiveMod.txt', 'LanceObserverDiagnosticControl.uplugin',
  'Config/Input/LanceObserverDiagnosticControlInput.ini',
  'Config/Tags/LanceObserverDiagnosticControlTags.ini',
  'Content/WBP_ObserverDiagnosticControl.uasset',
  'ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset',
  'Resources/Icon128.png', 'mod.json',
];
const MAX_FILES = 32, MAX_DIRECTORIES = 32, MAX_ENTRIES = 96, MAX_DEPTH = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024, MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 128 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const folded = value => value.toLowerCase();

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function isMissing(error) { return error?.code === 'ENOENT'; }
function safeRelative(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)*$/.test(value)) fail('INVALID_RELATIVE_PATH');
  const parts = value.split(/[\\/]/);
  if (parts.some(part => part === '.' || part === '..' || part.endsWith('.'))) fail('INVALID_RELATIVE_PATH');
  return parts.join('/');
}
function sameStat(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}
function lstatOptional(file) {
  try { return fs.lstatSync(file); } catch (error) { if (isMissing(error)) return null; throw error; }
}
function requireDirectory(directory) {
  const stat = lstatOptional(directory);
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('UNSAFE_DIRECTORY_ENTRY');
  return true;
}
function checkedChild(root, relative) {
  const rootStat = lstatOptional(root);
  if (rootStat && (rootStat.isSymbolicLink() || !rootStat.isDirectory())) fail('UNSAFE_DIRECTORY_ENTRY');
  const parts = safeRelative(relative).split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    const stat = lstatOptional(current);
    if (!stat) break;
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('UNSAFE_DIRECTORY_ENTRY');
  }
  return path.join(root, ...parts);
}
function readFileBounded(file, limit = MAX_FILE_BYTES, expectedStat = null) {
  const before = lstatOptional(file);
  if (!before) return null;
  if (before.isSymbolicLink() || !before.isFile()) fail('UNSAFE_FILE_ENTRY');
  if (expectedStat && !sameStat(expectedStat, before)) fail('FILE_CHANGED_DURING_SCAN');
  if (before.size > limit) fail('FILE_SIZE_LIMIT');
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  const fd = fs.openSync(file, flags);
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || !sameStat(before, opened)) fail('FILE_CHANGED_DURING_OPEN');
    const chunks = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(65536, limit + 1 - total));
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      total += count;
      if (total > limit) fail('FILE_SIZE_LIMIT');
      chunks.push(chunk.subarray(0, count));
    }
    const after = fs.fstatSync(fd), finalPath = fs.lstatSync(file);
    if (!sameStat(before, after) || !sameStat(before, finalPath) || total !== after.size) fail('FILE_CHANGED_DURING_READ');
    return { bytes: Buffer.concat(chunks), modifiedUtc: after.mtime.toISOString() };
  } finally { fs.closeSync(fd); }
}
function summarize(file, relative, limit, expectedStat) {
  const read = readFileBounded(file, limit, expectedStat);
  if (!read) return { path: relative, exists: false };
  return { path: relative, exists: true, bytes: read.bytes.length,
    sha256: hash(read.bytes), modifiedUtc: read.modifiedUtc, raw: read.bytes };
}
function publicFile(row) { const { raw, ...published } = row; return published; }
function parseDescriptor(row) {
  if (!row?.exists) return null;
  if (row.bytes > 65536) fail('DESCRIPTOR_SIZE_LIMIT');
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(row.raw)); }
  catch { fail('INVALID_MOD_DESCRIPTOR'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_MOD_DESCRIPTOR');
  return value;
}
function validateList(files, required) {
  if (!Array.isArray(files) || files.length !== required.length) fail('INVALID_MANIFEST_FILE_SET');
  const seen = new Set(), allowed = new Set(required);
  return files.map(item => {
    const relative = safeRelative(item.path), key = folded(relative);
    if (seen.has(key) || !allowed.has(relative) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 ||
      !/^[0-9a-f]{64}$/.test(item.sha256)) fail('INVALID_MANIFEST_ENTRY');
    seen.add(key);
    return { path: relative, bytes: item.bytes, sha256: item.sha256 };
  });
}
function readManifest(file, expectedHash, required, nested = false) {
  const read = readFileBounded(file, MAX_MANIFEST_BYTES);
  if (!read) fail('MANIFEST_MISSING');
  const sha256 = hash(read.bytes);
  if (expectedHash && sha256 !== expectedHash) fail('BACKUP_MANIFEST_HASH_MISMATCH');
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read.bytes)); }
  catch { fail('INVALID_MANIFEST_JSON'); }
  const manifest = nested ? (parsed?.proposedFreezeManifest ?? parsed) : parsed;
  if (nested && (manifest?.kind !== 'DIAGNOSTIC_SOURCE_FREEZE' || manifest?.schemaVersion !== 1)) fail('INVALID_FREEZE_MANIFEST');
  const files = validateList(manifest?.files, required);
  return { sha256, files };
}
function projectLocalFile(projectRoot, relative) {
  const rel = safeRelative(relative), parts = rel.split('/');
  let current = projectRoot;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    if (!requireDirectory(current)) fail('MANIFEST_PARENT_MISSING');
  }
  return path.join(current, parts.at(-1));
}
function walk(directory) {
  const files = [], state = { directories: 0, entries: 0, fileCount: 0, totalBytes: 0 }, foldedPaths = new Set();
  let descriptorSnapshot = null;
  if (!requireDirectory(directory)) return { exists: false, files, descriptorSnapshot };
  function visit(current, prefix, depth) {
    if (++state.directories > MAX_DIRECTORIES || depth > MAX_DEPTH) fail('DIRECTORY_LIMIT');
    const stream = fs.opendirSync(current, { bufferSize: 16 });
    try {
      for (let entry = stream.readSync(); entry; entry = stream.readSync()) {
        if (++state.entries > MAX_ENTRIES) fail('ENTRY_LIMIT');
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        safeRelative(relative);
        const key = folded(relative);
        if (foldedPaths.has(key)) fail('CASE_COLLISION');
        foldedPaths.add(key);
        const absolute = path.join(current, entry.name), stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) fail('UNSAFE_LINK_ENTRY');
        if (stat.isDirectory()) { visit(absolute, relative, depth + 1); continue; }
        if (!stat.isFile()) fail('UNSAFE_NONREGULAR_ENTRY');
        const remainingBytes = MAX_TOTAL_BYTES - state.totalBytes;
        if (++state.fileCount > MAX_FILES || stat.size > MAX_FILE_BYTES || stat.size > remainingBytes)
          fail('INVENTORY_LIMIT');
        const snapshot = summarize(absolute, relative, Math.min(MAX_FILE_BYTES, remainingBytes), stat);
        if (!snapshot.exists) fail('FILE_VANISHED_DURING_SCAN');
        if (snapshot.bytes !== stat.size || snapshot.modifiedUtc !== stat.mtime.toISOString())
          fail('FILE_CHANGED_DURING_SCAN');
        state.totalBytes += snapshot.bytes;
        if (relative === 'mod.json') descriptorSnapshot = snapshot;
        files.push(publicFile(snapshot));
      }
    } finally { stream.closeSync(); }
  }
  visit(directory, '', 0);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { exists: true, files, descriptorSnapshot };
}
function inventoryOutputParent(directory) {
  if (!requireDirectory(directory)) return { exists: false, empty: false, entries: [] };
  const entries = [], stream = fs.opendirSync(directory, { bufferSize: 16 });
  try {
    for (let entry = stream.readSync(); entry; entry = stream.readSync()) {
      if (entries.length >= 64) fail('OUTPUT_ENTRY_LIMIT');
      entries.push(entry.name);
    }
  } finally { stream.closeSync(); }
  return { exists: true, empty: entries.length === 0, entries: entries.sort() };
}
function compareFiles(actual, expected, issues, prefix) {
  const actualByPath = new Map(actual.map(item => [folded(item.path), item]));
  const expectedByPath = new Map(expected.map(item => [folded(item.path), item]));
  for (const item of expected) {
    const found = actualByPath.get(folded(item.path));
    if (!found) issues.push(`${prefix}_MISSING:${item.path}`);
    else if (found.path !== item.path || found.bytes !== item.bytes || found.sha256 !== item.sha256)
      issues.push(`${prefix}_DRIFT:${item.path}`);
  }
  for (const item of actual) if (!expectedByPath.has(folded(item.path))) issues.push(`${prefix}_UNEXPECTED:${item.path}`);
}

export function inspectDiagnosticPackageSource(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? PROJECT_ROOT);
  const editorRoot = path.resolve(options.editorRoot ?? EDITOR_ROOT);
  const originalRoot = checkedChild(editorRoot, `Plugins/${ORIGINAL_NAME}`);
  const diagnosticRoot = checkedChild(editorRoot, `Plugins/${DIAGNOSTIC_NAME}`);
  const outputParent = checkedChild(projectRoot, `artifacts/${DIAGNOSTIC_NAME}/package-20260925-01`);
  if (!requireDirectory(projectRoot) || !requireDirectory(editorRoot)) fail('ROOT_MISSING');
  const backupPath = projectLocalFile(projectRoot, BACKUP_RELATIVE);
  const backup = readManifest(backupPath, options.backupSha256 ?? BACKUP_SHA256, ORIGINAL_PATHS);
  const issues = [];
  const original = [];
  for (const item of backup.files) {
    const current = summarize(checkedChild(originalRoot, item.path), item.path);
    if (item.path === 'ActiveMod.txt') continue;
    const matches = current.exists && current.bytes === item.bytes && current.sha256 === item.sha256;
    if (!matches) issues.push(`ORIGINAL_DRIFT:${item.path}`);
    original.push({ ...publicFile(current), expectedBytes: item.bytes,
      expectedSha256: item.sha256, matches });
  }
  const originalMarker = summarize(checkedChild(originalRoot, 'ActiveMod.txt'), 'ActiveMod.txt');
  if (originalMarker.exists && (originalMarker.bytes !== 0 ||
      originalMarker.sha256 !== backup.files.find(item => item.path === 'ActiveMod.txt').sha256))
    issues.push('ORIGINAL_SELECTION_MARKER_CHANGED');
  const originalDescriptor = summarize(checkedChild(originalRoot, 'mod.json'), 'mod.json', 65536);
  const originalDescriptorPin = options.originalDescriptorPin ?? ORIGINAL_DESCRIPTOR;
  const originalDescriptorMatches = originalDescriptor.exists && originalDescriptor.bytes === originalDescriptorPin.bytes &&
    originalDescriptor.sha256 === originalDescriptorPin.sha256;
  if (!originalDescriptorMatches) issues.push('ORIGINAL_DESCRIPTOR_DRIFT');
  const stock = summarize(checkedChild(editorRoot, 'Content/Modes/InstantAction/InstantActionPlayerController.uasset'),
    'Content/Modes/InstantAction/InstantActionPlayerController.uasset');
  const stockPin = options.stockControllerPin ?? STOCK_CONTROLLER;
  const stockMatches = stock.exists && stock.bytes === stockPin.bytes && stock.sha256 === stockPin.sha256;
  if (!stockMatches) issues.push('STOCK_CONTROLLER_DRIFT');
  const diagnostic = walk(diagnosticRoot);
  if (!diagnostic.exists) issues.push('DIAGNOSTIC_ROOT_MISSING');
  const allowed = new Set(DIAGNOSTIC_PATHS);
  for (const item of diagnostic.files) if (!allowed.has(item.path)) issues.push(`DIAGNOSTIC_UNEXPECTED:${item.path}`);
  for (const relative of DIAGNOSTIC_PATHS) if (!diagnostic.files.some(item => item.path === relative))
    issues.push(relative === 'mod.json' ? 'DIAGNOSTIC_DESCRIPTOR_PENDING_MANAGE_MOD' : `DIAGNOSTIC_MISSING:${relative}`);
  const diagnosticMarker = diagnostic.files.find(item => item.path === 'ActiveMod.txt') ?? { path: 'ActiveMod.txt', exists: false };
  if (diagnosticMarker.exists !== false && diagnosticMarker.bytes !== 0) issues.push('DIAGNOSTIC_SELECTION_MARKER_CHANGED');
  if (originalMarker.exists && diagnosticMarker.exists !== false) issues.push('AMBIGUOUS_ACTIVE_MOD_SELECTION');
  const diagnosticDescriptor = diagnostic.descriptorSnapshot ?? { path: 'mod.json', exists: false };
  const output = inventoryOutputParent(outputParent);
  if (!output.exists) issues.push('OUTPUT_PARENT_MISSING');
  else if (!output.empty) issues.push('OUTPUT_PARENT_NOT_EMPTY');
  let freeze = null;
  if (options.expectedPath) {
    const expectedAbsolute = path.isAbsolute(options.expectedPath) ? path.resolve(options.expectedPath) :
      path.resolve(projectRoot, options.expectedPath);
    const rel = path.relative(projectRoot, expectedAbsolute).split(path.sep).join('/');
    const expectedFile = projectLocalFile(projectRoot, rel);
    const expected = readManifest(expectedFile, null, DIAGNOSTIC_PATHS, true);
    compareFiles(diagnostic.files, expected.files, issues, 'FREEZE');
    freeze = { path: rel, sha256: expected.sha256, matches: !issues.some(item => item.startsWith('FREEZE_')) };
  } else issues.push('SUPPLIED_FREEZE_REQUIRED_FOR_SOURCE_GATE');
  const descriptor = parseDescriptor(diagnosticDescriptor);
  const pendingIssues = new Set(['DIAGNOSTIC_DESCRIPTOR_PENDING_MANAGE_MOD', 'SUPPLIED_FREEZE_REQUIRED_FOR_SOURCE_GATE']);
  const reviewPendingOnly = issues.length > 0 && issues.every(item => pendingIssues.has(item));
  const report = {
    schemaVersion: 1, classification: 'OFFLINE_SAVED_SOURCE_ONLY', observedAtUtc: new Date().toISOString(),
    status: reviewPendingOnly ? 'SOURCE_REVIEW_PENDING' :
      issues.length ? 'SOURCE_GATE_BLOCKED' : 'SOURCE_MATCHES_SUPPLIED_FREEZE',
    exitCode: issues.length ? 1 : 0,
    backupManifest: { path: BACKUP_RELATIVE, sha256: backup.sha256 },
    original: { root: originalRoot, immutableFiles: original,
      selectionMarker: publicFile(originalMarker),
      modJson: { ...publicFile(originalDescriptor), expected: originalDescriptorPin,
        matches: originalDescriptorMatches, fields: parseDescriptor(originalDescriptor) } },
    stockController: { ...publicFile(stock), expected: stockPin, matches: stockMatches },
    diagnostic: { root: diagnosticRoot, exists: diagnostic.exists, files: diagnostic.files,
      selectionMarker: diagnosticMarker, modJson: { ...publicFile(diagnosticDescriptor),
        status: diagnosticDescriptor.exists ? 'PRESENT_REQUIRES_FIELD_REVIEW' : 'PENDING_MANAGE_MOD_CREATION', fields: descriptor } },
    outputParent: { path: outputParent, ...output }, freeze, issues,
    proposedFreezeManifest: { kind: 'DIAGNOSTIC_SOURCE_FREEZE', schemaVersion: 1,
      classification: 'CANDIDATE_REQUIRES_SOURCE_AND_GRAPH_REVIEW',
      files: diagnostic.files.map(({ path: relative, bytes, sha256 }) => ({ path: relative, bytes, sha256 })) },
    limits: 'Source inventory only. No editor-memory, graph, cook, staging, PAK, publication, retail or gameplay verification.',
  };
  return report;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 2 || (args.length && (args[0] !== '--expected' || !args[1]))) fail('USAGE: node scripts/Inspect-DiagnosticPackageSource.mjs [--expected project-local-freeze.json]');
  const report = inspectDiagnosticPackageSource({ expectedPath: args[1] });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.exitCode;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stdout.write(JSON.stringify({ schemaVersion: 1, status: 'INSPECTION_ERROR', exitCode: 2,
      error: error.code ?? error.message, classification: 'OFFLINE_SAVED_SOURCE_ONLY' }) + '\n');
    process.exitCode = 2;
  }
}
