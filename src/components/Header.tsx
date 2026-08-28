import React, { useRef, useState, useEffect } from 'react';
import { Package, Search, FileSpreadsheet, ClipboardCheck, BarChart3, Plus, RefreshCw, Layers, Download, Upload, Code, Building2, ChevronDown, Wrench, User, LogOut, Wifi, WifiOff, HardDrive, ShieldCheck, SlidersHorizontal, Share2, Check, Key } from 'lucide-react';
import { exportFullOfflineBackup, importFullOfflineBackup } from '../utils/storage';
import { downloadStandaloneHTMLApp } from '../utils/htmlExport';
import { Item, AuditSession } from '../types';
import { hasUserPermission, getUserByUsername, ALL_PERMISSIONS } from '../utils/userUtils';

interface HeaderProps {
  activeTab: 'catalog' | 'inquiry' | 'import' | 'audit' | 'reports';
  setActiveTab: (tab: 'catalog' | 'inquiry' | 'import' | 'audit' | 'reports') => void;
  itemsCount: number;
  activeAuditCount: number;
  onResetData: () => void;
  onOpenAddItem: () => void;
  onOpenHeaderSettings?: () => void;
  onDataReload?: () => void;
  items: Item[];
  auditSessions: AuditSession[];
  currentUser?: { username: string; role: string; permissions?: string[] } | null;
  onLogout?: () => void;
  onOpenUsersManagement?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  itemsCount,
  activeAuditCount,
  onResetData,
  onOpenAddItem,
  onOpenHeaderSettings,
  onOpenUsersManagement,
  onDataReload,
  items,
  auditSessions,
  currentUser,
  onLogout
}) => {
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  // Network Status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await importFullOfflineBackup(file);
      alert(`تم استعادة النسخة الاحتياطية المحليه بنجاح!\nالأصناف: ${res.itemsCount}\nالجلسات: ${res.sessionsCount}`);
      if (onDataReload) {
        onDataReload();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء استيراد النسخة الاحتياطية.');
    } finally {
      if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
      setIsToolsOpen(false);
    }
  };

  const handleDownloadSingleHTML = () => {
    downloadStandaloneHTMLApp(items, auditSessions);
    setIsToolsOpen(false);
  };

  const handleShareApp = async () => {
    const shareUrl = window.location.origin + window.location.pathname;
    const shareData = {
      title: 'تطبيق إدارة وجرد الأصناف - صيدلية راما',
      text: 'تطبيق نظام إدارة وجرد الأصناف للجوال بدون نت مع المسح الضوئي للباركود والبحث بالذكاء الاصطناعي',
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('تم نسخ رابط مشاركة التطبيق بنجاح إلى الحافظة!\n\nالرابط: ' + shareUrl);
      } catch (err) {
        alert('رابط التطبيق لمشاركته:\n' + shareUrl);
      }
    }
  };

  return (
    <header className="bg-slate-900 text-white shadow-sm border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-3">
        <div className="flex items-center justify-between h-14 sm:h-15 gap-1.5">
          
          {/* Zone 1: Brand Title (Single text element) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-7.5 h-7.5 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xs shadow-xs shrink-0">
              <Layers className="w-4 h-4 text-slate-950" />
            </div>
            <span className="text-xs sm:text-sm font-black tracking-tight text-white whitespace-nowrap">
              صيدلية راما
            </span>
          </div>

          {/* Zone 2: Navigation Links (Desktop navigation - hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'catalog'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>الأصناف</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900/40 text-current">
                {itemsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('inquiry')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'inquiry'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>شاشة الاستعلام</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>نموذج الجرد</span>
              {activeAuditCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-400 text-slate-950 animate-pulse">
                  {activeAuditCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'reports'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>التقارير</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'import'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>الضبط والتهيئة</span>
            </button>
          </nav>

          {/* Zone 3: Primary Actions (1-2 actions) */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Offline & Storage Indicator Pill */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-800/90 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[11px] font-bold text-emerald-400 shrink-0 shadow-xs" title="النظام يدعم التخزين المحلي والعمل بدون إنترنت 100%">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>تخزين محلي أوفلاين</span>
              {isOnline ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="متصل بالشبكة"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" title="يعمل أوفلاين بدون نت"></span>
              )}
            </div>
            
            {/* User Profile Badge & Profile Data Popover */}
            {currentUser && (() => {
              const fullUser = getUserByUsername(currentUser.username);
              const userPermKeys = fullUser?.permissions || currentUser.permissions || [];
              const activePermObjects = ALL_PERMISSIONS.filter((p) => userPermKeys.includes(p.key));

              return (
                <div className="relative" ref={userDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 px-2 py-0.5 rounded-lg text-xs shrink-0 cursor-pointer transition active:scale-95 shadow-xs"
                    title="انقر لإظهار كافة بيانات حساب المستخدم والصلاحيات"
                  >
                    <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-[10px]">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col leading-none text-right hidden lg:flex">
                      <span className="font-bold text-slate-100 max-w-[90px] truncate">
                        {fullUser?.name || currentUser.username}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-semibold max-w-[90px] truncate">
                        {fullUser?.role || currentUser.role || 'مستخدم'}
                      </span>
                    </div>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {/* Profile Data Popover Card */}
                  {isProfileOpen && (
                    <div className="fixed sm:absolute top-14 sm:top-auto left-2 right-2 sm:left-0 sm:right-auto sm:w-80 max-w-sm sm:max-w-none mt-1 sm:mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                      {/* Header Avatar & Name */}
                      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                            <User className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div className="space-y-0.5 text-right">
                            <h4 className="font-black text-sm text-white">
                              {fullUser?.name || currentUser.username}
                            </h4>
                            <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              <span>الصفة: {fullUser?.role || currentUser.role || 'مستخدم النظام'}</span>
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 dir-ltr text-right">
                              @{currentUser.username}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Account Status Badge */}
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-bold">حالة الحساب:</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            نشط ومصرح له
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-400 font-bold">عدد الصلاحيات الممنوحة:</span>
                          <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {userPermKeys.length} من {ALL_PERMISSIONS.length}
                          </span>
                        </div>
                      </div>

                      {/* Permissions List */}
                      <div className="space-y-1.5 text-right">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-emerald-400" />
                          <span>الصلاحيات المفعلة لهذا المستخدم:</span>
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {activePermObjects.length === 0 ? (
                            <p className="text-slate-400 italic text-[11px]">لا توجد صلاحيات مسجلة</p>
                          ) : (
                            activePermObjects.map((perm) => (
                              <div
                                key={perm.key}
                                className="flex items-center justify-between p-1.5 bg-slate-800/50 rounded-lg text-[10px] border border-slate-700/50"
                              >
                                <span className="font-bold text-slate-200">{perm.label}</span>
                                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        {onOpenUsersManagement && hasUserPermission(currentUser, 'manage_users') && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenUsersManagement();
                              setIsProfileOpen(false);
                            }}
                            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition text-center cursor-pointer"
                          >
                            إدارة المستخدمين
                          </button>
                        )}

                        {onLogout && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileOpen(false);
                              onLogout();
                            }}
                            className="flex items-center justify-center gap-1 py-1.5 px-3 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold rounded-lg text-[11px] transition border border-rose-500/30 cursor-pointer"
                            title="تسجيل الخروج من الحساب"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>خروج</span>
                          </button>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })()}

            {/* Action 1: Share App Button */}
            <button
              onClick={handleShareApp}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
              title="مشاركة رابط التطبيق مع الآخرين"
            >
              <Share2 className="w-3.5 h-3.5 text-white" />
              <span>مشاركة التطبيق</span>
            </button>

            {/* Action 2: Add Item */}
            <button
              onClick={onOpenAddItem}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition shadow-xs whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">إضافة صنف</span>
            </button>

            {/* Action 2: Tools Menu Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition border border-slate-700 whitespace-nowrap shrink-0"
                title="أدوات الإعدادات والنسخ الاحتياطي"
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">أدوات والنظام</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isToolsOpen && (
                <div className="fixed sm:absolute top-14 sm:top-auto left-2 right-2 sm:left-0 sm:right-auto sm:w-64 max-w-sm sm:max-w-none mt-1 sm:mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-1.5 z-50 text-xs divide-y divide-slate-800">
                  {onOpenUsersManagement && (
                    <button
                      onClick={() => {
                        onOpenUsersManagement();
                        setIsToolsOpen(false);
                      }}
                      className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 font-bold flex items-center gap-2 transition"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>إدارة المستخدمين والصلاحيات</span>
                    </button>
                  )}

                  {onOpenHeaderSettings && (
                    <button
                      onClick={() => {
                        onOpenHeaderSettings();
                        setIsToolsOpen(false);
                      }}
                      className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-amber-300 font-bold flex items-center gap-2 transition"
                    >
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>بيانات الترويسة والمخزن</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsToolsOpen(false);
                      if (confirm('هل تريد تحديث التطبيق ومزامنة آخر التغييرات؟ سيتم إعادة تحميل الصفحة مع حفظ جميع بياناتك المحلية.')) {
                        window.location.reload();
                      }
                    }}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 font-bold flex items-center gap-2 transition"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span>تحديث ومزامنة التطبيق</span>
                  </button>

                  <button
                    onClick={() => {
                      handleShareApp();
                      setIsToolsOpen(false);
                    }}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-blue-300 font-bold flex items-center gap-2 transition"
                  >
                    <Share2 className="w-4 h-4 text-blue-400" />
                    <span>مشاركة رابط التطبيق</span>
                  </button>

                  <button
                    onClick={handleDownloadSingleHTML}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-teal-300 font-bold flex items-center gap-2 transition"
                  >
                    <Code className="w-4 h-4 text-teal-400" />
                    <span>تحميل ملف HTML المدمج</span>
                  </button>

                  <button
                    onClick={() => {
                      exportFullOfflineBackup();
                      setIsToolsOpen(false);
                    }}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 font-bold flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>تصدير نسخة احتياطية</span>
                  </button>

                  <button
                    onClick={() => {
                      jsonFileInputRef.current?.click();
                    }}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-blue-300 font-bold flex items-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>استعادة نسخة احتياطية</span>
                  </button>

                  <button
                    onClick={() => {
                      onResetData();
                      setIsToolsOpen(false);
                    }}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-rose-300 font-bold flex items-center gap-2 transition"
                  >
                    <RefreshCw className="w-4 h-4 text-rose-400" />
                    <span>إعادة تحميل الافتراضي</span>
                  </button>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={jsonFileInputRef}
              onChange={handleJsonFileChange}
              accept=".json"
              className="hidden"
            />
          </div>

        </div>
      </div>
    </header>
  );
};


