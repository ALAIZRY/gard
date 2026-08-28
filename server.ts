import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { recognizeItemFromImage } from './src/server/geminiSearch.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dedicated application data directory on disk (e.g. for Termux / Node storage)
const DATA_DIR = path.join(process.cwd(), 'data_store');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data_store directory:', e);
  }
}

const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const DRAFT_FILE = path.join(DATA_DIR, 'draft.json');

// Helper to safely write JSON file
function safeWriteJson(filePath: string, data: any) {
  try {
    const tempFile = `${filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, filePath);
    return true;
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
    return false;
  }
}

// Helper to safely read JSON file
function safeReadJson(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return null;
  }
}

// --- FILE STORAGE API ENDPOINTS ---

// GET /api/storage/all - Load all application data from disk files
app.get('/api/storage/all', (req, res) => {
  try {
    const items = safeReadJson(ITEMS_FILE);
    const sessions = safeReadJson(SESSIONS_FILE);
    const draft = safeReadJson(DRAFT_FILE);
    res.json({
      success: true,
      dataDir: DATA_DIR,
      items: Array.isArray(items) ? items : null,
      sessions: Array.isArray(sessions) ? sessions : null,
      draft: draft || null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/storage/items - Save items catalog to items.json on disk
app.post('/api/storage/items', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'بيانات الأصناف غير صالحة' });
    }
    const saved = safeWriteJson(ITEMS_FILE, items);
    res.json({ success: saved, count: items.length, file: ITEMS_FILE });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/storage/sessions - Save completed sessions to sessions.json on disk
app.post('/api/storage/sessions', (req, res) => {
  try {
    const { sessions } = req.body;
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ success: false, error: 'بيانات الجلسات غير صالحة' });
    }
    const saved = safeWriteJson(SESSIONS_FILE, sessions);
    res.json({ success: saved, count: sessions.length, file: SESSIONS_FILE });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/storage/draft - Save active inventory draft session to draft.json on disk
app.post('/api/storage/draft', (req, res) => {
  try {
    const { draft } = req.body;
    const saved = safeWriteJson(DRAFT_FILE, draft || null);
    res.json({ success: saved, file: DRAFT_FILE });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/storage/info - Get status and paths of disk file storage
app.get('/api/storage/info', (req, res) => {
  try {
    const items = safeReadJson(ITEMS_FILE);
    const sessions = safeReadJson(SESSIONS_FILE);
    const draft = safeReadJson(DRAFT_FILE);
    res.json({
      success: true,
      storageType: 'Physical Disk File Storage (Termux / Node.js)',
      dataDirectory: DATA_DIR,
      files: {
        items: { path: ITEMS_FILE, exists: fs.existsSync(ITEMS_FILE), count: Array.isArray(items) ? items.length : 0 },
        sessions: { path: SESSIONS_FILE, exists: fs.existsSync(SESSIONS_FILE), count: Array.isArray(sessions) ? sessions.length : 0 },
        draft: { path: DRAFT_FILE, exists: fs.existsSync(DRAFT_FILE), hasActiveDraft: !!draft }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gemini API Image Recognition Route
app.post('/api/search-by-image', async (req, res) => {
  try {
    const { imageBase64, catalogList } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'لم يتم إرسال الصورة' });
    }
    const result = await recognizeItemFromImage(imageBase64, catalogList);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Gemini API search error:', error);
    res.status(500).json({ error: error.message || 'فشل التعرف على الصورة بالذكاء الاصطناعي' });
  }
});

// Serve static build in production with Service Worker headers
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Disk file storage active at: ${DATA_DIR}`);
});
