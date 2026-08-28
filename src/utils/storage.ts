import localforage from 'localforage';
import { Item, AuditSession } from '../types';
import { INITIAL_ITEMS } from '../data/initialItems';
import {
  isFilesystemAvailable,
  saveItemsToNativeFile,
  readItemsFromNativeFile,
  saveSessionsToNativeFile,
  readSessionsFromNativeFile,
  exportFullBackupToNativeFile
} from './nativeFilesystem';

// Configure localforage to use IndexedDB as primary, falling back to WebSQL/localStorage
localforage.config({
  name: 'OfflineInventorySystem',
  storeName: 'inventory_store',
  description: 'Durable local database for items, audit sessions, and active drafts'
});

const STORAGE_KEYS = {
  ITEMS: 'inventory_app_items_v2',
  AUDIT_SESSIONS: 'inventory_app_audit_sessions_v2',
  ACTIVE_DRAFT_SESSION: 'inventory_app_active_draft_session_v2'
};

// In-memory runtime cache for instant synchronous access
let memoryItemsCache: Item[] | null = null;
let memorySessionsCache: AuditSession[] | null = null;
let memoryActiveDraftCache: AuditSession | null = null;

/**
 * Async load items from Server File Storage (/data_store/items.json) with IndexedDB & localStorage fallbacks
 */
export const loadItemsAsync = async (): Promise<Item[]> => {
  // 1. Try loading directly from Node/Termux Server Disk File Storage (/data_store/items.json)
  try {
    const res = await fetch('/api/storage/all');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.items) && json.items.length > 0) {
        memoryItemsCache = json.items;
        try {
          await localforage.setItem(STORAGE_KEYS.ITEMS, json.items);
          localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(json.items.length <= 1000 ? json.items : []));
        } catch (_) {}
        return json.items;
      }
    }
  } catch (err) {
    // API server not reachable or offline, fallback to browser local storage
  }

  try {
    // 2. Try reading from localforage (IndexedDB)
    const stored = await localforage.getItem<Item[]>(STORAGE_KEYS.ITEMS);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      memoryItemsCache = stored;
      // Sync back to server file storage if available
      syncItemsToServerFile(stored);
      return stored;
    }
  } catch (err) {
    console.warn('Error reading items from IndexedDB:', err);
  }

  // 3. Fallback to localStorage if IndexedDB had no data
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryItemsCache = parsed;
        await localforage.setItem(STORAGE_KEYS.ITEMS, parsed);
        syncItemsToServerFile(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading items from localStorage fallback:', err);
  }

  // 4. Fallback to Capacitor Native Filesystem (if available)
  try {
    if (isFilesystemAvailable()) {
      const nativeItems = await readItemsFromNativeFile();
      if (nativeItems && Array.isArray(nativeItems) && nativeItems.length > 0) {
        memoryItemsCache = nativeItems;
        await localforage.setItem(STORAGE_KEYS.ITEMS, nativeItems);
        syncItemsToServerFile(nativeItems);
        return nativeItems;
      }
    }
  } catch (err) {
    console.warn('Error reading items from Capacitor Native Filesystem:', err);
  }

  // 5. Fallback to initial default items
  memoryItemsCache = INITIAL_ITEMS;
  await saveItemsAsync(INITIAL_ITEMS);
  return INITIAL_ITEMS;
};

/**
 * Synchronous get items from memory cache or localStorage
 */
export const loadItems = (): Item[] => {
  if (memoryItemsCache && memoryItemsCache.length > 0) {
    return memoryItemsCache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryItemsCache = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  return INITIAL_ITEMS;
};

// Helper functions to send updates to Node/Termux server disk file storage (/data_store/)
const syncItemsToServerFile = (items: Item[]) => {
  fetch('/api/storage/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  }).catch(() => {});
};

const syncSessionsToServerFile = (sessions: AuditSession[]) => {
  fetch('/api/storage/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions })
  }).catch(() => {});
};

const syncDraftToServerFile = (draft: AuditSession | null) => {
  fetch('/api/storage/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft })
  }).catch(() => {});
};

