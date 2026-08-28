import { Item, AuditSession } from '../types';
import { INITIAL_ITEMS } from '../data/initialItems';

/**
 * Generates and downloads a 100% complete, feature-rich single-file HTML application (`index.html`)
 * containing all CSS (Tailwind), React 18, SheetJS, full Item Catalog, Stock Audit with Shelf/Column grouping,
 * Excel Import/Export, Price Adjustment, Expiry Warnings, and LocalStorage persistence.
 */
export const downloadStandaloneHTMLApp = (items: Item[], sessions: AuditSession[]) => {
  const dataset = items && items.length > 0 ? items : INITIAL_ITEMS;
  const serializedItems = JSON.stringify(dataset);
  const serializedSessions = JSON.stringify(sessions || []);

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>نظام إدارة وجرد الأصناف بدون نت (Single File HTML)</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- React 18 & ReactDOM UMD -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  
  <!-- Babel Standalone for JSX -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <!-- SheetJS / XLSX for Excel Import & Export -->
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  
  <!-- Cairo & Tajawal Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'Tajawal', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      direction: rtl;
      text-align: right;
    }
    /* Comprehensive Offline Fallback Helper Utilities */
    .bg-slate-900 { background-color: #0f172a !important; }
    .bg-slate-800 { background-color: #1e293b !important; }
    .bg-slate-50 { background-color: #f8fafc !important; }
    .bg-white { background-color: #ffffff !important; }
    .bg-emerald-500 { background-color: #10b981 !important; color: #022c22 !important; }
    .text-white { color: #ffffff !important; }
    .text-slate-900 { color: #0f172a !important; }
    .text-slate-400 { color: #94a3b8 !important; }
    .text-emerald-400 { color: #34d399 !important; }
    .border-slate-800 { border-color: #1e293b !important; }
    .border-slate-200 { border-color: #e2e8f0 !important; }
    .rounded-2xl { border-radius: 1rem !important; }
    .rounded-xl { border-radius: 0.75rem !important; }
    .rounded-lg { border-radius: 0.5rem !important; }
    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important; }
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .items-center { align-items: center !important; }
    .justify-between { justify-content: space-between !important; }
    .gap-2 { gap: 0.5rem !important; }
    .gap-3 { gap: 0.75rem !important; }
    .p-3 { padding: 0.75rem !important; }
    .p-4 { padding: 1rem !important; }
    .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
    .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
    .w-full { width: 100% !important; }
    .max-w-7xl { max-width: 80rem !important; margin-left: auto !important; margin-right: auto !important; }
    button, input, select { font-family: inherit; font-size: inherit; }
    button { cursor: pointer; border: none; }
    table { width: 100%; border-collapse: collapse; text-align: right; }
    th, td { padding: 0.6rem; border-bottom: 1px solid #e2e8f0; }
    th { background-color: #f1f5f9; font-weight: 700; color: #334155; }
    
    @media print {
      @page {
        size: A4;
        margin: 15mm 10mm;
      }
      html, body {
        direction: rtl !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .no-print {
        display: none !important;
      }
      .print-only {
        display: block !important;
      }
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        page-break-inside: auto !important;
      }
      thead {
        display: table-header-group !important;
      }
      tbody {
        display: table-row-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      th, td {
        border-color: #000000 !important;
        word-break: break-word !important;
      }
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo } = React;

    // Default Embedded Datasets
    const EMBEDDED_ITEMS = ${serializedItems};
    const EMBEDDED_SESSIONS = ${serializedSessions};

    const STORAGE_KEYS = {
      ITEMS: 'inventory_app_items_v4',
      SESSIONS: 'inventory_app_sessions_v4',
      ACTIVE_DRAFT: 'inventory_app_active_draft_v4'
    };

    // --- Local Storage Service ---
    function loadItems() {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch(e) {}
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(EMBEDDED_ITEMS));
      return EMBEDDED_ITEMS;
    }

    function saveItems(items) {
      try {
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
      } catch(e) {}
    }

    function loadSessions() {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch(e) {}
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(EMBEDDED_SESSIONS));
      return EMBEDDED_SESSIONS;
    }

    function saveSessions(sessions) {
      try {
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      } catch(e) {}
    }

    function loadActiveDraft() {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_DRAFT);
        if (saved) return JSON.parse(saved);
      } catch(e) {}
      return null;
    }

    function saveActiveDraft(draft) {
      try {
        if (draft) {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_DRAFT, JSON.stringify(draft));
        } else {
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_DRAFT);
        }
      } catch(e) {}
    }

    // --- MAIN APP CONTAINER ---
    function App() {
      const [items, setItems] = useState(loadItems);
      const [sessions, setSessions] = useState(loadSessions);
      const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'audit' | 'import' | 'reports'
      
      const [activeAuditSession, setActiveAuditSession] = useState(() => {
        const draft = loadActiveDraft();
        if (draft) return draft;
        return {
          id: 'audit-' + Date.now(),
          title: 'جرد مخزني - ' + new Date().toLocaleDateString('ar-SA'),
          date: new Date().toISOString().split('T')[0],
          status: 'active',
          auditorName: 'مسؤول الجرد',
          records: []
        };
      });

      const updateItemsState = (newItems) => {
        setItems(newItems);
        saveItems(newItems);
      };

      const updateSessionsState = (newSessions) => {
        setSessions(newSessions);
        saveSessions(newSessions);
      };

      const updateActiveAuditSessionState = (draft) => {
        setActiveAuditSession(draft);
        saveActiveDraft(draft);
      };

      // Reset data
      const handleResetData = () => {
        if (confirm('هل ترغب بإعادة تعيين كافة البيانات وتحميل العينة الافتراضية؟')) {
          updateItemsState(EMBEDDED_ITEMS);
          updateSessionsState([]);
          const freshDraft = {
            id: 'audit-' + Date.now(),
            title: 'جرد مخزني - ' + new Date().toLocaleDateString('ar-SA'),
            date: new Date().toISOString().split('T')[0],
            status: 'active',
            auditorName: 'مسؤول الجرد',
            records: []
          };
          updateActiveAuditSessionState(freshDraft);
          alert('تمت إعادة تعيين البيانات بنجاح!');
        }
      };

      // JSON Backup
      const jsonFileInputRef = useRef(null);
      const handleExportJSON = () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
          version: '4.0',
          exportDate: new Date().toISOString(),
          items,
          sessions,
          activeAuditSession
        }, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = 'backup_inventory_' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
      };

      const handleImportJSON = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (data && Array.isArray(data.items)) {
              updateItemsState(data.items);
              if (Array.isArray(data.sessions)) updateSessionsState(data.sessions);
              if (data.activeAuditSession) updateActiveAuditSessionState(data.activeAuditSession);
              alert('تم استعادة النسخة الاحتياطية بنجاح!');
            } else {
              alert('ملف النسخة الاحتياطية غير صالح');
            }
          } catch(err) {
            alert('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية');
          }
        };
        reader.readAsText(file);
      };

      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Cairo',sans-serif]">
          
          {/* Header */}
          <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-30 no-print">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black flex items-center justify-center text-xl shadow-md shrink-0">
                  📦
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black tracking-tight">نظام إدارة وجرد الأصناف بدون نت</h1>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Single File HTML
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">تطبيق محلي 100% يعمل مباشرة بدون إنترنت أو خوادم</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="flex flex-wrap items-center gap-1 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
                <button
                  onClick={() => setActiveTab('catalog')}
                  className={'px-3.5 py-1.5 rounded-xl font-bold text-xs transition ' + (activeTab === 'catalog' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white')}
                >
                  قاعدة الأصناف ({items.length})
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={'px-3.5 py-1.5 rounded-xl font-bold text-xs transition relative ' + (activeTab === 'audit' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white')}
                >
                  نموذج الجرد
                  {activeAuditSession?.records?.length > 0 && (
                    <span className="mr-1.5 bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full text-[10px]">
                      {activeAuditSession.records.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  className={'px-3.5 py-1.5 rounded-xl font-bold text-xs transition ' + (activeTab === 'import' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white')}
                >
                  إستيراد وتصدير إكسل
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={'px-3.5 py-1.5 rounded-xl font-bold text-xs transition ' + (activeTab === 'reports' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white')}
                >
                  التقارير وسجلات الجرد ({sessions.length})
                </button>
              </nav>

              {/* System Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJSON}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition"
                  title="تصدير نسخة احتياطية"
                >
                  💾 تصدير JSON
                </button>
                <button
                  onClick={() => jsonFileInputRef.current && jsonFileInputRef.current.click()}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition"
                  title="استعادة نسخة احتياطية"
                >
                  📂 استعادة JSON
                </button>
                <input
                  ref={jsonFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
                <button
                  onClick={handleResetData}
                  className="px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-300 rounded-xl text-xs font-bold border border-red-800/60 transition"
                  title="ضبط للبيانات الافتراضية"
                >
                  🔄 إعادة تعيين
                </button>
              </div>

            </div>
          </header>

          {/* Body Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 space-y-6">
            {activeTab === 'catalog' && (
              <ItemCatalogComponent
                items={items}
                onUpdateItems={updateItemsState}
                onNavigateToImport={() => setActiveTab('import')}
              />
            )}

            {activeTab === 'audit' && (
              <StockAuditComponent
                items={items}
                activeSession={activeAuditSession}
                onUpdateActiveSession={updateActiveAuditSessionState}
                onCompleteSession={(completed) => {
                  updateSessionsState([completed, ...sessions]);
                  const freshDraft = {
                    id: 'audit-' + Date.now(),
                    title: 'جرد مخزني - ' + new Date().toLocaleDateString('ar-SA'),
                    date: new Date().toISOString().split('T')[0],
                    status: 'active',
                    auditorName: completed.auditorName || 'مسؤول الجرد',
                    records: []
                  };
                  updateActiveAuditSessionState(freshDraft);
                  alert('تم اعتماد وحفظ جلسة الجرد بنجاح!');
                  setActiveTab('reports');
                }}
              />
            )}

            {activeTab === 'import' && (
              <ExcelImportComponent
                items={items}
                onUpdateItems={updateItemsState}
              />
            )}

            {activeTab === 'reports' && (
              <AuditReportsComponent
                sessions={sessions}
                onDeleteSession={(sessionId) => {
                  updateSessionsState(sessions.filter(s => s.id !== sessionId));
                }}
              />
            )}
          </main>

        </div>
      );
    }

    // ================= 1. ITEM CATALOG COMPONENT =================
    function ItemCatalogComponent({ items, onUpdateItems, onNavigateToImport }) {
      const [searchQuery, setSearchQuery] = useState('');
      const [sortBy, setSortBy] = useState('code');
      const [sortOrder, setSortOrder] = useState('asc');
      const [pageSize, setPageSize] = useState(50);
      const [currentPage, setCurrentPage] = useState(1);
      const [selectedIds, setSelectedIds] = useState([]);

      // Modal controls
      const [showAddModal, setShowAddModal] = useState(false);
      const [showBatchPriceModal, setShowBatchPriceModal] = useState(false);
      const [batchPercent, setBatchPercent] = useState(10);
      const [batchPriceType, setBatchPriceType] = useState('sellingPrice');

      const [inlineEditId, setInlineEditId] = useState(null);
      const [inlineEditData, setInlineEditData] = useState({});

      const [itemForm, setItemForm] = useState({
        code: '', name: '', foreignName: '', unit: 'حبة', barcode: '', pack: '1', initialCost: 0, sellingPrice: 0, expiryDate: '', batchNo: ''
      });

      // Filter & Sort
      const filteredItems = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let list = items;
        if (q) {
          list = items.filter(i => 
            (i.code && String(i.code).toLowerCase().includes(q)) ||
            (i.name && String(i.name).toLowerCase().includes(q)) ||
            (i.foreignName && String(i.foreignName).toLowerCase().includes(q)) ||
            (i.barcode && String(i.barcode).toLowerCase().includes(q)) ||
            (i.batchNo && String(i.batchNo).toLowerCase().includes(q))
          );
        }
        return [...list].sort((a, b) => {
          let valA = a[sortBy] ?? '';
          let valB = b[sortBy] ?? '';
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortOrder === 'asc' ? valA - valB : valB - valA;
          }
          return sortOrder === 'asc' ? String(valA).localeCompare(String(valB), 'ar') : String(valB).localeCompare(String(valA), 'ar');
        });
      }, [items, searchQuery, sortBy, sortOrder]);

      // Pagination
      const isAll = pageSize === -1;
      const totalPages = isAll ? 1 : Math.max(1, Math.ceil(filteredItems.length / pageSize));
      const safePage = isAll ? 1 : Math.min(Math.max(1, currentPage), totalPages);
      const displayedItems = isAll ? filteredItems : filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

      // Financial Metrics
      const totalCostVal = items.reduce((sum, i) => sum + (i.initialCost || 0), 0);
      const totalSellingVal = items.reduce((sum, i) => sum + (i.sellingPrice || i.price || 0), 0);

      // Select Helpers
      const toggleSelectAll = () => {
        if (selectedIds.length === displayedItems.length) setSelectedIds([]);
        else setSelectedIds(displayedItems.map(i => i.id));
      };

      const toggleSelectOne = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(x => x !== id));
        else setSelectedIds([...selectedIds, id]);
      };

      // Batch Price Adjustment
      const handleExecuteBatchPrice = () => {
        const multiplier = 1 + batchPercent / 100;
        const updated = items.map(item => {
          const currentVal = item[batchPriceType] || 0;
          return {
            ...item,
            [batchPriceType]: Number((currentVal * multiplier).toFixed(2)),
            lastUpdated: new Date().toISOString()
          };
        });
        onUpdateItems(updated);
        setShowBatchPriceModal(false);
        alert('تمت تعديل الأسعار بنسبة ' + batchPercent + '% بنجاح');
      };

      // Create Single Item
      const handleCreateItem = (e) => {
        e.preventDefault();
        if (!itemForm.code || !itemForm.name) {
          alert('يرجى كتابة رقم واسم الصنف');
          return;
        }
        const newItem = {
          id: 'item-' + Date.now(),
          code: itemForm.code,
          name: itemForm.name,
          foreignName: itemForm.foreignName,
          unit: itemForm.unit || 'حبة',
          barcode: itemForm.barcode || itemForm.code,
          pack: itemForm.pack || '1',
          initialCost: Number(itemForm.initialCost || 0),
          price: Number(itemForm.sellingPrice || 0),
          sellingPrice: Number(itemForm.sellingPrice || 0),
          expiryDate: itemForm.expiryDate,
          batchNo: itemForm.batchNo,
          lastUpdated: new Date().toISOString()
        };
        onUpdateItems([newItem, ...items]);
        setShowAddModal(false);
        setItemForm({ code: '', name: '', foreignName: '', unit: 'حبة', barcode: '', pack: '1', initialCost: 0, sellingPrice: 0, expiryDate: '', batchNo: '' });
      };

      // Export Catalog Excel
      const handleExportCatalogExcel = () => {
        if (typeof XLSX === 'undefined') {
          alert('مكتبة الإكسل غير متاحة');
          return;
        }
        const rows = filteredItems.map(i => ({
          'رقم الصنف': i.code,
          'اسم الصنف': i.name,
          'الاسم الأجنبي': i.foreignName || '',
          'الوحدة': i.unit || 'حبة',
          'الباركود': i.barcode || '',
          'التكلفة الأولية': i.initialCost || 0,
          'سعر البيع': i.sellingPrice || i.price || 0,
          'التشغيلة': i.batchNo || '',
          'تاريخ الانتهاء': i.expiryDate || ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'قاعدة الأصناف');
        XLSX.writeFile(workbook, 'قاعدة_الأصناف.xlsx');
      };

      return (
        <div className="space-y-4">
          
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">إجمالي الأصناف</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">{items.length} صنف</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-lg">📦</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">مجموع التكلفة الأولية</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">{totalCostVal.toFixed(2)} ر.س</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-lg">💰</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">مجموع سعر البيع</p>
                <h3 className="text-xl font-black text-emerald-600 mt-1">{totalSellingVal.toFixed(2)} ر.س</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 font-bold flex items-center justify-center text-lg">🏷️</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">الأصناف المفلترة</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">{filteredItems.length} صنف</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 font-bold flex items-center justify-center text-lg">🔍</div>
            </div>
          </div>

          {/* Search Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <input
                type="text"
                placeholder="ابحث برقم الصنف، الاسم، الباركود، أو رقم التشغيلة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full md:w-96 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                {items.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('هل أنت تأكد من مسح قاعدة الأصناف بالكامل؟')) onUpdateItems([]);
                    }}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200"
                  >
                    🗑️ مسح الكل
                  </button>
                )}
                <button
                  onClick={() => setShowBatchPriceModal(true)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200"
                >
                  💲 تعديل الأسعار جماعياً
                </button>
                <button
                  onClick={handleExportCatalogExcel}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200"
                >
                  📊 تصدير إكسل
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200"
                >
                  🖨️ طباعة
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm"
                >
                  + إضافة صنف جديد
                </button>
              </div>
            </div>

            {/* Sort & Pagination Options */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
              <div className="flex items-center gap-2">
                <span>ترتيب بـ:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800"
                >
                  <option value="code">رقم الصنف</option>
                  <option value="name">اسم الصنف</option>
                  <option value="initialCost">التكلفة</option>
                  <option value="sellingPrice">سعر البيع</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 bg-slate-100 rounded-lg"
                >
                  {sortOrder === 'asc' ? '⬆️ تصاعدي' : '⬇️ تنازلي'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span>عرض بالصفحة:</span>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800"
                >
                  <option value={25}>25 صنف</option>
                  <option value={50}>50 صنف</option>
                  <option value={100}>100 صنف</option>
                  <option value={-1}>عرض كافة الأصناف</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bulk Select Floating Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
              <span className="text-xs font-bold text-emerald-400">تم اختيار {selectedIds.length} صنف</span>
              <button
                onClick={() => {
                  if (confirm('تأكيد حذف الأصناف المحددة (' + selectedIds.length + ')?')) {
                    const set = new Set(selectedIds);
                    onUpdateItems(items.filter(i => !set.has(i.id)));
                    setSelectedIds([]);
                  }
                }}
                className="px-3 py-1 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-500"
              >
                حذف المحدد
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-3 text-center">
                      <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length > 0 && selectedIds.length === displayedItems.length} />
                    </th>
                    <th className="p-3">رقم الصنف</th>
                    <th className="p-3">اسم الصنف (عربي / أجنبي)</th>
                    <th className="p-3">الوحدة</th>
                    <th className="p-3">الباروكود</th>
                    <th className="p-3 text-center">التشغيلة</th>
                    <th className="p-3 text-center">الانتهاء</th>
                    <th className="p-3 text-center">التكلفة</th>
                    <th className="p-3 text-center">سعر البيع</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedItems.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-400 font-bold">لا توجد أصناف مطابقة لنتائج البحث</td>
                    </tr>
                  ) : (
                    displayedItems.map(item => {
                      const isEditing = inlineEditId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelectOne(item.id)}
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">{item.code}</td>
                          <td className="p-3 font-bold text-slate-800">
                            {item.name}
                            {item.foreignName && <span className="block text-[10px] text-slate-400 font-normal">{item.foreignName}</span>}
                          </td>
                          <td className="p-3 text-slate-700 font-medium">{item.unit || 'حبة'}</td>
                          <td className="p-3 font-mono text-slate-600">{item.barcode || '-'}</td>
                          <td className="p-3 text-center font-mono text-purple-700 font-bold">{item.batchNo || '-'}</td>
                          <td className="p-3 text-center font-mono text-rose-600 font-bold">{item.expiryDate || '-'}</td>
                          <td className="p-3 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                value={inlineEditData.initialCost ?? item.initialCost}
                                onChange={e => setInlineEditData({ ...inlineEditData, initialCost: Number(e.target.value) })}
                                className="w-16 p-1 border rounded font-bold text-center"
                              />
                            ) : (
                              <span className="font-bold text-slate-700">{Number(item.initialCost || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                value={inlineEditData.sellingPrice ?? item.sellingPrice}
                                onChange={e => setInlineEditData({ ...inlineEditData, sellingPrice: Number(e.target.value) })}
                                className="w-16 p-1 border rounded font-bold text-center"
                              />
                            ) : (
                              <span className="font-bold text-emerald-600">{Number(item.sellingPrice || item.price || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isEditing ? (
                              <button
                                onClick={() => {
                                  const updated = items.map(i => i.id === item.id ? { ...i, ...inlineEditData } : i);
                                  onUpdateItems(updated);
                                  setInlineEditId(null);
                                }}
                                className="px-2 py-1 bg-emerald-500 text-slate-950 font-bold rounded"
                              >
                                حفظ
                              </button>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setInlineEditId(item.id);
                                    setInlineEditData({ initialCost: item.initialCost, sellingPrice: item.sellingPrice || item.price });
                                  }}
                                  className="text-blue-600 font-bold hover:underline px-1"
                                >
                                  تعديل
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('حذف الصنف ' + item.name + '؟')) {
                                      onUpdateItems(items.filter(i => i.id !== item.id));
                                    }
                                  }}
                                  className="text-red-500 font-bold hover:underline px-1"
                                >
                                  حذف
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!isAll && totalPages > 1 && (
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                <span>صفحة {safePage} من {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={safePage === 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40"
                  >
                    السابقة
                  </button>
                  <button
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40"
                  >
                    التالية
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Add Item */}
          {showAddModal && (
            <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-base">إضافة صنف جديد لقاعدة البيانات</h3>
                  <button onClick={() => setShowAddModal(false)} className="font-bold text-slate-400">✕</button>
                </div>
                <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold block mb-1">رقم الصنف *</label>
                      <input required type="text" value={itemForm.code} onChange={e => setItemForm({...itemForm, code: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">الباروكود</label>
                      <input type="text" value={itemForm.barcode} onChange={e => setItemForm({...itemForm, barcode: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold block mb-1">اسم الصنف بالعربي *</label>
                    <input required type="text" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">الاسم الأجنبي</label>
                    <input type="text" value={itemForm.foreignName} onChange={e => setItemForm({...itemForm, foreignName: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold block mb-1">رقم التشغيلة (Batch)</label>
                      <input type="text" value={itemForm.batchNo} onChange={e => setItemForm({...itemForm, batchNo: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">تاريخ الانتهاء</label>
                      <input type="date" value={itemForm.expiryDate} onChange={e => setItemForm({...itemForm, expiryDate: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold block mb-1">الوحدة</label>
                      <input type="text" value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">التكلفة</label>
                      <input type="number" step="0.01" value={itemForm.initialCost} onChange={e => setItemForm({...itemForm, initialCost: Number(e.target.value)})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">سعر البيع</label>
                      <input type="number" step="0.01" value={itemForm.sellingPrice} onChange={e => setItemForm({...itemForm, sellingPrice: Number(e.target.value)})} className="w-full bg-slate-50 border p-2 rounded-xl font-bold" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">إلغاء</button>
                    <button type="submit" className="px-6 py-2 bg-emerald-500 text-slate-950 rounded-xl font-bold shadow-md">حفظ الصنف</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Batch Price */}
          {showBatchPriceModal && (
            <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-base">تعديل أسعار كافة الأصناف بنسبة مئوية</h3>
                  <button onClick={() => setShowBatchPriceModal(false)} className="font-bold text-slate-400">✕</button>
                </div>
                <div className="space-y-3 text-xs font-bold">
                  <div>
                    <label className="block mb-1">نوع السعر المراد تعديله:</label>
                    <select
                      value={batchPriceType}
                      onChange={e => setBatchPriceType(e.target.value)}
                      className="w-full p-2 border rounded-xl bg-slate-50 font-bold"
                    >
                      <option value="sellingPrice">سعر البيع للجمهور</option>
                      <option value="initialCost">التكلفة الأولية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">النسبة المئوية للتعديل (+ أو -):</label>
                    <input
                      type="number"
                      value={batchPercent}
                      onChange={e => setBatchPercent(Number(e.target.value))}
                      className="w-full p-2 border rounded-xl bg-slate-50 font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">مثال: 10 تعني زيادة 10%، و -5 تعني خصم 5%</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button onClick={() => setShowBatchPriceModal(false)} className="px-4 py-2 bg-slate-100 rounded-xl">إلغاء</button>
                    <button onClick={handleExecuteBatchPrice} className="px-6 py-2 bg-amber-500 text-slate-950 rounded-xl shadow-md">تطبيق النسبة</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      );
    }

    // ================= 2. STOCK AUDIT COMPONENT =================
    function StockAuditComponent({ items, activeSession, onUpdateActiveSession, onCompleteSession }) {
      const [searchTerm, setSearchTerm] = useState('');
      const [selectedItem, setSelectedItem] = useState(null);
      const [showDropdown, setShowDropdown] = useState(false);

      const [unit, setUnit] = useState('حبة');
      const [expiryDate, setExpiryDate] = useState('');
      const [columnNo, setColumnNo] = useState('1');
      const [auditedQty, setAuditedQty] = useState(1);
      const [auditorName, setAuditorName] = useState(activeSession?.auditorName || 'مسؤول الجرد');
      const [sessionTitle, setSessionTitle] = useState(activeSession?.title || 'جرد مخزني - ' + new Date().toLocaleDateString('ar-SA'));
      
      const [viewMode, setViewMode] = useState('all'); // 'all' | 'grouped'

      // Instant Item Search
      const searchResults = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return [];
        return items.filter(i => 
          (i.code && String(i.code).toLowerCase().includes(q)) ||
          (i.name && String(i.name).toLowerCase().includes(q)) ||
          (i.barcode && String(i.barcode).toLowerCase().includes(q))
        ).slice(0, 8);
      }, [items, searchTerm]);

      const handleSelectItem = (item) => {
        setSelectedItem(item);
        setUnit(item.unit || 'حبة');
        if (item.expiryDate) setExpiryDate(item.expiryDate);
        setSearchTerm(item.name + ' (' + item.code + ')');
        setShowDropdown(false);
      };

      const handleAddRecord = (e) => {
        e.preventDefault();
        if (!selectedItem) {
          alert('يرجى اختيار صنف صحيح من القائمة');
          return;
        }
        if (auditedQty <= 0) {
          alert('يرجى كتابة كمية أكبر من 0');
          return;
        }

        const cost = selectedItem.initialCost || 0;
        const sell = selectedItem.sellingPrice || selectedItem.price || 0;

        const newRec = {
          id: 'rec-' + Date.now(),
          auditSessionId: activeSession.id,
          itemId: selectedItem.id,
          itemCode: selectedItem.code,
          itemName: selectedItem.name,
          barcode: selectedItem.barcode || '',
          unit: unit || selectedItem.unit || 'حبة',
          columnNo: columnNo.trim() || '1',
          expiryDate: expiryDate.trim() || 'غير محدد',
          auditedQty: Number(auditedQty),
          initialCost: cost,
          sellingPrice: sell,
          totalCostValue: Number((auditedQty * cost).toFixed(2)),
          totalSellingValue: Number((auditedQty * sell).toFixed(2)),
          timestamp: new Date().toLocaleTimeString('ar-SA')
        };

        const updatedSession = {
          ...activeSession,
          title: sessionTitle,
          auditorName: auditorName,
          records: [newRec, ...activeSession.records]
        };

        onUpdateActiveSession(updatedSession);

        // Reset search
        setSelectedItem(null);
        setSearchTerm('');
        setAuditedQty(1);
      };

      // Grouping logic by shelf/column
      const columnsList = Array.from(new Set(activeSession.records.map(r => r.columnNo || '1'))).sort();

      return (
        <div className="space-y-6">
          
          {/* Header Metadata */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{sessionTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5">التاريخ: {activeSession.date} | عدد الأصناف المجرودة: {activeSession.records.length}</p>
              </div>
              <button
                onClick={() => {
                  if (activeSession.records.length === 0) {
                    alert('لا توجد أصناف بالجلسة لإتمام الجرد');
                    return;
                  }
                  onCompleteSession({ ...activeSession, title: sessionTitle, auditorName, status: 'completed' });
                }}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition"
              >
                ✓ إتمام الجلسة واعتماد الجرد
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">اسم الجلسة / المستند</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={e => setSessionTitle(e.target.value)}
                  className="w-full bg-slate-50 border p-2 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">مسؤول الجرد</label>
                <input
                  type="text"
                  value={auditorName}
                  onChange={e => setAuditorName(e.target.value)}
                  className="w-full bg-slate-50 border p-2 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">رقم الرف / العمود الافتراضي</label>
                <input
                  type="text"
                  value={columnNo}
                  onChange={e => setColumnNo(e.target.value)}
                  className="w-full bg-slate-50 border p-2 rounded-xl font-bold"
                />
              </div>
            </div>
          </div>

          {/* Audit Input Form */}
          <form onSubmit={handleAddRecord} className="bg-slate-900 text-white p-5 rounded-2xl shadow-md space-y-4">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">إدخال صنف لجلسة الجرد الحالية:</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              
              <div className="md:col-span-2 relative">
                <label className="font-bold text-slate-300 block mb-1">ابحث بالاسم أو امسح الباركود:</label>
                <input
                  type="text"
                  placeholder="اكتب رقم الصنف أو امسح الباركود..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-bold text-white focus:outline-none focus:border-emerald-400"
                />

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 divide-y divide-slate-700 max-h-48 overflow-y-auto">
                    {searchResults.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className="p-2.5 hover:bg-slate-700 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-emerald-300">{item.name}</p>
                          <p className="text-[10px] text-slate-400">رقم: {item.code} | باركود: {item.barcode || '-'}</p>
                        </div>
                        <span className="font-bold text-slate-300">{item.unit || 'حبة'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">الكمية المجرودة:</label>
                <input
                  type="number"
                  min="1"
                  value={auditedQty}
                  onChange={e => setAuditedQty(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">رقم الرف / العمود:</label>
                <input
                  type="text"
                  value={columnNo}
                  onChange={e => setColumnNo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

            </div>

            {selectedItem && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-300">{selectedItem.name}</span>
                  <span className="block text-[10px] text-slate-400">التكلفة: {selectedItem.initialCost} | البيع: {selectedItem.sellingPrice || selectedItem.price}</span>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-emerald-400 transition"
                >
                  + إضافة للجدول
                </button>
              </div>
            )}
          </form>

          {/* Audit Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">الأصناف المجرودة في الجلسة ({activeSession.records.length})</h3>
              
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setViewMode('all')}
                  className={'px-3 py-1 rounded-lg ' + (viewMode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600')}
                >
                  قائمة كاملة
                </button>
                <button
                  onClick={() => setViewMode('grouped')}
                  className={'px-3 py-1 rounded-lg ' + (viewMode === 'grouped' ? 'bg-slate-900 text-white' : 'text-slate-600')}
                >
                  تجميع بالأعمدة ({columnsList.length})
                </button>
              </div>
            </div>

            {viewMode === 'all' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-3">رقم الصنف</th>
                      <th className="p-3">اسم الصنف</th>
                      <th className="p-3 text-center">الرف / العمود</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3 text-center">إجمالي التكلفة</th>
                      <th className="p-3 text-center">إجمالي البيع</th>
                      <th className="p-3 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSession.records.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-400 font-bold">لم يتم تسجيل أي صنف في الجلسة بعد</td>
                      </tr>
                    ) : (
                      activeSession.records.map(rec => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-900">{rec.itemCode}</td>
                          <td className="p-3 font-bold text-slate-800">{rec.itemName}</td>
                          <td className="p-3 text-center font-mono text-purple-700 font-bold">{rec.columnNo || '-'}</td>
                          <td className="p-3 text-center font-mono font-bold text-sky-700">{rec.auditedQty}</td>
                          <td className="p-3 text-center font-bold text-slate-700">{rec.totalCostValue.toFixed(2)}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">{rec.totalSellingValue.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                const filtered = activeSession.records.filter(r => r.id !== rec.id);
                                onUpdateActiveSession({ ...activeSession, records: filtered });
                              }}
                              className="text-red-500 font-bold hover:text-red-700"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {columnsList.map(col => {
                  const colRecords = activeSession.records.filter(r => (r.columnNo || '1') === col);
                  return (
                    <div key={col} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <h4 className="font-bold text-xs text-slate-900 border-b pb-2">العمود / الرف: {col} ({colRecords.length} صنف)</h4>
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="text-slate-500 font-bold">
                            <th className="p-1">كود</th>
                            <th className="p-1">الاسم</th>
                            <th className="p-1 text-center">الكمية</th>
                          </tr>
                        </thead>
                        <tbody>
                          {colRecords.map(r => (
                            <tr key={r.id}>
                              <td className="p-1 font-mono">{r.itemCode}</td>
                              <td className="p-1 font-bold">{r.itemName}</td>
                              <td className="p-1 text-center font-bold text-sky-700">{r.auditedQty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      );
    }

    // ================= 3. EXCEL IMPORT & EXPORT COMPONENT =================
    function ExcelImportComponent({ items, onUpdateItems }) {
      const [parsedData, setParsedData] = useState([]);
      const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'
      const fileInputRef = useRef(null);

      const handleFileUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
          alert('مكتبة الإكسل غير متاحة');
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = new Uint8Array(ev.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            const formatted = json.map((row, idx) => {
              const code = row['رقم الصنف'] || row['Code'] || row['رمز الصنف'] || 'ITEM-' + (idx + 1);
              const name = row['اسم الصنف'] || row['Name'] || row['الاسم'] || 'صنف ' + (idx + 1);
              const foreignName = row['الاسم الأجنبي'] || row['Foreign Name'] || '';
              const unit = row['الوحدة'] || row['Unit'] || 'حبة';
              const barcode = row['الباركود'] || row['Barcode'] || code;
              const cost = Number(row['التكلفة'] || row['التكلفة الأولية'] || row['Cost'] || 0);
              const sell = Number(row['سعر البيع'] || row['البيع'] || row['Price'] || 0);
              const batchNo = row['التشغيلة'] || row['Batch'] || '';
              const expiryDate = row['تاريخ الانتهاء'] || row['Expiry'] || '';

              return {
                id: 'imp-' + Date.now() + '-' + idx,
                code: String(code),
                name: String(name),
                foreignName: String(foreignName),
                unit: String(unit),
                barcode: String(barcode),
                initialCost: cost,
                price: sell,
                sellingPrice: sell,
                batchNo: String(batchNo),
                expiryDate: String(expiryDate),
                lastUpdated: new Date().toISOString()
              };
            });

            setParsedData(formatted);
            alert('تم استيراد ومعالجة ' + formatted.length + ' صنف من ملف الإكسل');
          } catch(err) {
            alert('حدث خطأ أثناء قراءة ملف الإكسل');
          }
        };
        reader.readAsArrayBuffer(file);
      };

      const handleConfirmImport = () => {
        if (parsedData.length === 0) return;
        if (importMode === 'replace') {
          onUpdateItems(parsedData);
        } else {
          const existingCodes = new Set(items.map(i => String(i.code)));
          const uniqueNew = parsedData.filter(i => !existingCodes.has(String(i.code)));
          onUpdateItems([...uniqueNew, ...items]);
        }
        setParsedData([]);
        alert('تم حفظ الأصناف المستوردة في قاعدة البيانات بنجاح!');
      };

      // Download Template
      const handleDownloadSampleTemplate = () => {
        if (typeof XLSX === 'undefined') return;
        const templateData = [
          { 'رقم الصنف': '101', 'اسم الصنف': 'بندول اكسترا 24 قرص', 'الاسم الأجنبي': 'Panadol Extra', 'الوحدة': 'علبة', 'الباركود': '628100000001', 'التكلفة': 12.5, 'سعر البيع': 16.0, 'التشغيلة': 'BN-2026', 'تاريخ الانتهاء': '2026-12-31' },
          { 'رقم الصنف': '102', 'اسم الصنف': 'شامبو هيد اند شولدرز 400مل', 'الاسم الأجنبي': 'Head & Shoulders 400ml', 'الوحدة': 'حبة', 'الباركود': '628100000002', 'التكلفة': 18.0, 'سعر البيع': 24.5, 'التشغيلة': 'HS-889', 'تاريخ الانتهاء': '2027-05-15' }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نموذج_الأصناف');
        XLSX.writeFile(wb, 'نموذج_استيراد_الأصناف.xlsx');
      };

      return (
        <div className="space-y-6">
          
          {/* Header Description */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <h2 className="text-base font-bold text-slate-900">إستيراد وتصدير قاعدة الأصناف من ملفات إكسل (Excel / CSV)</h2>
            <p className="text-xs text-slate-500">يمكنك رفع ملف Excel جاهز أو تحميل نموذج تجريبي لإدخال بيانات أصنافك دفعة واحدة.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Upload Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">1. اختيار ملف الإكسل:</h3>
              
              <div
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 p-8 rounded-2xl text-center cursor-pointer transition space-y-2"
              >
                <div className="text-3xl">📁</div>
                <p className="font-bold text-xs text-slate-800">اضغط هنا لاختيار ملف إكسل من جهازك</p>
                <p className="text-[11px] text-slate-400">يدعم صيغ .xlsx و .xls و .csv</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="space-y-2 text-xs font-bold text-slate-700">
                <label className="block">طريقة الإستيراد:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                    />
                    <span>دمج مع الأصناف الحالية (تجاوز المكرر)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                    />
                    <span className="text-red-600">استبدال قاعدة الأصناف بالكامل</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Template Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">2. نموذج ملف الإكسل القياسي:</h3>
                <p className="text-xs text-slate-500 mt-1">
                  حمل الملف التجريبي المحتوي على العناوين الصحيحة (رقم الصنف، اسم الصنف، التكلفة، سعر البيع، الباركود...) لملئه بالبيانات الخاصة بك.
                </p>
              </div>

              <button
                onClick={handleDownloadSampleTemplate}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                📊 تحميل ملف Excel نموذج جاهز
              </button>
            </div>

          </div>

          {/* Preview Import Table */}
          {parsedData.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm text-slate-900">الأصناف المستخرجة جاهزة للإضافة ({parsedData.length} صنف)</h3>
                <button
                  onClick={handleConfirmImport}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                >
                  ✓ تأكيد حفظ الأصناف بقاعدة البيانات
                </button>
              </div>

              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">رقم الصنف</th>
                      <th className="p-2">الاسم</th>
                      <th className="p-2">الوحدة</th>
                      <th className="p-2 text-center">التكلفة</th>
                      <th className="p-2 text-center">سعر البيع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedData.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2 font-mono font-bold">{row.code}</td>
                        <td className="p-2 font-bold">{row.name}</td>
                        <td className="p-2">{row.unit}</td>
                        <td className="p-2 text-center">{row.initialCost}</td>
                        <td className="p-2 text-center text-emerald-600 font-bold">{row.sellingPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      );
    }

    // ================= 4. AUDIT REPORTS COMPONENT =================
    function AuditReportsComponent({ sessions, onDeleteSession }) {
      const [selectedSession, setSelectedSession] = useState(null);
      const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'expiry'

      // Expiry alerts calculation
      const expiringRecords = useMemo(() => {
        const today = new Date();
        const result = [];
        sessions.forEach(s => {
          s.records.forEach(r => {
            if (r.expiryDate && r.expiryDate !== 'غير محدد') {
              const exp = new Date(r.expiryDate);
              if (!isNaN(exp.getTime())) {
                const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (days <= 90) {
                  result.push({ sessionTitle: s.title, sessionDate: s.date, record: r, daysLeft: days });
                }
              }
            }
          });
        });
        return result.sort((a, b) => a.daysLeft - b.daysLeft);
      }, [sessions]);

      return (
        <div className="space-y-6">
          
          {/* Header Switcher */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2">
            <button
              onClick={() => setActiveTab('sessions')}
              className={'px-4 py-2 rounded-xl text-xs font-bold transition ' + (activeTab === 'sessions' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              سجلات الجلسات المكتملة ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('expiry')}
              className={'px-4 py-2 rounded-xl text-xs font-bold transition ' + (activeTab === 'expiry' ? 'bg-amber-500 text-slate-950' : 'text-slate-600 hover:bg-slate-100')}
            >
              تنبيهات تواريخ الانتهاء ({expiringRecords.length})
            </button>
          </div>

          {activeTab === 'sessions' ? (
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border text-slate-400 font-bold text-xs">
                  لا توجد جلسات جرد مؤرشفة بالسجلات حتى الآن
                </div>
              ) : (
                sessions.map(s => (
                  <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{s.title}</h3>
                        <p className="text-xs text-slate-500">التاريخ: {s.date} | مسؤول الجرد: {s.auditorName} | أصناف: {s.records.length}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedSession(s)}
                          className="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
                        >
                          👁️ معاينة وتفاصيل
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('تأكيد حذف جلسة الجرد ' + s.title + '؟')) onDeleteSession(s.id);
                          }}
                          className="px-3 py-1.5 bg-red-50 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100"
                        >
                          حذف
                        </button>
                      </div>
                    </div>

                    <div className="max-h-36 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold">
                          <tr>
                            <th className="p-2">كود الصنف</th>
                            <th className="p-2">اسم الصنف</th>
                            <th className="p-2 text-center">الكمية</th>
                            <th className="p-2 text-center">التكلفة الإجمالية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {s.records.slice(0, 5).map(r => (
                            <tr key={r.id}>
                              <td className="p-2 font-mono">{r.itemCode}</td>
                              <td className="p-2 font-bold">{r.itemName}</td>
                              <td className="p-2 text-center font-bold text-sky-700">{r.auditedQty}</td>
                              <td className="p-2 text-center font-bold">{r.totalCostValue.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900">الأصناف التي تنتهي صلاحيتها قريباً (خلال 90 يوم)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-amber-50 text-amber-900 font-bold">
                    <tr>
                      <th className="p-2.5">جلسة الجرد</th>
                      <th className="p-2.5">كود الصنف</th>
                      <th className="p-2.5">اسم الصنف</th>
                      <th className="p-2.5 text-center">تاريخ الانتهاء</th>
                      <th className="p-2.5 text-center">الأيام المتبقية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiringRecords.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-6 text-center text-slate-400 font-bold">لا توجد تنبيهات لتواريخ الانتهاء</td>
                      </tr>
                    ) : (
                      expiringRecords.map((item, idx) => (
                        <tr key={idx} className={item.daysLeft <= 0 ? 'bg-red-50 text-red-900 font-bold' : ''}>
                          <td className="p-2.5">{item.sessionTitle}</td>
                          <td className="p-2.5 font-mono">{item.record.itemCode}</td>
                          <td className="p-2.5 font-bold">{item.record.itemName}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{item.record.expiryDate}</td>
                          <td className="p-2.5 text-center font-bold">{item.daysLeft <= 0 ? 'منتهي الصلاحية' : item.daysLeft + ' يوم'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Session Detail Modal */}
          {selectedSession && (
            <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-bold text-base">{selectedSession.title}</h3>
                    <p className="text-xs text-slate-500">التاريخ: {selectedSession.date} | القائم بالجرد: {selectedSession.auditorName}</p>
                  </div>
                  <button onClick={() => setSelectedSession(null)} className="font-bold text-slate-400">✕</button>
                </div>

                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">كود الصنف</th>
                      <th className="p-2">اسم الصنف</th>
                      <th className="p-2 text-center">العمود</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2 text-center">إجمالي التكلفة</th>
                      <th className="p-2 text-center">إجمالي البيع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSession.records.map(r => (
                      <tr key={r.id}>
                        <td className="p-2 font-mono font-bold">{r.itemCode}</td>
                        <td className="p-2 font-bold">{r.itemName}</td>
                        <td className="p-2 text-center font-mono">{r.columnNo || '-'}</td>
                        <td className="p-2 text-center font-bold text-sky-700">{r.auditedQty}</td>
                        <td className="p-2 text-center font-bold">{r.totalCostValue.toFixed(2)}</td>
                        <td className="p-2 text-center font-bold text-emerald-600">{r.totalSellingValue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-between items-center pt-3 border-t">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-xs"
                  >
                    🖨️ طباعة المستند
                  </button>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      );
    }

    // Mount App
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `index.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
