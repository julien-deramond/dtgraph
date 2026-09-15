import { createProgram } from './program.js';
import { describeContextHint } from './token-graph.js';

createProgram()
  .parseAsync(process.argv)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    const hint = describeContextHint(error);
    if (hint !== undefined) console.error(hint);
    process.exitCode = 1;
  });
