// Read-only inspection of the PROPOSED raw-capture format. No game or network access.

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== '--allow-synthetic')) {
  console.error('Usage: node scripts/Inspect-PassiveCapture.mjs <capture.json> [--allow-synthetic]');
  process.exitCode = 2;
} else {
  try {
    const { inspectPassiveCaptureFile } = await import('../companion/passive-capture.mjs');
    const report = await inspectPassiveCaptureFile(args[0], { allowSynthetic: args[1] === '--allow-synthetic' });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.formatStatus === 'VALID_PROJECT_CAPTURE' ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'READ_FAILED', code: error.code ?? error.message,
      runtimeAcceptance: 'NOT_PERFORMED' }));
    process.exitCode = 2;
  }
}