/**
 * Get info on server disk storage (/data_store/)
 */
export const getDiskStorageInfo = async () => {
  try {
    const res = await fetch('/api/storage/info');
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}
  return null;
};

/**
 * Async save items array to IndexedDB (localForage), localStorage, and Server Disk Storage
 */
export const saveItemsAsync = async (items: Item[]): Promise<void> => {
  memoryItemsCache = items;

  // 1. Save to Node/Termux server disk storage (/data_store/items.json)
  syncItemsToServerFile(items);

  try {
    // Save to IndexedDB (handles large datasets)
    await localforage.setItem(STORAGE_KEYS.ITEMS, items);
  } catch (err) {
    console.error('Error saving items to IndexedDB via localforage:', err);
  }

  try {
    // Mirror to localStorage only for smaller datasets (<1000) to keep UI thread fast with 45,000+ items
    if (items.length <= 1000) {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ITEMS);
    }
  } catch (_) {
    // QuotaExceeded error on localStorage is safely ignored as IndexedDB holds master copy
  }

  // Mirror to Capacitor Native Filesystem if available
  try {
    if (isFilesystemAvailable()) {
      await saveItemsToNativeFile(items);
    }
  } catch (err) {
    console.warn('Capacitor native filesystem save error:', err);
  }
};

/**
 * Save items (returns promise, updates memory synchronously)
 */
export const saveItems = (items: Item[]): Promise<void> => {
  return saveItemsAsync(items);
};

/**
 * Async load completed audit sessions
 */
export const loadAuditSessionsAsync = async (): Promise<AuditSession[]> => {
  // 1. Try loading directly from Node/Termux Server Disk File Storage (/data_store/sessions.json)
  try {
    const res = await fetch('/api/storage/all');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.sessions) && json.sessions.length > 0) {
        memorySessionsCache = json.sessions;
        try {
          await localforage.setItem(STORAGE_KEYS.AUDIT_SESSIONS, json.sessions);
          localStorage.setItem(STORAGE_KEYS.AUDIT_SESSIONS, JSON.stringify(json.sessions));
        } catch (_) {}
        return json.sessions;
      }
    }
  } catch (_) {}

  try {
    const stored = await localforage.getItem<AuditSession[]>(STORAGE_KEYS.AUDIT_SESSIONS);
    if (stored && Array.isArray(stored)) {
      memorySessionsCache = stored;
      try { localStorage.setItem(STORAGE_KEYS.AUDIT_SESSIONS, JSON.stringify(stored)); } catch (_) {}
      syncSessionsToServerFile(stored);
      return stored;
    }
  } catch (err) {
    console.warn('Error reading audit sessions from IndexedDB:', err);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_SESSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memorySessionsCache = parsed;
        await localforage.setItem(STORAGE_KEYS.AUDIT_SESSIONS, parsed);
        syncSessionsToServerFile(parsed);
        return parsed;
      }
    }
  } catch (_) {}

  memorySessionsCache = [];
  return [];
};

export const loadAuditSessions = (): AuditSession[] => {
  if (memorySessionsCache) return memorySessionsCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_SESSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memorySessionsCache = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  return [];
};

/**
 * Async save audit sessions
 */
export const saveAuditSessionsAsync = async (sessions: AuditSession[]): Promise<void> => {
  memorySessionsCache = sessions;

  // Sync to Node/Termux server disk file storage (/data_store/sessions.json)
  syncSessionsToServerFile(sessions);

  try {
    await localforage.setItem(STORAGE_KEYS.AUDIT_SESSIONS, sessions);
  } catch (err) {
    console.error('Error saving audit sessions to IndexedDB:', err);
  }
  try {
    localStorage.setItem(STORAGE_KEYS.AUDIT_SESSIONS, JSON.stringify(sessions));
  } catch (_) {}

  // Mirror to Capacitor Native Filesystem if available
  try {
    if (isFilesystemAvailable()) {
      await saveSessionsToNativeFile(sessions);
    }
  } catch (err) {
    console.warn('Capacitor native filesystem save error:', err);
  }
};

