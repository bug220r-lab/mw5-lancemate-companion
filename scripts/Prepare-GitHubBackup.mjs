// Use the existing Git Credential Manager login for the user-requested private backup.
// Tokens stay in this process and are never printed, persisted, or placed in URLs.
import { spawnSync } from 'node:child_process';
const expectedOwner = 'bug220r-lab';
const repositoryName = 'mw5-lancemate-companion';
const credential = spawnSync('git', ['credential', 'fill'], { encoding: 'utf8', windowsHide: true,
  input: `protocol=https\nhost=github.com\nusername=${expectedOwner}\n\n`,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
if (credential.status !== 0) throw new Error('EXISTING_GITHUB_AUTH_UNAVAILABLE');
const values = Object.fromEntries(credential.stdout.split('\n').map(line => {
  const index = line.indexOf('='); return index < 0 ? ['', ''] : [line.slice(0,index), line.slice(index+1).trim()];
}));
credential.stdout = ''; credential.stderr = '';
if (!values.password) throw new Error('EXISTING_GITHUB_AUTH_UNAVAILABLE');
const headers = { Authorization: `Bearer ${values.password}`, Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
const request = (endpoint, options = {}) => fetch(`https://api.github.com${endpoint}`, { ...options,
  headers, signal: AbortSignal.timeout(30000) });
const accountResponse = await request('/user');
if (!accountResponse.ok) throw new Error(`AUTH_HTTP_${accountResponse.status}`);
const account = await accountResponse.json();
if (account.login !== expectedOwner || String(account.id) !== '327781782') throw new Error('GITHUB_ACCOUNT_MISMATCH');
let response = await request(`/repos/${expectedOwner}/${repositoryName}`);
let created = false;
if (response.status === 404 && process.argv.includes('--create')) {
  response = await request('/user/repos', { method: 'POST', body: JSON.stringify({ name: repositoryName,
    description: 'Personal MW5 Lancemate Companion research and local implementation; native integration remains gated.',
    private: true, auto_init: false, has_issues: false, has_projects: false, has_wiki: false }) });
  created = response.status === 201;
}
if (!response.ok) throw new Error(`REPOSITORY_HTTP_${response.status}`);
const repo = await response.json();
if (repo.owner?.login !== expectedOwner || repo.private !== true || repo.visibility !== 'private' || repo.archived)
  throw new Error('REPOSITORY_OWNER_OR_VISIBILITY_MISMATCH');
delete values.password; headers.Authorization = '';
console.log(JSON.stringify({ owner: repo.owner.login, repository: repo.full_name, url: repo.html_url,
  visibility: repo.visibility, created, pushPermission: repo.permissions?.push === true,
  contentUploaded: false, defaultBranch: repo.default_branch }));
