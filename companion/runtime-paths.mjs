// Operator configuration only. Request bodies and model output never choose paths.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstat, realpath } from 'node:fs/promises';

export const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prohibited = new Set(['librarycache', '.handoff', '.codex', 'codex-runtimes']);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const inside = (file, root) => { const relative = path.relative(root, file); return relative === '' ||
  (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)); };

export function resolveRuntimeRoot(value, sourceRoot = SOURCE_ROOT) {
  // The absent legacy location keeps old inert fixtures/source packages readable.
  // Production admission below requires explicit provisioning/configuration.
  if (value === undefined) return path.join(sourceRoot, 'companion', 'local');
  if (typeof value !== 'string' || !value || value.trim() !== value || !path.isAbsolute(value) ||
      value.startsWith('\\\\') || value.startsWith('//') || value.includes('\0') ||
      (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/.test(value))) fail('RUNTIME_ROOT_INVALID');
  const pieces = value.split(/[\\/]/);
  if (pieces.some(piece => piece === '..' || prohibited.has(piece.toLowerCase()))) fail('RUNTIME_ROOT_PROTECTED');
  const result = path.resolve(value);
  if (equalPath(result, path.parse(result).root) || inside(result, sourceRoot) || inside(sourceRoot, result))
    fail('RUNTIME_ROOT_PROTECTED');
  return result;
}

export const RUNTIME_CONFIGURED = process.env.MW5_COMPANION_RUNTIME_ROOT !== undefined;
export const RUNTIME_ROOT = resolveRuntimeRoot(process.env.MW5_COMPANION_RUNTIME_ROOT);
export function requireRuntimeConfiguration() {
  if (!RUNTIME_CONFIGURED) fail('RUNTIME_ROOT_NOT_CONFIGURED');
  return RUNTIME_ROOT;
}

export async function verifyRuntimeDirectory(directory = requireRuntimeConfiguration(), io = { lstat, realpath }) {
  // Reject redirected ancestors as well as a redirected leaf, before any writes.
  const absolute = path.resolve(directory), parts = [];
  for (let current = absolute;; current = path.dirname(current)) {
    parts.push(current); if (current === path.dirname(current)) break;
  }
  for (const current of parts.reverse()) {
    const stat = await io.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !equalPath(await io.realpath(current), current))
      fail('RUNTIME_ROOT_REDIRECTED');
  }
  return absolute;
}

export function runtimeInventoryPath(relative, runtimeRoot = RUNTIME_ROOT) {
  if (typeof relative !== 'string' || !/^companion[\\/]local[\\/]/.test(relative)) fail('RUNTIME_INVENTORY_PATH_INVALID');
  const suffix = relative.replace(/^companion[\\/]local[\\/]/, '');
  if (!suffix || suffix.split(/[\\/]/).some(part => !part || part === '.' || part === '..') || path.isAbsolute(suffix))
    fail('RUNTIME_INVENTORY_PATH_INVALID');
  const result = path.resolve(runtimeRoot, suffix.replace(/[\\/]/g, path.sep));
  if (!inside(result, runtimeRoot) || equalPath(result, runtimeRoot)) fail('RUNTIME_INVENTORY_PATH_INVALID');
  return result;
}
