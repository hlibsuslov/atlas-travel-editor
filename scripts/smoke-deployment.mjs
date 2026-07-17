#!/usr/bin/env node

/**
 * Black-box smoke test for a deployed Atlas static frontend. It checks the SPA
 * fallback, PWA files, immutable hashed assets, security headers, and optional
 * public build provenance without needing Vercel credentials.
 */

const rawUrl = process.argv[2] ?? process.env.ATLAS_SMOKE_URL;
if (!rawUrl) {
  console.error('Usage: npm run smoke:deploy -- https://atlas.example.com');
  process.exit(2);
}

const base = new URL(rawUrl);
const expectedCommit = process.env.ATLAS_EXPECT_COMMIT;
const expectedEnvironment = process.env.ATLAS_EXPECT_ENV;
const failures = [];
const passed = [];

function assert(condition, message) {
  if (condition) passed.push(message);
  else failures.push(message);
}

async function request(pathname) {
  const url = new URL(pathname, base);
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'atlas-deployment-smoke/1.0' },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`${url} redirected to ${response.headers.get('location') ?? '(unknown)'}`);
  }
  return response;
}

try {
  const root = await request('/');
  const html = await root.text();
  assert(root.status === 200, 'root returns HTTP 200');
  assert(root.headers.get('content-type')?.includes('text/html'), 'root is HTML');
  assert(html.includes('id="root"'), 'HTML contains the React mount point');
  assert(html.includes('rel="manifest"'), 'HTML links the PWA manifest');
  assert(/<script[^>]+type="module"[^>]+src="\/assets\//.test(html), 'HTML loads a hashed module');

  const expectedHeaders = {
    'content-security-policy': ['default-src', 'script-src', 'frame-ancestors'],
    'strict-transport-security': ['max-age='],
    'x-content-type-options': ['nosniff'],
    'x-frame-options': ['DENY'],
    'referrer-policy': ['strict-origin-when-cross-origin'],
    'permissions-policy': ['camera=()'],
  };
  for (const [name, fragments] of Object.entries(expectedHeaders)) {
    const value = root.headers.get(name) ?? '';
    assert(
      fragments.every((fragment) => value.includes(fragment)),
      `${name} is present and valid`,
    );
  }

  const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)].map(
    (match) => match[1],
  );
  assert(
    assetPaths.some((assetPath) => assetPath.endsWith('.js')),
    'HTML references JavaScript assets',
  );
  assert(
    assetPaths.some((assetPath) => assetPath.endsWith('.css')),
    'HTML references CSS assets',
  );
  for (const assetPath of [...new Set(assetPaths)]) {
    const asset = await request(assetPath);
    const cache = asset.headers.get('cache-control') ?? '';
    assert(asset.status === 200, `${assetPath} returns HTTP 200`);
    assert(
      cache.includes('immutable') && cache.includes('max-age=31536000'),
      `${assetPath} is immutable`,
    );
  }

  for (const route of ['/map', '/stats', '/friends', '/share/__atlas_smoke__', '/unknown-route']) {
    const response = await request(route);
    const body = await response.text();
    assert(
      response.status === 200 && body.includes('id="root"'),
      `${route} resolves through SPA fallback`,
    );
  }

  const manifestResponse = await request('/manifest.webmanifest');
  const manifest = await manifestResponse.json();
  assert(manifestResponse.status === 200, 'PWA manifest returns HTTP 200');
  assert(manifest.name?.startsWith('Atlas'), 'PWA manifest identifies Atlas');
  assert(manifest.start_url === '/', 'PWA start_url is root');
  assert(
    Array.isArray(manifest.icons) && manifest.icons.length >= 3,
    'PWA manifest has install icons',
  );

  for (const pathname of ['/registerSW.js', '/sw.js']) {
    const response = await request(pathname);
    assert(response.status === 200, `${pathname} returns HTTP 200`);
  }

  const buildInfoResponse = await request('/build-info.json');
  if (buildInfoResponse.headers.get('content-type')?.includes('application/json')) {
    const buildInfo = await buildInfoResponse.json();
    assert(buildInfo.app === 'atlas', 'build-info.json identifies Atlas');
    assert(typeof buildInfo.builtAt === 'string', 'build-info.json contains a build timestamp');
    assert(typeof buildInfo.environment === 'string', 'build-info.json contains an environment');
    if (buildInfo.commit) {
      assert(/^[0-9a-f]{40}$/i.test(buildInfo.commit), 'build commit is a full SHA');
    }
    if (expectedCommit) {
      assert(buildInfo.commit === expectedCommit, `build commit matches ${expectedCommit}`);
    }
    if (expectedEnvironment) {
      assert(
        buildInfo.environment === expectedEnvironment,
        `build environment is ${expectedEnvironment}`,
      );
    }
  } else {
    console.warn('WARN build-info.json is absent (expected on deployments predating this guard).');
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

for (const message of passed) console.log(`PASS ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`);
  process.exit(1);
}
console.log(`Deployment smoke passed: ${base.origin}`);
