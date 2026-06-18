import { openDB, type IDBPDatabase } from 'idb';
import type { TravelData } from '@/domain/schema';
import { downloadText } from '@/lib/download';
import type { DocumentStore, StorageDoc, Capabilities, VersionToken } from '../types';
import { wrapEnvelope, readEnvelope } from '../envelope';

/**
 * A single local JSON file as the backing store, via the File System Access API
 * (`showSaveFilePicker`/`showOpenFilePicker`). The granted `FileSystemFileHandle`
 * is persisted in IndexedDB so the same file reconnects across reloads.
 *
 * On browsers without the API (Firefox/Safari), `save()` falls back to a plain
 * download (`download.ts`) and `load()` returns null — the user re-imports the
 * file through the existing ImportModal FileReader path. Either way the bytes are
 * the portable envelope, so the formats are interchangeable.
 */

// Minimal structural typing for the File System Access API so we don't depend on
// lib.dom additions that may not be present in the project's TS lib target.
interface FsWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}
interface FsPickerWindow {
  showSaveFilePicker?: (opts?: unknown) => Promise<FsFileHandle>;
  showOpenFilePicker?: (opts?: unknown) => Promise<FsFileHandle[]>;
}

const FILE_NAME = 'travel-data.json';
const HANDLE_DB = 'travel-editor-files';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'active';

let handleDbPromise: Promise<IDBPDatabase> | null = null;
function getHandleDb(): Promise<IDBPDatabase> {
  if (!handleDbPromise) {
    handleDbPromise = openDB(HANDLE_DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      },
    });
  }
  return handleDbPromise;
}

function fsApi(): FsPickerWindow {
  return window as unknown as FsPickerWindow;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof fsApi().showSaveFilePicker === 'function';
}

const PICKER_OPTS = {
  suggestedName: FILE_NAME,
  types: [{ description: 'Travel data', accept: { 'application/json': ['.json'] } }],
};

const FILE_CAPS: Capabilities = {
  sharing: false,
  // File mtime/size could give weak OCC, but a plain file has no atomic
  // compare-and-swap, so we don't advertise token concurrency.
  concurrency: 'none',
  watch: false,
  list: false,
  auth: false,
};

export class LocalFileStore implements DocumentStore {
  readonly id = 'localfile' as const;
  readonly label = 'Local file';
  readonly capabilities = FILE_CAPS;

  private handle: FsFileHandle | null = null;

  private async restoreHandle(): Promise<FsFileHandle | null> {
    if (this.handle) return this.handle;
    if (!isFileSystemAccessSupported()) return null;
    try {
      const db = await getHandleDb();
      const stored = (await db.get(HANDLE_STORE, HANDLE_KEY)) as FsFileHandle | undefined;
      if (stored) this.handle = stored;
    } catch {
      /* handle gone or storage unavailable — treat as not connected */
    }
    return this.handle;
  }

  private async ensurePermission(
    handle: FsFileHandle,
    mode: 'read' | 'readwrite',
  ): Promise<boolean> {
    try {
      if (handle.queryPermission && (await handle.queryPermission({ mode })) === 'granted')
        return true;
      if (handle.requestPermission && (await handle.requestPermission({ mode })) === 'granted')
        return true;
      // No permission API (older impls) — assume usable.
      return !handle.queryPermission && !handle.requestPermission;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    if (!isFileSystemAccessSupported()) return; // download-fallback mode; nothing to grant
    const api = fsApi();
    const handle = await api.showSaveFilePicker!(PICKER_OPTS);
    this.handle = handle;
    try {
      const db = await getHandleDb();
      await db.put(HANDLE_STORE, handle, HANDLE_KEY);
    } catch {
      /* persistence is best-effort; the handle still works this session */
    }
  }

  /** Open an existing file (used to import an already-saved document). */
  async open(): Promise<void> {
    if (!isFileSystemAccessSupported()) return;
    const api = fsApi();
    const [handle] = await api.showOpenFilePicker!(PICKER_OPTS);
    if (!handle) return;
    this.handle = handle;
    try {
      const db = await getHandleDb();
      await db.put(HANDLE_STORE, handle, HANDLE_KEY);
    } catch {
      /* best-effort */
    }
  }

  async load(): Promise<StorageDoc | null> {
    const handle = await this.restoreHandle();
    if (!handle) return null;
    if (!(await this.ensurePermission(handle, 'read'))) return null;
    try {
      const file = await handle.getFile();
      const text = await file.text();
      if (!text.trim()) return null;
      const { data, updatedAt } = readEnvelope(JSON.parse(text));
      return {
        data,
        meta: {
          version: `${file.lastModified}:${file.size}`,
          isPublic: false,
          shareSlug: null,
          updatedAt,
        },
      };
    } catch {
      return null;
    }
  }

  async save(data: TravelData, _expected?: VersionToken): Promise<StorageDoc> {
    void _expected;
    const updatedAt = new Date().toISOString();
    const text = JSON.stringify(wrapEnvelope(data, updatedAt), null, 2);

    const handle = await this.restoreHandle();
    if (handle && (await this.ensurePermission(handle, 'readwrite'))) {
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      const file = await handle.getFile();
      return {
        data,
        meta: {
          version: `${file.lastModified}:${file.size}`,
          isPublic: false,
          shareSlug: null,
          updatedAt,
        },
      };
    }

    // Fallback: no API / no handle — hand the user a download. The version token
    // is null (no readback handle), so callers treat each save as a fresh write.
    downloadText(FILE_NAME, text);
    return { data, meta: { version: null, isPublic: false, shareSlug: null, updatedAt } };
  }

  isConnected(): boolean {
    return this.handle !== null;
  }

  async disconnect(): Promise<void> {
    this.handle = null;
    try {
      const db = await getHandleDb();
      await db.delete(HANDLE_STORE, HANDLE_KEY);
    } catch {
      /* ignore */
    }
  }
}
