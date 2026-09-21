// Exact reviewed source checkpoint. No runtime/model/game files, force pushes or history rewrites.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewSource } from './Review-SourceBackup.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const branch = 'codex/companion-foundation', remote = 'https://github.com/bug220r-lab/mw5-lancemate-companion.git';
const run = (args, options = {}) => {
  const r = spawnSync('git', args, { cwd: root, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, ...options });
  if (r.status !== 0) throw new Error(`GIT_${args[0]}_FAILED`); return r.stdout;
};
const text = args => run(args).toString().trim();
if (path.resolve(text(['rev-parse','--show-toplevel'])).toLowerCase() !== root.toLowerCase()) throw new Error('WRONG_GIT_ROOT');
if (text(['diff','--cached','--name-only'])) throw new Error('PREEXISTING_STAGED_CHANGES');
const auth = spawnSync(process.execPath, ['scripts/Prepare-GitHubBackup.mjs'], { cwd: root, windowsHide: true, encoding: 'utf8' });
if (auth.status !== 0) throw new Error('PRIVATE_REPOSITORY_VERIFICATION_FAILED');
const repo = JSON.parse(auth.stdout);
if (repo.owner !== 'bug220r-lab' || repo.visibility !== 'private' || !repo.pushPermission) throw new Error('REPOSITORY_NOT_APPROVED');
const receipt = reviewSource();
if (receipt.status !== 'READY_FOR_PRIVATE_SOURCE_CHECKPOINT') throw new Error('SOURCE_REVIEW_FAILED');
fs.writeFileSync(path.join(root,'research/SOURCE_BACKUP_REVIEW.json'), JSON.stringify(receipt,null,2)+'\n');
const hashes = new Map(receipt.includePaths.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
for (const file of receipt.includePaths) if (file.includes('\0') || file.startsWith('/') || file.split('/').includes('..')) throw new Error('UNSAFE_PATHSPEC');
const head = spawnSync('git',['rev-parse','--verify','HEAD'],{cwd:root,windowsHide:true});
if (head.status !== 0) run(['symbolic-ref','HEAD',`refs/heads/${branch}`]);
else if (text(['branch','--show-current']) !== branch) throw new Error('UNEXPECTED_BRANCH');
const origin = spawnSync('git',['remote','get-url','origin'],{cwd:root,windowsHide:true,encoding:'utf8'});
if (origin.status !== 0) run(['remote','add','origin',remote]);
else if (origin.stdout.trim() !== remote) throw new Error('REMOTE_MISMATCH');
run(['-c','core.autocrlf=false','add','--pathspec-from-file=-','--pathspec-file-nul'], { input: receipt.includePaths.join('\0')+'\0' });
const tracked = text(['ls-files','-z']).split('\0').filter(Boolean).sort();
if (JSON.stringify(tracked) !== JSON.stringify([...receipt.includePaths].sort())) throw new Error('INDEX_ALLOWLIST_MISMATCH');
for (const file of tracked) {
  if (createHash('sha256').update(run(['show',`:${file}`])).digest('hex') !== hashes.get(file)) throw new Error('STAGED_CONTENT_DRIFT');
}
if (!text(['diff','--cached','--name-only'])) { console.log(JSON.stringify({status:'NO_CHANGES'})); process.exit(0); }
run(['-c','user.name=bug220r-lab','-c','user.email=327781782+bug220r-lab@users.noreply.github.com',
  'commit','-m','Checkpoint reviewed MW5 companion source and offline evidence']);
const commit = text(['rev-parse','HEAD']);
run(['push','--set-upstream','origin',`HEAD:refs/heads/${branch}`]);
const pushed = text(['ls-remote','origin',`refs/heads/${branch}`]).split(/\s+/)[0];
if (pushed !== commit) throw new Error('REMOTE_COMMIT_MISMATCH');
const final = {recordedAt:new Date().toISOString(),status:'PRIVATE_SOURCE_BACKUP_VERIFIED',repository:repo.url,
  owner:repo.owner,visibility:repo.visibility,branch,commit,remoteCommit:pushed,files:tracked.length,
  reviewedBytes:receipt.counts.includedBytesExcludingThisReceipt,scope:receipt.scope,
  excluded:receipt.excluded.map(x=>({path:x.path,reason:x.reason})),gameDeployment:'NOT_PERFORMED'};
fs.writeFileSync(path.join(root,'research/GITHUB_BACKUP.json'),JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify(final));
