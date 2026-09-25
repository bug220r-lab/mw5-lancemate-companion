import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectDiagnosticPackageSource } from './Inspect-DiagnosticPackageSource.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const ORIGINAL = [
  'ActiveMod.txt', 'LanceObserverProbe.uplugin',
  'Config/Input/LanceObserverProbeInput.ini', 'Config/Tags/LanceObserverProbeTags.ini',
  'Content/BP_LanceObserverProbeComponent.uasset', 'Content/WBP_LanceObserverProbeReadout.uasset',
  'Content/DA_LanceObserverProbeRegistration.uasset', 'Resources/Icon128.png',
];
const DIAGNOSTIC = [
  'ActiveMod.txt', 'LanceObserverDiagnosticControl.uplugin',
  'Config/Input/LanceObserverDiagnosticControlInput.ini', 'Config/Tags/LanceObserverDiagnosticControlTags.ini',
  'Content/WBP_ObserverDiagnosticControl.uasset',
  'ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset',
  'Resources/Icon128.png', 'mod.json',
];
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mw5-diagnostic-source-'));
  t.after(() => {
    assert.equal(path.dirname(root), os.tmpdir());
    fs.rmSync(root, { recursive: true, force: true });
  });
  const projectRoot = path.join(root, 'project'), editorRoot = path.join(root, 'editor');
  const originalRoot = path.join(editorRoot, 'Plugins', 'LanceObserverProbe');
  const diagnosticRoot = path.join(editorRoot, 'Plugins', 'LanceObserverDiagnosticControl');
  const outputParent = path.join(projectRoot, 'artifacts', 'LanceObserverDiagnosticControl', 'package-20260925-01');
  function write(file, bytes) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    return { bytes: Buffer.byteLength(bytes), sha256: digest(bytes) };
  }
  const original = ORIGINAL.map(relative => {
    const value = relative === 'ActiveMod.txt' ? '' : `original:${relative}`;
    return { path: relative, ...write(path.join(originalRoot, relative), value) };
  });
  fs.unlinkSync(path.join(originalRoot, 'ActiveMod.txt')); // Diagnostic is the selected mod in this fixture.
  const originalDescriptor = write(path.join(originalRoot, 'mod.json'),
    JSON.stringify({ displayName: 'LanceObserverProbe', buildNumber: 1 }));
  const stockController = write(path.join(editorRoot, 'Content', 'Modes', 'InstantAction', 'InstantActionPlayerController.uasset'), 'stock controller');
  for (const relative of DIAGNOSTIC) write(path.join(diagnosticRoot, relative),
    relative === 'ActiveMod.txt' ? '' : relative === 'mod.json' ?
      JSON.stringify({ displayName: 'LanceObserverDiagnosticControl', buildNumber: 0 }) : `diagnostic:${relative}`);
  fs.mkdirSync(outputParent, { recursive: true });
  const backupPath = path.join(projectRoot, 'research', 'evidence', 'editor-authored',
    'LanceObserverProbe-20260925-053007-reviewed', 'BACKUP_MANIFEST.json');
  const backupBytes = Buffer.from(JSON.stringify({ files: original }));
  write(backupPath, backupBytes);
  const options = { projectRoot, editorRoot, backupSha256: digest(backupBytes), originalDescriptorPin: originalDescriptor, stockControllerPin: stockController };
  return { root, projectRoot, editorRoot, originalRoot, diagnosticRoot, outputParent, backupPath, options, write,
    inspect: extra => inspectDiagnosticPackageSource({ ...options, ...extra }) };
}

test('complete synthetic source set is inventoried without claiming graph or cook acceptance', t => {
  const f = fixture(t);
  const controller = path.join(f.diagnosticRoot, 'ModOverride', 'Modes', 'InstantAction', 'InstantActionPlayerController.uasset');
  const before = { bytes: fs.readFileSync(controller), modified: fs.statSync(controller).mtimeMs };
  const report = f.inspect();
  assert.equal(report.status, 'SOURCE_REVIEW_PENDING');
  assert.equal(report.exitCode, 1);
  assert.ok(report.issues.includes('SUPPLIED_FREEZE_REQUIRED_FOR_SOURCE_GATE'));
  assert.equal(report.diagnostic.files.length, 8);
  assert.ok(report.diagnostic.files.every(item => item.exists === true));
  assert.equal(report.original.immutableFiles.length, 7);
  assert.equal(report.outputParent.empty, true);
  assert.match(report.limits, /No editor-memory, graph, cook/);
  assert.deepEqual(fs.readFileSync(controller), before.bytes);
  assert.equal(fs.statSync(controller).mtimeMs, before.modified);
});

