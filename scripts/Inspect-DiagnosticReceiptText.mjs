// Read-only offline pinned text check. No editor, game, network or schema parser.
import { inspectReceiptTextFile } from '../companion/diagnostic-receipt-text.mjs';
const args = process.argv.slice(2);
if (args.length !== 5 || args[1] !== '--expected-bytes' || args[3] !== '--expected-sha256' ||
    !/^(0|[1-9][0-9]*)$/.test(args[2]) || !Number.isSafeInteger(Number(args[2])) ||
    !/^[0-9a-f]{64}$/.test(args[4])) {
  console.error('Usage: node scripts/Inspect-DiagnosticReceiptText.mjs <text-file> --expected-bytes <integer> --expected-sha256 <lowercase-sha256>');
  process.exitCode = 2;
} else {
  try {
    const report = await inspectReceiptTextFile(args[0], {
      expectedBytes: Number(args[2]), expectedSha256: args[4] });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.formatStatus === 'VALID_PINNED_UTF16LE_TEXT' ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'READ_FAILED', code: error.code ?? error.message,
      sourceModified: false, runtimeAcceptance: 'NOT_PERFORMED', transitionSchema: 'NOT_DEFINED',
      semanticStatus: 'NOT_EVALUATED', aggregateBudgetValidation: 'NOT_PERFORMED' }));
    process.exitCode = 2;
  }
}
