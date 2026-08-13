import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Node 22.18+ strips erasable TypeScript syntax by default. The package's
// supported 22.12–22.17 range needs the equivalent runtime flag.
const [nodeMajor = 0, nodeMinor = 0] = process.versions.node
  .split('.')
  .map(Number);
const needsTypeStripFlag = nodeMajor === 22 && nodeMinor < 18;
if (needsTypeStripFlag && process.env.VGZT_TYPE_STRIP_REEXEC !== '1') {
  const child = spawnSync(
    process.execPath,
    ['--experimental-strip-types', ...process.argv.slice(1)],
    {
      stdio: 'inherit',
      env: { ...process.env, VGZT_TYPE_STRIP_REEXEC: '1' },
    },
  );
  process.exit(child.status ?? 1);
}

const { validateContentGraph } =
  await import('../src/lib/content-validation.ts');

const root = fileURLToPath(new URL('..', import.meta.url));
const launch = process.argv.includes('--launch');
const parseIssues = [];

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

async function yaml(file) {
  try {
    return parse(await readFile(file, 'utf8'));
  } catch (error) {
    parseIssues.push({
      code: 'yaml_parse',
      path: relative(file),
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function yamlFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    parseIssues.push({
      code: 'missing_collection',
      path: relative(directory),
      message: error instanceof Error ? error.message : String(error),
    });
    return files;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await yamlFiles(fullPath)));
    else if (/\.ya?ml$/i.test(entry.name)) files.push(fullPath);
  }
  return files.sort();
}

async function collection(name) {
  const directory = path.join(root, 'src', 'content', name);
  const records = [];
  for (const file of await yamlFiles(directory)) {
    const record = await yaml(file);
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      parseIssues.push({
        code: 'invalid_shape',
        path: relative(file),
        message: 'Collection entries must be YAML mappings.',
      });
      continue;
    }
    records.push({ ...record, __source: relative(file) });
  }
  return records;
}

async function dataFile(name) {
  const file = path.join(root, 'src', 'data', name);
  const record = await yaml(file);
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    parseIssues.push({
      code: 'invalid_shape',
      path: relative(file),
      message: 'Data file must contain a YAML mapping.',
    });
    return {};
  }
  return record;
}

function assetExists(sourceFile, assetReference) {
  if (typeof assetReference !== 'string' || path.isAbsolute(assetReference))
    return false;
  const source = path.resolve(root, sourceFile);
  const asset = path.resolve(path.dirname(source), assetReference);
  const relativeAsset = path.relative(root, asset);
  return (
    !relativeAsset.startsWith('..') &&
    !path.isAbsolute(relativeAsset) &&
    existsSync(asset)
  );
}

const [
  people,
  seasons,
  events,
  opportunities,
  sessionConfig,
  abstractCall,
  site,
  social,
  pending,
] = await Promise.all([
  collection('people'),
  collection('seasons'),
  collection('events'),
  collection('opportunities'),
  dataFile('session-types.yml'),
  dataFile('abstract-call.yml'),
  dataFile('site.yml'),
  dataFile('social.yml'),
  dataFile('pending-content.yml'),
]);

const graph = {
  people,
  seasons,
  events,
  opportunities,
  sessionTypes: Array.isArray(sessionConfig.sessionTypes)
    ? sessionConfig.sessionTypes
    : [],
  timeSlots: Array.isArray(sessionConfig.timeSlots)
    ? sessionConfig.timeSlots
    : [],
  abstractCall,
  site,
  social,
  pending: Array.isArray(pending.pending) ? pending.pending : [],
};

if (!Array.isArray(sessionConfig.sessionTypes)) {
  parseIssues.push({
    code: 'invalid_shape',
    path: 'src/data/session-types.yml:sessionTypes',
    message: 'Expected a sessionTypes list.',
  });
}
if (!Array.isArray(sessionConfig.timeSlots)) {
  parseIssues.push({
    code: 'invalid_shape',
    path: 'src/data/session-types.yml:timeSlots',
    message: 'Expected a timeSlots list.',
  });
}
if (!Array.isArray(pending.pending)) {
  parseIssues.push({
    code: 'invalid_shape',
    path: 'src/data/pending-content.yml:pending',
    message: 'Expected a pending list.',
  });
}

let validationIssues = [];
try {
  validationIssues = validateContentGraph(graph, { launch, assetExists });
} catch (error) {
  validationIssues.push({
    code: 'validation_exception',
    path: 'content graph',
    message: error instanceof Error ? error.message : String(error),
  });
}

const issues = [...parseIssues, ...validationIssues].sort(
  (first, second) =>
    first.path.localeCompare(second.path, undefined, { numeric: true }) ||
    first.code.localeCompare(second.code),
);

if (issues.length > 0) {
  console.error(
    `VGZT content validation failed with ${issues.length} issue(s):`,
  );
  for (const issue of issues) {
    console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  const unresolved = graph.pending.filter(
    (item) => item.status === 'pending',
  ).length;
  console.log(
    `VGZT content validation passed (${people.length} people, ${seasons.length} seasons, ` +
      `${events.length} events, ${opportunities.length} opportunities).`,
  );
  if (!launch && unresolved > 0) {
    console.log(
      `${unresolved} pending content item(s) remain; run pnpm run report:pending for the checklist.`,
    );
  }
}
