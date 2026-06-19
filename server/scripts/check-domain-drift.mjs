import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The server vendors the client's domain (the single source of truth for what a
 * valid TravelData document is) so client and server can never disagree. This
 * guard fails CI if the copies drift. To re-sync:
 *   cp src/domain/{schema,normalize,timeline,constants}.ts server/src/domain/
 */
const here = dirname(fileURLToPath(import.meta.url));
const serverDomain = join(here, '..', 'src', 'domain');
const clientDomain = join(here, '..', '..', 'src', 'domain');
const files = ['schema.ts', 'normalize.ts', 'timeline.ts', 'constants.ts'];

let drift = false;
for (const file of files) {
  const a = readFileSync(join(serverDomain, file), 'utf8');
  const b = readFileSync(join(clientDomain, file), 'utf8');
  if (a !== b) {
    console.error(`DRIFT: server/src/domain/${file} differs from src/domain/${file}`);
    drift = true;
  }
}

if (drift) {
  console.error(
    '\nThe server vendors the client domain. Re-sync with:\n' +
      '  cp src/domain/{schema,normalize,timeline,constants}.ts server/src/domain/',
  );
  process.exit(1);
}
console.log('domain in sync ✓');
