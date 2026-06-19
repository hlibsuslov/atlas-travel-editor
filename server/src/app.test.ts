import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, type DB } from './db';
import { createApp } from './app';

/**
 * End-to-end HTTP tests against an in-memory SQLite database (Node's built-in test
 * runner — no bundler, so the brand-new `node:sqlite` loads natively). Exercises
 * the auth + document round-trip including optimistic concurrency (If-Match → 409)
 * and the shared validate-on-save guard.
 */
let db: DB;
let app: ReturnType<typeof createApp>;

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

const putJson = (body: unknown, headers: Record<string, string> = {}) => ({
  ...json(body, headers),
  method: 'PUT',
});

const patchJson = (body: unknown, headers: Record<string, string> = {}) => ({
  ...json(body, headers),
  method: 'PATCH',
});

const doc = (country = 'Ukraine') => ({
  person: { birthplace: { country } },
  travel: {
    countries: [
      {
        name: 'Austria',
        status: { visited: true, lived: false, birthplace: false },
        capitalVisit: { visited: true },
        timeline: { visited: [], lived: [] },
        cities: [],
      },
    ],
  },
});

async function register(username = 'alice'): Promise<string> {
  const res = await app.request(
    '/auth/register',
    json({ email: `${username}@example.com`, username, password: 'supersecret' }),
  );
  assert.equal(res.status, 201);
  return ((await res.json()) as { token: string }).token;
}

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db);
});

describe('Atlas Server', () => {
  it('reports health + capabilities', async () => {
    const res = await app.request('/healthz');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; capabilities: { sharing: boolean } };
    assert.equal(body.ok, true);
    assert.equal(body.capabilities.sharing, true);
  });

  it('registers, then resolves /me with the issued token', async () => {
    const token = await register();
    const res = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { user: { username: string } };
    assert.equal(body.user.username, 'alice');
  });

  it('rejects a duplicate email/username', async () => {
    await register('bob');
    const res = await app.request(
      '/auth/register',
      json({ email: 'bob@example.com', username: 'bob', password: 'supersecret' }),
    );
    assert.equal(res.status, 409);
  });

  it('logs in with valid credentials and rejects bad ones', async () => {
    await register('carol');
    const ok = await app.request('/auth/login', json({ login: 'carol', password: 'supersecret' }));
    assert.equal(ok.status, 200);
    const bad = await app.request('/auth/login', json({ login: 'carol', password: 'wrong' }));
    assert.equal(bad.status, 401);
  });

  it('blocks unauthenticated document access', async () => {
    assert.equal((await app.request('/me/document')).status, 401);
  });

  it('round-trips a document and increments the version', async () => {
    const token = await register();
    const auth = { Authorization: `Bearer ${token}` };

    assert.equal((await app.request('/me/document', { headers: auth })).status, 404);

    const put = await app.request('/me/document', putJson({ data: doc('Poland') }, auth));
    assert.equal(put.status, 200);
    const saved = (await put.json()) as {
      version: number;
      data: { person: { birthplace: { country: string } } };
    };
    assert.equal(saved.version, 1);
    assert.equal(saved.data.person.birthplace.country, 'Poland');

    const get = await app.request('/me/document', { headers: auth });
    assert.equal(((await get.json()) as { version: number }).version, 1);
  });

  it('rejects a stale write with 409 and the remote document', async () => {
    const token = await register();
    const auth = { Authorization: `Bearer ${token}` };
    await app.request('/me/document', putJson({ data: doc('A') }, auth)); // version 1
    await app.request('/me/document', putJson({ data: doc('B') }, auth)); // version 2 (no If-Match)

    const stale = await app.request(
      '/me/document',
      putJson({ data: doc('C') }, { ...auth, 'If-Match': '1' }),
    );
    assert.equal(stale.status, 409);
    const body = (await stale.json()) as { error: string; remote: { version: number } };
    assert.equal(body.error, 'conflict');
    assert.equal(body.remote.version, 2);
  });

  it('refuses to store invalid data with the shared guard message', async () => {
    const token = await register();
    const auth = { Authorization: `Bearer ${token}` };
    const invalid = doc();
    invalid.person.birthplace.country = '';
    const res = await app.request('/me/document', putJson({ data: invalid }, auth));
    assert.equal(res.status, 422);
    assert.match(((await res.json()) as { error: string }).error, /Cannot save invalid data/);
  });
});

