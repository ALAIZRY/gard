import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Item, AuditSession } from '../types';

export const NATIVE_FILE_NAMES = {
  ITEMS: 'inventory_items_native_backup.json',
  AUDIT_SESSIONS: 'inventory_sessions_native_backup.json',
  FULL_BACKUP_PREFIX: 'inventory_full_backup_'
};

/**
 * Check if running inside Capacitor native app environment (Android / iOS)
 */
export const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
};

/**
 * Check whether Capacitor Filesystem plugin is available (only in native mobile apps)
 */
export const isFilesystemAvailable = (): boolean => {
  try {
    return isNativePlatform() && typeof Filesystem !== 'undefined' && !!Filesystem.writeFile;
  } catch (_) {
    return false;
  }
};

/**
 * Write a JSON string or object directly to native Android device file system
 */
export const writeNativeJsonFile = async (fileName: string, data: any): Promise<{ success: boolean; uri?: string; error?: string }> => {
  try {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    const result = await Filesystem.writeFile({
      path: fileName,
      data: jsonString,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });

    return { success: true, uri: result.uri };
  } catch (err: any) {
    console.warn(`[NativeFilesystem] Error writing native file ${fileName}:`, err);
    
    // Attempt fallback to Data directory if Documents directory requires extra permissions on some Android versions
    try {
      const fallbackResult = await Filesystem.writeFile({
        path: fileName,
        data: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true
      });
      return { success: true, uri: fallbackResult.uri };
    } catch (fallbackErr: any) {
      return { success: false, error: fallbackErr?.message || err?.message || 'فشل حفظ الملف في ذاكرة الجهاز' };
    }
  }
};

/**
 * Read and parse JSON content directly from native Android device file system
 */
export const readNativeJsonFile = async <T = any>(fileName: string): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    // Try reading from Documents first
    let fileResult;
    try {
      fileResult = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
    } catch (_) {
      // Fallback to Data directory
      fileResult = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
    }

    const content = typeof fileResult.data === 'string' ? fileResult.data : new TextDecoder().decode(fileResult.data as any);
    const parsed = JSON.parse(content) as T;
    return { success: true, data: parsed };
  } catch (err: any) {
    console.warn(`[NativeFilesystem] Error reading native file ${fileName}:`, err);
    return { success: false, error: err?.message || 'الملف غير موجود أو يتعذر قراءته' };
  }
};

/**
 * Save items array directly to native Android storage
 */
export const saveItemsToNativeFile = async (items: Item[]): Promise<boolean> => {
  if (!isFilesystemAvailable()) return false;
  const res = await writeNativeJsonFile(NATIVE_FILE_NAMES.ITEMS, {
    updatedAt: new Date().toISOString(),
    count: items.length,
    items
  });
  return res.success;
};

/**
 * Read items array directly from native Android storage
 */
export const readItemsFromNativeFile = async (): Promise<Item[] | null> => {
  if (!isFilesystemAvailable()) return null;
  const res = await readNativeJsonFile<{ items: Item[] }>(NATIVE_FILE_NAMES.ITEMS);
  if (res.success && res.data && Array.isArray(res.data.items)) {
    return res.data.items;
  }
  return null;
};

/**
 * Save audit sessions directly to native Android storage
 */
export const saveSessionsToNativeFile = async (sessions: AuditSession[]): Promise<boolean> => {
  if (!isFilesystemAvailable()) return false;
  const res = await writeNativeJsonFile(NATIVE_FILE_NAMES.AUDIT_SESSIONS, {
    updatedAt: new Date().toISOString(),
    count: sessions.length,
    sessions
  });
  return res.success;
};

/**
 * Read audit sessions directly from native Android storage
 */
export const readSessionsFromNativeFile = async (): Promise<AuditSession[] | null> => {
  if (!isFilesystemAvailable()) return null;
  const res = await readNativeJsonFile<{ sessions: AuditSession[] }>(NATIVE_FILE_NAMES.AUDIT_SESSIONS);
  if (res.success && res.data && Array.isArray(res.data.sessions)) {
    return res.data.sessions;
  }
  return null;
};

/**
 * Save full application backup directly to Android Documents folder
 */
export const exportFullBackupToNativeFile = async (
  items: Item[],
  sessions: AuditSession[],
  activeDraft: AuditSession | null
): Promise<{ success: boolean; fileName: string; uri?: string; error?: string }> => {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const fileName = `${NATIVE_FILE_NAMES.FULL_BACKUP_PREFIX}${dateStr}.json`;

  const backupData = {
    app: 'OfflineInventorySystem',
    platform: isNativePlatform() ? 'Android Native (Capacitor)' : 'Web',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    items,
    sessions,
    activeDraft
  };

  const res = await writeNativeJsonFile(fileName, backupData);
  return {
    success: res.success,
    fileName,
    uri: res.uri,
    error: res.error
  };
};

/**
 * List all backup files saved in native Android Documents folder
 */
export const listNativeBackupFiles = async (): Promise<string[]> => {
  if (!isFilesystemAvailable()) return [];
  try {
    const res = await Filesystem.readdir({
      path: '',
      directory: Directory.Documents
    });
    return res.files
      .map((f) => f.name)
      .filter((name) => name.endsWith('.json') || name.includes('inventory'));
  } catch (err) {
    console.warn('[NativeFilesystem] Could not list native directory:', err);
    return [];
  }
};