test('a file vanishing between enumeration and hashing aborts inspection', t => {
  const f = fixture(t);
  const widget = path.join(f.diagnosticRoot, 'Content', 'WBP_ObserverDiagnosticControl.uasset');
  const previous = fs.lstatSync;
  let removed = false;
  fs.lstatSync = function (file, ...rest) {
    const stat = previous.call(fs, file, ...rest);
    if (!removed && path.resolve(file) === widget) { removed = true; fs.unlinkSync(widget); }
    return stat;
  };
  try { assert.throws(() => f.inspect(), /FILE_VANISHED_DURING_SCAN/); }
  finally { fs.lstatSync = previous; }
  assert.equal(removed, true);
});

test('a larger stable replacement between enumeration and hashing aborts inspection', t => {
  const f = fixture(t);
  const widget = path.join(f.diagnosticRoot, 'Content', 'WBP_ObserverDiagnosticControl.uasset');
  const previous = fs.lstatSync;
  let replaced = false;
  fs.lstatSync = function (file, ...rest) {
    const stat = previous.call(fs, file, ...rest);
    if (!replaced && path.resolve(file) === widget) {
      replaced = true;
      fs.writeFileSync(widget, Buffer.alloc(2 * 1024 * 1024));
    }
    return stat;
  };
  try { assert.throws(() => f.inspect(), /FILE_CHANGED_DURING_SCAN/); }
  finally { fs.lstatSync = previous; }
  assert.equal(replaced, true);
});

test('diagnostic mod descriptor fields come from the inventory read', t => {
  const f = fixture(t);
  const descriptor = path.join(f.diagnosticRoot, 'mod.json');
  const previous = fs.openSync;
  let opens = 0;
  fs.openSync = function (file, ...rest) {
    if (path.resolve(file) === descriptor) opens++;
    return previous.call(fs, file, ...rest);
  };
  let report;
  try { report = f.inspect(); }
  finally { fs.openSync = previous; }
  assert.equal(opens, 1);
  assert.equal(report.diagnostic.modJson.sha256, report.diagnostic.files.find(item => item.path === 'mod.json').sha256);
  assert.equal(report.diagnostic.modJson.fields.displayName, 'LanceObserverDiagnosticControl');
});

test('supplied-freeze comparison catches a changed controller and accepts unchanged bytes', t => {
  const f = fixture(t);
  const freezeFile = path.join(f.projectRoot, 'freeze.json');
  f.write(freezeFile, JSON.stringify(f.inspect().proposedFreezeManifest));
  const pass = f.inspect({ expectedPath: freezeFile });
  assert.equal(pass.status, 'SOURCE_MATCHES_SUPPLIED_FREEZE');
  assert.equal(pass.freeze.matches, true);
  f.write(path.join(f.diagnosticRoot, 'ModOverride', 'Modes', 'InstantAction', 'InstantActionPlayerController.uasset'), 'edited controller');
  const blocked = f.inspect({ expectedPath: freezeFile });
  assert.equal(blocked.status, 'SOURCE_GATE_BLOCKED');
  assert.ok(blocked.issues.includes('FREEZE_DRIFT:ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset'));
});

test('original selection marker is reported separately while immutable, descriptor and stock drift block', t => {
  const f = fixture(t);
  const selected = f.inspect();
  assert.equal(selected.status, 'SOURCE_REVIEW_PENDING');
  assert.equal(selected.original.selectionMarker.exists, false);
  f.write(path.join(f.originalRoot, 'Config', 'Tags', 'LanceObserverProbeTags.ini'), 'changed tags');
  f.write(path.join(f.originalRoot, 'mod.json'), JSON.stringify({ displayName: 'LanceObserverProbe', buildNumber: 2 }));
  f.write(path.join(f.editorRoot, 'Content', 'Modes', 'InstantAction', 'InstantActionPlayerController.uasset'), 'changed stock');
  const drift = f.inspect();
  assert.ok(drift.issues.includes('ORIGINAL_DRIFT:Config/Tags/LanceObserverProbeTags.ini'));
  assert.ok(drift.issues.includes('ORIGINAL_DESCRIPTOR_DRIFT'));
  assert.ok(drift.issues.includes('STOCK_CONTROLLER_DRIFT'));
  assert.ok(!drift.issues.includes('ORIGINAL_DRIFT:ActiveMod.txt'));
});

