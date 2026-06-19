import { describe, expect, it } from 'vitest';
import { makeDefaultData } from '@/domain/normalize';
import { fetchMyRecord, fetchPublicRecord, saveMyRecord, setSharing } from './api';

/**
 * In local-first mode there is no remote backend, so the remote data-access layer
 * is a set of graceful stubs. The one behavior that MUST survive is the strict
 * validate-before-save guard: its exact `Cannot save invalid data:` message is
 * matched by the non-retriable regex in `lib/mutationError.ts`.
 */
describe('editor/api local stubs', () => {
  it('fetchMyRecord resolves null (no remote backend)', async () => {
    expect(await fetchMyRecord()).toBeNull();
  });

  it('fetchPublicRecord resolves null (no remote backend → SharePage shows "private")', async () => {
    expect(await fetchPublicRecord('any-slug')).toBeNull();
  });

  it('saveMyRecord refuses invalid data with the exact guarded message', async () => {
    const invalid = makeDefaultData();
    invalid.person.birthplace.country = '';
    await expect(saveMyRecord(invalid)).rejects.toThrow(/Cannot save invalid data/);
  });

  it('saveMyRecord reports no remote backend for otherwise-valid data', async () => {
    await expect(saveMyRecord(makeDefaultData())).rejects.toThrow(/No remote backend/);
  });

  it('setSharing reports no remote backend', async () => {
    await expect(setSharing(true)).rejects.toThrow(/No remote backend/);
  });
});