describe('Atlas Server — sharing & public reads', () => {
  async function setup(): Promise<Record<string, string>> {
    const token = await register('pubby');
    const auth = { Authorization: `Bearer ${token}` };
    await app.request('/me/document', putJson({ data: doc('Ukraine') }, auth));
    return auth;
  }

  const slugOf = async (res: Response): Promise<string> =>
    ((await res.json()) as { share_slug: string }).share_slug;

  it('publishes publicly + sets a handle, readable by slug and by handle', async () => {
    const auth = await setup();
    assert.equal(
      (await app.request('/me/profile', putJson({ display_name: 'Pub', handle: 'pubby' }, auth)))
        .status,
      200,
    );
    const vis = await app.request(
      '/me/document/visibility',
      patchJson({ visibility: 'public' }, auth),
    );
    assert.equal(vis.status, 200);
    const slug = await slugOf(vis);
    assert.ok(slug);

    const bySlug = await app.request(`/share/${slug}`);
    assert.equal(bySlug.status, 200);
    const body = (await bySlug.json()) as {
      data: { person: { birthplace: { country: string } } };
      profile: { handle: string };
    };
    assert.equal(body.data.person.birthplace.country, 'Ukraine');
    assert.equal(body.profile.handle, 'pubby');

    assert.equal((await app.request('/u/pubby/map')).status, 200);
    assert.equal((await app.request('/u/pubby')).status, 200);
  });

  it('never leaks sensitive fields in public responses', async () => {
    const auth = await setup();
    await app.request('/me/profile', putJson({ display_name: 'Pub', handle: 'leaky' }, auth));
    const slug = await slugOf(
      await app.request('/me/document/visibility', patchJson({ visibility: 'public' }, auth)),
    );
    for (const path of [`/share/${slug}`, `/share/${slug}/profile`, '/u/leaky', '/u/leaky/map']) {
      const text = await (await app.request(path)).text();
      for (const banned of ['user_id', 'password', 'token', '"version"', '@example.com', 'email']) {
        assert.ok(!text.includes(banned), `${path} leaked "${banned}"`);
      }
    }
  });

  it('does not publicly serve a private document (generic 404)', async () => {
    const auth = await setup();
    const slug = await slugOf(
      await app.request('/me/document/visibility', patchJson({ visibility: 'public' }, auth)),
    );
    await app.request('/me/document/visibility', patchJson({ visibility: 'private' }, auth));
    assert.equal((await app.request(`/share/${slug}`)).status, 404);
  });

  it('rotating the slug revokes the old link', async () => {
    const auth = await setup();
    const oldSlug = await slugOf(
      await app.request('/me/document/visibility', patchJson({ visibility: 'unlisted' }, auth)),
    );
    assert.equal((await app.request(`/share/${oldSlug}`)).status, 200);
    const newSlug = await slugOf(
      await app.request('/me/document/rotate-slug', { method: 'POST', headers: auth }),
    );
    assert.notEqual(newSlug, oldSlug);
    assert.equal((await app.request(`/share/${oldSlug}`)).status, 404);
    assert.equal((await app.request(`/share/${newSlug}`)).status, 200);
  });

  it('reports handle availability', async () => {
    const auth = await setup();
    await app.request('/me/profile', putJson({ handle: 'taken' }, auth));
    const other = { Authorization: `Bearer ${await register('other')}` };
    const taken = (await (
      await app.request('/handles/taken/available', { headers: other })
    ).json()) as { available: boolean };
    assert.equal(taken.available, false);
    const free = (await (
      await app.request('/handles/freeone/available', { headers: other })
    ).json()) as { available: boolean };
    assert.equal(free.available, true);
  });
});

