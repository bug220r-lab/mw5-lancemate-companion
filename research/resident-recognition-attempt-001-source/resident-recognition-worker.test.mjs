// Runs only the Python fake-library/protocol suite; the suite forbids native loads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('Python worker ABI, pipe and ownership tests pass without native inference',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const python=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  const result=spawnSync(python,['-I','-S','-B',path.join(root,'scripts/Test-ResidentRecognitionWorker.py')],
    {cwd:root,windowsHide:true,shell:false,encoding:'utf8',timeout:30000,maxBuffer:2*1024**2});
  const output=(result.stdout??'')+(result.stderr??'');
  assert.equal(result.error,undefined,result.error?.code);
  assert.equal(result.status,0,output);
  assert.match(output,/Ran [1-9]\d* tests? in [\d.]+s/);
  assert.match(output,/\nOK\s*$/);
  assert.doesNotMatch(output,/FAILED|skipped=|expected failures=/);
});