export const saveAuditSessions = (sessions: AuditSession[]): Promise<void> => {
  return saveAuditSessionsAsync(sessions);
};

/**
 * Async load active draft audit session
 */
export const loadActiveAuditSessionAsync = async (): Promise<AuditSession | null> => {
  // 1. Try loading directly from Node/Termux Server Disk File Storage (/data_store/draft.json)
  try {
    const res = await fetch('/api/storage/all');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.draft && typeof json.draft === 'object' && json.draft.id) {
        memoryActiveDraftCache = json.draft;
        try {
          await localforage.setItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION, json.draft);
          localStorage.setItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION, JSON.stringify(json.draft));
        } catch (_) {}
        return json.draft;
      }
    }
  } catch (_) {}

  try {
    const stored = await localforage.getItem<AuditSession>(STORAGE_KEYS.ACTIVE_DRAFT_SESSION);
    if (stored && typeof stored === 'object' && stored.id) {
      memoryActiveDraftCache = stored;
      try { localStorage.setItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION, JSON.stringify(stored)); } catch (_) {}
      syncDraftToServerFile(stored);
      return stored;
    }
  } catch (err) {
    console.warn('Error reading active draft from IndexedDB:', err);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        memoryActiveDraftCache = parsed as AuditSession;
        await localforage.setItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION, parsed);
        syncDraftToServerFile(parsed as AuditSession);
        return parsed as AuditSession;
      }
    }
  } catch (_) {}

  return null;
};

export const loadActiveAuditSession = (): AuditSession | null => {
  if (memoryActiveDraftCache !== null) return memoryActiveDraftCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        memoryActiveDraftCache = parsed as AuditSession;
        return parsed as AuditSession;
      }
    }
  } catch (_) {}
  return null;
};

/**
 * Async save active draft session
 */
export const saveActiveAuditSessionAsync = async (session: AuditSession | null): Promise<void> => {
  memoryActiveDraftCache = session;

  // Sync to Node/Termux server disk file storage (/data_store/draft.json)
  syncDraftToServerFile(session);

  try {
    if (session) {
      await localforage.setItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION, session);
    } else {
      await localforage.removeItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION);
    }
  } catch (err) {
    console.error('Error saving active draft session to IndexedDB:', err);
  }

  try {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_DRAFT_SESSION);
    }
  } catch (_) {}
};

export const saveActiveAuditSession = (session: AuditSession | null): Promise<void> => {
  return saveActiveAuditSessionAsync(session);
};

/**
 * Reset data to default
 */
export const resetToDefaultData = async (): Promise<Item[]> => {
  await saveItemsAsync(INITIAL_ITEMS);
  return INITIAL_ITEMS;
};

/**
 * Export full offline backup
 */
export const exportFullOfflineBackup = async (): Promise<void> => {
  try {
    const items = await loadItemsAsync();
    const sessions = await loadAuditSessionsAsync();
    const activeDraft = await loadActiveAuditSessionAsync();

    const backupData = {
      app: 'OfflineInventorySystem',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      items,
      sessions,
      activeDraft
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_محلية_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error exporting backup:', err);
    alert('حدث خطأ أثناء تصدير النسخة الاحتياطية المحليه');
  }
};

/**
 * Import full offline backup from JSON file
 */
export const importFullOfflineBackup = (file: File): Promise<{ itemsCount: number; sessionsCount: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('ملف النسخة الاحتياطية غير صالح');
        }

        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];

        if (items.length > 0) {
          await saveItemsAsync(items);
        }
        if (sessions.length > 0) {
          await saveAuditSessionsAsync(sessions);
        }
        if (parsed.activeDraft) {
          await saveActiveAuditSessionAsync(parsed.activeDraft);
        }

        resolve({ itemsCount: items.length, sessionsCount: sessions.length });
      } catch (err) {
        reject(new Error('فشل قراءة ملف النسخة الاحتياطية. يرجى التأكد من اختيار ملف JSON صحيح.'));
      }
    };
    reader.onerror = () => reject(new Error('خطأ في قراءة الملف'));
    reader.readAsText(file);
  });
};


