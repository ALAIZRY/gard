import localforage from 'localforage';
import { PriceChangeRecord } from '../types';

const PRICE_HISTORY_KEY = 'rama_price_history_log_v1';

let memoryPriceHistoryCache: PriceChangeRecord[] | null = null;

/**
 * Load all price history records asynchronously
 */
export const loadPriceHistoryAsync = async (): Promise<PriceChangeRecord[]> => {
  try {
    const stored = await localforage.getItem<PriceChangeRecord[]>(PRICE_HISTORY_KEY);
    if (stored && Array.isArray(stored)) {
      memoryPriceHistoryCache = stored;
      try { localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(stored)); } catch (_) {}
      return stored;
    }
  } catch (err) {
    console.warn('Error reading price history from IndexedDB:', err);
  }

  try {
    const raw = localStorage.getItem(PRICE_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryPriceHistoryCache = parsed;
        await localforage.setItem(PRICE_HISTORY_KEY, parsed);
        return parsed;
      }
    }
  } catch (_) {}

  memoryPriceHistoryCache = [];
  return [];
};

/**
 * Load price history synchronously from memory
 */
export const loadPriceHistory = (): PriceChangeRecord[] => {
  if (memoryPriceHistoryCache) return memoryPriceHistoryCache;
  try {
    const raw = localStorage.getItem(PRICE_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryPriceHistoryCache = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  return [];
};

/**
 * Save new price change log record
 */
export const logPriceChange = async (record: Omit<PriceChangeRecord, 'id' | 'timestamp'>): Promise<PriceChangeRecord> => {
  const fullRecord: PriceChangeRecord = {
    ...record,
    id: `pcl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString()
  };

  const currentHistory = await loadPriceHistoryAsync();
  const updatedHistory = [fullRecord, ...currentHistory];

  memoryPriceHistoryCache = updatedHistory;

  try {
    await localforage.setItem(PRICE_HISTORY_KEY, updatedHistory);
  } catch (err) {
    console.error('Error saving price history to IndexedDB:', err);
  }

  try {
    localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (_) {}

  return fullRecord;
};

/**
 * Log price changes for multiple items at once (e.g., batch price updates)
 */
export const logMultiplePriceChanges = async (
  records: Omit<PriceChangeRecord, 'id' | 'timestamp'>[]
): Promise<void> => {
  if (records.length === 0) return;

  const now = new Date().toISOString();
  const newFullRecords: PriceChangeRecord[] = records.map((r, idx) => ({
    ...r,
    id: `pcl-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: now
  }));

  const currentHistory = await loadPriceHistoryAsync();
  const updatedHistory = [...newFullRecords, ...currentHistory];

  memoryPriceHistoryCache = updatedHistory;

  try {
    await localforage.setItem(PRICE_HISTORY_KEY, updatedHistory);
  } catch (err) {
    console.error('Error saving batch price history to IndexedDB:', err);
  }

  try {
    localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (_) {}
};

/**
 * Clear all price history records
 */
export const clearPriceHistory = async (): Promise<void> => {
  memoryPriceHistoryCache = [];
  try {
    await localforage.removeItem(PRICE_HISTORY_KEY);
  } catch (_) {}
  try {
    localStorage.removeItem(PRICE_HISTORY_KEY);
  } catch (_) {}
};