test('two active-mod markers block the source gate even with a matching supplied freeze', t => {
  const f = fixture(t);
  const freezeFile = path.join(f.projectRoot, 'freeze.json');
  f.write(freezeFile, JSON.stringify(f.inspect().proposedFreezeManifest));
  f.write(path.join(f.originalRoot, 'ActiveMod.txt'), '');
  const report = f.inspect({ expectedPath: freezeFile });
  assert.equal(report.status, 'SOURCE_GATE_BLOCKED');
  assert.ok(report.issues.includes('AMBIGUOUS_ACTIVE_MOD_SELECTION'));
  assert.equal(report.original.selectionMarker.exists, true);
  assert.equal(report.diagnostic.selectionMarker.exists, true);
});

test('missing source, unexpected file and nonempty package parent are separate blockers', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.diagnosticRoot, 'Content', 'WBP_ObserverDiagnosticControl.uasset'));
  f.write(path.join(f.diagnosticRoot, 'Content', 'Other.uasset'), 'unexpected');
  f.write(path.join(f.outputParent, 'partial.txt'), 'partial');
  const report = f.inspect();
  assert.ok(report.issues.includes('DIAGNOSTIC_MISSING:Content/WBP_ObserverDiagnosticControl.uasset'));
  assert.ok(report.issues.includes('DIAGNOSTIC_UNEXPECTED:Content/Other.uasset'));
  assert.ok(report.issues.includes('OUTPUT_PARENT_NOT_EMPTY'));
});

test('absent diagnostic mod descriptor is pending; a supplied freeze requires its exact bytes', t => {
  const f = fixture(t);
  const freezeFile = path.join(f.projectRoot, 'freeze.json');
  f.write(freezeFile, JSON.stringify(f.inspect().proposedFreezeManifest));
  fs.unlinkSync(path.join(f.diagnosticRoot, 'mod.json'));
  const pending = f.inspect();
  assert.equal(pending.status, 'SOURCE_REVIEW_PENDING');
  assert.equal(pending.exitCode, 1);
  assert.equal(pending.diagnostic.modJson.status, 'PENDING_MANAGE_MOD_CREATION');
  assert.ok(pending.issues.includes('DIAGNOSTIC_DESCRIPTOR_PENDING_MANAGE_MOD'));
  const strict = f.inspect({ expectedPath: freezeFile });
  assert.equal(strict.status, 'SOURCE_GATE_BLOCKED');
  assert.ok(strict.issues.includes('FREEZE_MISSING:mod.json'));
});

test('malformed and duplicate-case freeze paths are rejected before comparison', t => {
  const f = fixture(t);
  const freezeFile = path.join(f.projectRoot, 'freeze.json');
  const manifest = f.inspect().proposedFreezeManifest;
  manifest.files[7].path = '../outside';
  f.write(freezeFile, JSON.stringify(manifest));
  assert.throws(() => f.inspect({ expectedPath: freezeFile }), /INVALID_RELATIVE_PATH/);
  manifest.files[7].path = manifest.files[0].path.toUpperCase();
  f.write(freezeFile, JSON.stringify(manifest));
  assert.throws(() => f.inspect({ expectedPath: freezeFile }), /INVALID_MANIFEST_ENTRY/);
  assert.throws(() => f.inspect({ expectedPath: path.join(f.root, 'outside.json') }), /INVALID_RELATIVE_PATH/);
});

test('oversized file in the diagnostic root fails closed', t => {
  const f = fixture(t);
  const widget = path.join(f.diagnosticRoot, 'Content', 'WBP_ObserverDiagnosticControl.uasset');
  f.write(widget, Buffer.alloc(8 * 1024 * 1024 + 1));
  assert.throws(() => f.inspect(), /INVENTORY_LIMIT/);
});

test('output-parent scan stops after the bounded entry count', t => {
  const f = fixture(t);
  for (let index = 0; index < 65; index++) f.write(path.join(f.outputParent, `entry-${index}.txt`), 'x');
  assert.throws(() => f.inspect(), /OUTPUT_ENTRY_LIMIT/);
});

test('link in the diagnostic root fails closed when Windows permits a link fixture', t => {
  const f = fixture(t);
  const widget = path.join(f.diagnosticRoot, 'Content', 'WBP_ObserverDiagnosticControl.uasset');
  f.write(widget, 'widget');
  try { fs.symlinkSync(widget, path.join(f.diagnosticRoot, 'Content', 'linked.uasset'), 'file'); }
  catch (error) { if (error.code === 'EPERM' || error.code === 'EACCES') return t.skip('symlink creation unavailable'); throw error; }
  assert.throws(() => f.inspect(), /UNSAFE_LINK_ENTRY/);
});
