/**
 * Writes a synthetic pair of schedule updates to a folder:
 *   update-01.xer, update-02.xer and expected.json
 *
 *   pnpm gen-xer --activities 350000 --seed 42 --sector rail --out fixtures/synthetic/rail-350k
 */
import { closeSync, mkdirSync, openSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { SECTORS, generatePair, writeXer, type Sector, type Update } from '@slip/gen';

const { values } = parseArgs({
  options: {
    activities: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '42' },
    sector: { type: 'string', default: 'rail' },
    out: { type: 'string' },
  },
});

const activities = Number(values.activities);
const seed = Number(values.seed);
const sector = values.sector as Sector;
if (
  !Number.isInteger(activities) ||
  !Number.isInteger(seed) ||
  !SECTORS.includes(sector) ||
  !values.out
) {
  console.error(
    `Usage: pnpm gen-xer --activities <count> --seed <integer> --sector <${SECTORS.join('|')}> --out <folder>`,
  );
  process.exit(1);
}

function writeUpdate(path: string, update: Update): number {
  const file = openSync(path, 'w');
  // The generator only emits ASCII, so latin1 bytes are valid windows-1252 and valid UTF-8.
  writeXer(update, (chunk) => writeSync(file, chunk, null, 'latin1'));
  closeSync(file);
  return statSync(path).size;
}

const started = performance.now();
const pair = generatePair({ activities, seed, sector });
const generated = performance.now();
mkdirSync(values.out, { recursive: true });
const size1 = writeUpdate(join(values.out, 'update-01.xer'), pair.update01);
const size2 = writeUpdate(join(values.out, 'update-02.xer'), pair.update02);
writeFileSync(join(values.out, 'expected.json'), JSON.stringify(pair.expected, null, 2) + '\n');

const megabytes = (bytes: number) => `${(bytes / 1e6).toFixed(1)}MB`;
const { expected } = pair;
console.log(`${values.out}`);
console.log(
  `  update-01.xer  ${expected.update01.activities} activities, ${expected.update01.relationships} relationships, ${megabytes(size1)}`,
);
console.log(
  `  update-02.xer  ${expected.update02.activities} activities, ${expected.update02.relationships} relationships, ${megabytes(size2)}`,
);
console.log(
  `  ${expected.milestone.code} slips ${expected.milestone.slipWorkingDays} working days (${expected.milestone.finish01} to ${expected.milestone.finish02})`,
);
console.log(
  `  generated in ${((generated - started) / 1000).toFixed(1)}s, written in ${((performance.now() - generated) / 1000).toFixed(1)}s`,
);
