// Explicit read-only operator preflight. Never imports or starts a worker.
import { inspectRuntimeReadiness } from '../companion/runtime-readiness.mjs';
if (process.argv.slice(2).length !== 1 || process.argv[2] !== '--check') {
  console.log('Set MW5_COMPANION_RUNTIME_ROOT, then use --check for static preparation checks.');
  process.exitCode = process.argv.length > 2 ? 2 : 0;
} else {
  const report = await inspectRuntimeReadiness();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'PINNED_INPUTS_AND_ENVIRONMENT_FILES_VERIFIED' ? 0 : 1;
}
