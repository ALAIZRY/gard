import React, { useState, useEffect, useTransition } from 'react';
import { Item, AuditSession } from './types';
import {
  Package,
  Search,
  ClipboardCheck,
  FileSpreadsheet,
  BarChart3,
  SlidersHorizontal
} from 'lucide-react';
import {
  loadItemsAsync,
  saveItemsAsync,
  loadAuditSessionsAsync,
  saveAuditSessionsAsync,
  loadActiveAuditSessionAsync,
  saveActiveAuditSessionAsync,
  resetToDefaultData
} from './utils/storage';
import { logMultiplePriceChanges } from './utils/priceHistory';
import { Header } from './components/Header';
import { ItemCatalog } from './components/ItemCatalog';
import { ItemInquiryView } from './components/ItemInquiryView';
import { SettingsView } from './components/SettingsView';
import { StockAudit } from './components/StockAudit';
import { AuditReports } from './components/AuditReports';
import { ReportHeaderSettingsModal } from './components/ReportHeader';
import { LoginModal } from './components/LoginModal';
import { hasUserPermission } from './utils/userUtils';

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [auditSessions, setAuditSessions] = useState<AuditSession[]>([]);

  // User Authentication State - Persistent during active session, requires re-login upon exiting app
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; permissions?: string[] } | null>(() => {
    try {
      const session = sessionStorage.getItem('rama_auth_session');
      if (session) return JSON.parse(session);
    } catch (e) {
      // ignore
    }
    return null;
  });

  const handleLoginSuccess = (username: string, role: string, permissions?: string[]) => {
    setCurrentUser({ username, role, permissions });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('rama_auth_session');
      sessionStorage.removeItem('rama_auth_session');
    } catch (e) {
      // ignore
    }
    setCurrentUser(null);
  };
  
  // Persistent tab state initialized from localStorage / URL hash
  const [activeTab, setActiveTabState] = useState<'catalog' | 'inquiry' | 'import' | 'audit' | 'reports'>(() => {
    try {
      const saved = localStorage.getItem('rama_pharmacy_active_tab');
      if (saved && ['catalog', 'inquiry', 'import', 'audit', 'reports'].includes(saved)) {
        return saved as any;
      }
      const hash = window.location.hash.replace('#', '');
      if (hash && ['catalog', 'inquiry', 'import', 'audit', 'reports'].includes(hash)) {
        return hash as any;
      }
    } catch (e) {
      // ignore
    }
    return 'catalog';
  });

  const [isPending, startTransition] = useTransition();

  // Visited Tabs Cache Set (keeps rendered tabs mounted in DOM for instant 0ms switching)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([activeTab]));

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const tabPermissionsMap: Record<string, string> = {
    catalog: 'view_catalog',
    inquiry: 'view_inquiry',
    audit: 'run_audit',
    reports: 'view_reports',
    import: 'manage_settings'
  };

  const setActiveTab = (tab: 'catalog' | 'inquiry' | 'import' | 'audit' | 'reports') => {
    const requiredPermission = tabPermissionsMap[tab];
    if (requiredPermission && currentUser && !hasUserPermission(currentUser, requiredPermission)) {
      alert(`عذراً، ليس لديك صلاحية الوصول لتبويب (${
        tab === 'catalog' ? 'الكتالوج والمخزون' :
        tab === 'inquiry' ? 'الاستعلام والباركود' :
        tab === 'audit' ? 'الجرد الميداني' :
        tab === 'reports' ? 'التقارير المالية' : 'الضبط والتهيئة'
      }). يرجى التواصل مع مدير النظام لمنحك الصلاحية المطلوب.`);
      return;
    }

    startTransition(() => {
      setActiveTabState(tab);
    });

    try {
      localStorage.setItem('rama_pharmacy_active_tab', tab);
    } catch (e) {
      // ignore
    }
    const targetUrl = `${window.location.pathname}${window.location.search}#${tab}`;
    if (window.location.hash !== `#${tab}`) {
      window.history.pushState({ tab }, '', targetUrl);
    }
  };

  const [isHeaderSettingsOpen, setIsHeaderSettingsOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  // Active uncommitted audit session
  const [activeAuditSession, setActiveAuditSession] = useState<AuditSession | null>(null);

  // Sync hash and handle browser/mobile back button (popstate)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rama_pharmacy_active_tab') || activeTab;
      const targetUrl = `${window.location.pathname}${window.location.search}#${saved}`;
      window.history.replaceState({ tab: saved }, '', targetUrl);
    } catch (e) {
      // ignore
    }

    const handlePopState = (e: PopStateEvent) => {
      // If a modal in child components processed popstate, don't change tab
      if ((window as any).__modalHandledPopState) {
        (window as any).__modalHandledPopState = false;
        return;
      }

      const validTabs = ['catalog', 'inquiry', 'import', 'audit', 'reports'];
      const hash = window.location.hash.replace('#', '');

      let targetTab: any = null;
      if (hash && validTabs.includes(hash)) {
        targetTab = hash;
      } else if (e.state && e.state.tab && validTabs.includes(e.state.tab)) {
        targetTab = e.state.tab;
      }

      if (targetTab) {
        setActiveTabState(targetTab);
        try {
          localStorage.setItem('rama_pharmacy_active_tab', targetTab);
        } catch (err) {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Prevent unintended global page reloads from forms, link clicks, or navigation events
  useEffect(() => {
    const handleGlobalSubmit = (e: Event) => {
      e.preventDefault();
    };

    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (target) {
        const href = target.getAttribute('href');
        if (!href || href === '#' || href === '' || href.startsWith('javascript:')) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('submit', handleGlobalSubmit, true);
    window.addEventListener('click', handleGlobalClick, true);

    return () => {
      window.removeEventListener('submit', handleGlobalSubmit, true);
      window.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  // Prevent mobile browser pull-to-refresh pull-down gesture
  useEffect(() => {
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touchY = e.touches[0].clientY;
        const touchDiff = touchY - touchStartY;
        // Block pull-down gesture when user is at the top of the page
        if (window.scrollY <= 0 && touchDiff > 0) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Prevent accidental reload or page navigation when active audit records exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeAuditSession?.records && activeAuditSession.records.length > 0) {
        e.preventDefault();
        e.returnValue = 'هناك سجلات جرد جارية وبيانات غير معتمدة. هل أنت تأكد من رغبتك في مغادرة أو إعادة تحميل الصفحة؟';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeAuditSession]);

  // Reload all data from local IndexedDB storage
  const reloadAllData = async () => {
    try {
      const loadedItemsList = await loadItemsAsync();
      setItems(loadedItemsList);

      const loadedSessionsList = await loadAuditSessionsAsync();
      setAuditSessions(loadedSessionsList);

      const draftSession = await loadActiveAuditSessionAsync();
      if (draftSession) {
        setActiveAuditSession(draftSession);
      } else {
        const newSession: AuditSession = {
          id: `audit-${Date.now()}`,
          title: `جرد مخزني - ${new Date().toLocaleDateString('ar-SA')}`,
          date: new Date().toISOString().split('T')[0],
          status: 'active',
          auditorName: 'مسؤول الجرد',
          records: []
        };
        setActiveAuditSession(newSession);
        await saveActiveAuditSessionAsync(newSession);
      }
    } catch (err) {
      console.error('Error reloading offline data:', err);
    }
  };

  // Initialize data from local storage on mount
  useEffect(() => {
    const initData = async () => {
      setIsInitialLoading(true);
      await reloadAllData();
      setIsInitialLoading(false);
    };
    initData();
  }, []);

  // Save items whenever state updates
  const handleUpdateItems = async (newItems: Item[]) => {
    setItems(newItems);
    await saveItemsAsync(newItems);
  };

  // Update active draft audit session and persist to local storage
  const handleUpdateActiveAuditSession = async (session: AuditSession) => {
    setActiveAuditSession(session);
    await saveActiveAuditSessionAsync(session);
  };

  // Add single item
  const handleAddItem = (item: Item) => {
    const updated = [item, ...items];
    handleUpdateItems(updated);
  };

  // Edit single item
  const handleUpdateSingleItem = (updatedItem: Item) => {
    const updated = items.map((i) => {
      if (i.id === updatedItem.id) {
        return updatedItem;
      }
      // If sibling item record shares the same item code, sync common info (name, foreign names, barcodes)
      if (
        i.code.trim().toLowerCase() === updatedItem.code.trim().toLowerCase() &&
        updatedItem.code.trim() !== ''
      ) {
        return {
          ...i,
          name: updatedItem.name,
          foreignName: updatedItem.foreignName,
          foreignNames: updatedItem.foreignNames,
          barcodes: updatedItem.barcodes,
          lastUpdated: new Date().toISOString()
        };
      }
      return i;
    });
    handleUpdateItems(updated);
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    handleUpdateItems(updated);
  };

  // Delete multiple items
  const handleDeleteMultipleItems = (ids: string[]) => {
    const set = new Set(ids);
    const updated = items.filter((i) => !set.has(i.id));
    handleUpdateItems(updated);
  };

  // Clear all items
  const handleClearAllItems = () => {
    handleUpdateItems([]);
  };

  // Batch percentage price adjustment
  const handleBatchPriceUpdate = (
    percent: number,
    priceType: 'initialCost' | 'price' | 'sellingPrice'
  ) => {
    const multiplier = 1 + percent / 100;
    const priceLogs: any[] = [];

    const updated = items.map((item) => {
      const currentVal = item[priceType] || 0;
      const newVal = Number((currentVal * multiplier).toFixed(2));

      if (currentVal !== newVal) {
        priceLogs.push({
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          oldInitialCost: item.initialCost || 0,
          newInitialCost: priceType === 'initialCost' ? newVal : (item.initialCost || 0),
          oldSellingPrice: item.sellingPrice || 0,
          newSellingPrice: priceType === 'sellingPrice' ? newVal : (item.sellingPrice || 0),
          changedBy: currentUser?.username || 'مسؤول',
          changeType: 'batch_percentage',
          reason: `تعديل جماعي بنسبة ${percent}% على ${
            priceType === 'sellingPrice' ? 'سعر البيع' : priceType === 'initialCost' ? 'التكلفة' : 'السعر'
          }`
        });
      }

      return {
        ...item,
        [priceType]: newVal,
        lastUpdated: new Date().toISOString()
      };
    });

    if (priceLogs.length > 0) {
      logMultiplePriceChanges(priceLogs);
    }

    handleUpdateItems(updated);
    alert(`تم تعديل أسعار كافة الأصناف بنسبة ${percent}% بنجاح!`);
  };

  // Import items from Excel file
  const handleExcelImport = (importedItems: Item[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      handleUpdateItems(importedItems);
    } else {
      // Append mode: merge new items, avoid duplicate codes
      const existingCodes = new Set(items.map((i) => i.code));
      const filteredNew = importedItems.filter((i) => !existingCodes.has(i.code));
      const combined = [...filteredNew, ...items];
      handleUpdateItems(combined);
    }
  };

  // Reset to default sample items
  const handleResetData = async () => {
    if (confirm('هل ترغب بإعادة تعيين البيانات وتحميل عينة الأصناف الافتراضية؟')) {
      const resetData = await resetToDefaultData();
      setItems(resetData);
    }
  };

  // Complete Audit Session
  const handleCompleteAuditSession = async (completedSession: AuditSession) => {
    const updatedSessions = [completedSession, ...auditSessions];
    setAuditSessions(updatedSessions);
    await saveAuditSessionsAsync(updatedSessions);

    // Create fresh draft session for next audit
    const nextSession: AuditSession = {
      id: `audit-${Date.now()}`,
      title: `جرد مخزني - ${new Date().toLocaleDateString('ar-SA')}`,
      date: new Date().toISOString().split('T')[0],
      status: 'active',
      auditorName: completedSession.auditorName || 'مسؤول الجرد',
      records: []
    };
    setActiveAuditSession(nextSession);
    await saveActiveAuditSessionAsync(nextSession);
  };

  // Delete audit session
  const handleDeleteAuditSession = async (sessionId: string) => {
    const updated = auditSessions.filter((s) => s.id !== sessionId);
    setAuditSessions(updated);
    await saveAuditSessionsAsync(updated);
  };

  // Update existing saved audit session
  const handleUpdateAuditSession = async (updatedSession: AuditSession) => {
    const updated = auditSessions.map((s) => (s.id === updatedSession.id ? updatedSession : s));
    setAuditSessions(updated);
    await saveAuditSessionsAsync(updated);
  };

  // Reopen a saved audit session into active audit draft tab
  const handleReopenAuditSession = async (sessionToReopen: AuditSession) => {
    setActiveAuditSession(sessionToReopen);
    await saveActiveAuditSessionAsync(sessionToReopen);
    setActiveTab('audit');
  };

  // Delete multiple audit sessions
  const handleDeleteMultipleSessions = async (sessionIds: string[]) => {
    const set = new Set(sessionIds);
    const updated = auditSessions.filter((s) => !set.has(s.id));
    setAuditSessions(updated);
    await saveAuditSessionsAsync(updated);
  };

  // Render Login Modal if not authenticated
  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Cairo',sans-serif]">
      
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        itemsCount={items.length}
        activeAuditCount={activeAuditSession?.records?.length || 0}
        onResetData={handleResetData}
        onOpenAddItem={() => setActiveTab('catalog')}
        onOpenHeaderSettings={() => setIsHeaderSettingsOpen(true)}
        onOpenUsersManagement={() => setActiveTab('import')}
        onDataReload={reloadAllData}
        items={items}
        auditSessions={auditSessions}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Container - Render Active Tab for Maximum Performance & Smoothness */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-1 sm:px-3 lg:px-4 py-1.5 sm:py-3 pb-16 md:pb-4">
        {activeTab === 'catalog' && (
          <ItemCatalog
            items={items}
            currentUser={currentUser}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateSingleItem}
            onDeleteItem={handleDeleteItem}
            onDeleteMultipleItems={handleDeleteMultipleItems}
            onClearAllItems={handleClearAllItems}
            onBatchPriceUpdate={handleBatchPriceUpdate}
            onNavigateToImport={() => setActiveTab('import')}
          />
        )}

        {activeTab === 'inquiry' && (
          <ItemInquiryView
            items={items}
            auditSessions={auditSessions}
            currentUser={currentUser}
            onUpdateItem={handleUpdateSingleItem}
            onEditItem={(itemToEdit) => {
              handleUpdateSingleItem(itemToEdit);
            }}
            onAddToAuditSession={(itemToAdd) => {
              setActiveTab('audit');
            }}
          />
        )}

        {activeTab === 'import' && (
          <SettingsView
            currentItemsCount={items.length}
            onImportItems={handleExcelImport}
            onResetToDefault={handleResetData}
            onNavigateToCatalog={() => setActiveTab('catalog')}
            allCurrentItems={items}
            auditSessions={auditSessions}
            onDataReload={reloadAllData}
            currentUsername={currentUser?.username}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'audit' && (
          <StockAudit
            items={items}
            activeSession={activeAuditSession}
            currentUser={currentUser}
            onUpdateActiveSession={handleUpdateActiveAuditSession}
            onCompleteSession={handleCompleteAuditSession}
            onNavigateToCatalog={() => setActiveTab('catalog')}
          />
        )}

        {activeTab === 'reports' && (
          <AuditReports
            sessions={auditSessions}
            catalogItems={items}
            currentUser={currentUser}
            onDeleteSession={handleDeleteAuditSession}
            onUpdateSession={handleUpdateAuditSession}
            onReopenSession={handleReopenAuditSession}
            onDeleteMultipleSessions={handleDeleteMultipleSessions}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="bg-slate-900 text-slate-400 py-1 mb-16 md:mb-0 border-t border-slate-800 text-[10px] text-center no-print print:hidden">
        <div className="max-w-7xl mx-auto px-3 flex flex-col sm:flex-row items-center justify-between gap-1 font-semibold">
          <p>© {new Date().getFullYear()} نظام إدارة وجرد الأصناف بدون نت (Offline First)</p>
          <div className="flex items-center gap-2 text-slate-500 text-[9px]">
            <span>تخزين محلي 100%</span>
            <span>•</span>
            <span>صيدلية راما</span>
          </div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Navigation Bar (Thumb Friendly) */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40 md:hidden no-print print:hidden shadow-lg pb-safe">
        <div className="grid grid-cols-5 h-14 max-w-md mx-auto px-1">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors py-1 ${
              activeTab === 'catalog'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[10px] font-bold whitespace-nowrap truncate max-w-[60px] leading-none">الكتالوج</span>
          </button>

          <button
            onClick={() => setActiveTab('inquiry')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors py-1 ${
              activeTab === 'inquiry'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[10px] font-bold whitespace-nowrap truncate max-w-[60px] leading-none">استعلام</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex flex-col items-center justify-center gap-1 relative transition-colors py-1 ${
              activeTab === 'audit'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <ClipboardCheck className="w-4.5 h-4.5 shrink-0" />
              {activeAuditSession && activeAuditSession.records && activeAuditSession.records.length > 0 && (
                <span className="absolute -top-1 -right-2.5 bg-emerald-500 text-slate-950 font-black text-[9px] min-w-[15px] h-3.5 px-1 rounded-full flex items-center justify-center border border-slate-900 shadow-xs">
                  {activeAuditSession.records.length > 99 ? '99+' : activeAuditSession.records.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold whitespace-nowrap truncate max-w-[60px] leading-none">الجرد</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors py-1 ${
              activeTab === 'reports'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[10px] font-bold whitespace-nowrap truncate max-w-[60px] leading-none">التقارير</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors py-1 ${
              activeTab === 'import'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[10px] font-bold whitespace-nowrap truncate max-w-[60px] leading-none">الضبط</span>
          </button>
        </div>
      </nav>

      {/* Global Report Header Customization Modal */}
      <ReportHeaderSettingsModal
        isOpen={isHeaderSettingsOpen}
        onClose={() => setIsHeaderSettingsOpen(false)}
        onSave={() => {}}
      />

    </div>
  );
}
