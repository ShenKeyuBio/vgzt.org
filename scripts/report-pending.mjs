import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const pendingFile = fileURLToPath(
  new URL('../src/data/pending-content.yml', import.meta.url),
);

try {
  const document = parse(await readFile(pendingFile, 'utf8'));
  if (!document || !Array.isArray(document.pending)) {
    throw new TypeError('Expected a top-level "pending" list.');
  }

  const unresolved = document.pending.filter(
    (item) => item?.status === 'pending',
  );
  const launchBlockers = unresolved.filter(
    (item) => item.requiredForLaunch === true,
  );

  console.log(
    `VGZT pending content: ${unresolved.length} unresolved (${launchBlockers.length} required for launch).`,
  );

  for (const item of unresolved) {
    const requirement = item.requiredForLaunch === true ? 'LAUNCH' : 'optional';
    console.log(`- [${requirement}] ${item.key}: ${item.label}`);
    console.log(`  Replace via: ${item.replaceVia}`);
  }
} catch (error) {
  console.error(`Unable to report pending content from ${pendingFile}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