describe('Atlas Server — follows', () => {
  async function user(name: string, handle?: string): Promise<Record<string, string>> {
    const auth = { Authorization: `Bearer ${await register(name)}` };
    if (handle) await app.request('/me/profile', putJson({ handle }, auth));
    return auth;
  }

  it('follows by handle and lists the target profile', async () => {
    await user('alice', 'alice');
    const bob = await user('bob');
    assert.equal((await app.request('/follows', json({ handle: 'alice' }, bob))).status, 201);
    const list = (await (await app.request('/follows', { headers: bob })).json()) as Array<{
      handle: string;
    }>;
    assert.equal(list.length, 1);
    assert.equal(list[0]!.handle, 'alice');
  });

  it('follows by share slug and exposes the target live slug', async () => {
    const alice = await user('alice', 'alice');
    await app.request('/me/document', putJson({ data: doc() }, alice));
    const slug = (
      (await (
        await app.request('/me/document/visibility', patchJson({ visibility: 'unlisted' }, alice))
      ).json()) as { share_slug: string }
    ).share_slug;
    const bob = await user('bob');
    assert.equal((await app.request('/follows', json({ slug }, bob))).status, 201);
    const list = (await (await app.request('/follows', { headers: bob })).json()) as Array<{
      handle: string;
      share_slug: string;
    }>;
    assert.equal(list[0]!.handle, 'alice');
    assert.equal(list[0]!.share_slug, slug);
  });

  it('rejects a duplicate follow and a self-follow', async () => {
    await user('alice', 'alice');
    const bob = await user('bob', 'bob');
    await app.request('/follows', json({ handle: 'alice' }, bob));
    assert.equal((await app.request('/follows', json({ handle: 'alice' }, bob))).status, 409);
    assert.equal((await app.request('/follows', json({ handle: 'bob' }, bob))).status, 400);
  });

  it('unfollows by handle', async () => {
    await user('alice', 'alice');
    const bob = await user('bob');
    await app.request('/follows', json({ handle: 'alice' }, bob));
    assert.equal(
      (await app.request('/follows/alice', { method: 'DELETE', headers: bob })).status,
      204,
    );
    const list = (await (await app.request('/follows', { headers: bob })).json()) as unknown[];
    assert.equal(list.length, 0);
  });

  it('counts followers', async () => {
    const alice = await user('alice', 'alice');
    const bob = await user('bob');
    await app.request('/follows', json({ handle: 'alice' }, bob));
    const count = (await (await app.request('/followers', { headers: alice })).json()) as {
      count: number;
    };
    assert.equal(count.count, 1);
  });
});

describe('Atlas Server — friends, feed, discovery', () => {
  async function withHandle(name: string): Promise<Record<string, string>> {
    const auth = { Authorization: `Bearer ${await register(name)}` };
    await app.request('/me/profile', putJson({ display_name: name, handle: name }, auth));
    return auth;
  }

  it('discovers profiles by handle / display name', async () => {
    await withHandle('alice');
    const bob = await withHandle('bob');
    const list = (await (
      await app.request('/discover/profiles?q=ali', { headers: bob })
    ).json()) as Array<{
      handle: string;
    }>;
    assert.equal(list.length, 1);
    assert.equal(list[0]!.handle, 'alice');
  });

  it('lists only mutual-follow friends', async () => {
    const alice = await withHandle('alice');
    const bob = await withHandle('bob');
    await app.request('/follows', json({ handle: 'bob' }, alice));
    await app.request('/follows', json({ handle: 'alice' }, bob));
    const friends = (await (await app.request('/friends', { headers: alice })).json()) as Array<{
      handle: string;
    }>;
    assert.equal(friends.length, 1);
    assert.equal(friends[0]!.handle, 'bob');

    // A one-directional follow is NOT a friendship.
    const carol = await withHandle('carol');
    await app.request('/follows', json({ handle: 'alice' }, carol));
    const carolFriends = (await (
      await app.request('/friends', { headers: carol })
    ).json()) as unknown[];
    assert.equal(carolFriends.length, 0);
  });

  it('feeds a followed user’s public map with a country count', async () => {
    const alice = await withHandle('alice');
    await app.request('/me/document', putJson({ data: doc() }, alice));
    await app.request('/me/document/visibility', patchJson({ visibility: 'public' }, alice));
    const bob = await withHandle('bob');
    await app.request('/follows', json({ handle: 'alice' }, bob));
    const feed = (await (await app.request('/feed', { headers: bob })).json()) as Array<{
      handle: string;
      country_count: number;
    }>;
    assert.equal(feed.length, 1);
    assert.equal(feed[0]!.handle, 'alice');
    assert.equal(feed[0]!.country_count, 1);
  });
});
