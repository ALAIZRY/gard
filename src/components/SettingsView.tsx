import React, { useState, useRef, useEffect } from 'react';
import { Item, AuditSession } from '../types';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowRight,
  Settings,
  Building2,
  Phone,
  MapPin,
  Warehouse,
  HardDrive,
  Code,
  Image as ImageIcon,
  Save,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  FileText,
  Share2
} from 'lucide-react';
import { parseExcelFile, downloadSampleTemplate, exportItemsToExcel } from '../utils/excelUtils';
import { downloadStandaloneHTMLApp } from '../utils/htmlExport';
import { exportFullOfflineBackup, importFullOfflineBackup, saveItemsAsync, saveAuditSessionsAsync, getDiskStorageInfo } from '../utils/storage';
import {
  isFilesystemAvailable,
  isNativePlatform,
  exportFullBackupToNativeFile,
  readItemsFromNativeFile,
  readSessionsFromNativeFile,
  listNativeBackupFiles
} from '../utils/nativeFilesystem';
import {
  getReportHeaderSettings,
  saveReportHeaderSettings,
  ReportHeaderSettings,
  DEFAULT_HEADER_SETTINGS
} from './ReportHeader';

import { UsersManagementView } from './UsersManagementView';

interface SettingsViewProps {
  currentItemsCount: number;
  onImportItems: (newItems: Item[], mode: 'replace' | 'append') => void;
  onResetToDefault: () => void;
  onNavigateToCatalog: () => void;
  allCurrentItems: Item[];
  auditSessions?: AuditSession[];
  onDataReload?: () => void;
  initialSubTab?: 'import' | 'header' | 'backup' | 'users';
  currentUsername?: string;
  currentUser?: { username: string; role?: string; permissions?: string[] } | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentItemsCount,
  onImportItems,
  onResetToDefault,
  onNavigateToCatalog,
  allCurrentItems,
  auditSessions = [],
  onDataReload,
  initialSubTab = 'import',
  currentUsername,
  currentUser
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'import' | 'header' | 'backup' | 'users'>(initialSubTab);

  // Excel Import States
  const [file, setFile] = useState<File | null>(null);
  const [previewItems, setPreviewItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Backup file input ref
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Header & Store Settings State
  const [headerConfig, setHeaderConfig] = useState<ReportHeaderSettings>(getReportHeaderSettings());
  const [headerSavedToast, setHeaderSavedToast] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Native Filesystem States
  const [nativeStatusMsg, setNativeStatusMsg] = useState<string | null>(null);
  const [nativeFileList, setNativeFileList] = useState<string[]>([]);
  const [diskStorageInfo, setDiskStorageInfo] = useState<any>(null);

  useEffect(() => {
    setHeaderConfig(getReportHeaderSettings());
    if (isFilesystemAvailable()) {
      listNativeBackupFiles().then(setNativeFileList).catch(() => {});
    }
    getDiskStorageInfo().then(info => {
      if (info && info.success) {
        setDiskStorageInfo(info);
      }
    }).catch(() => {});
  }, []);

  // Handle Capacitor Filesystem Native Save
  const handleSaveToNativeFileSystem = async () => {
    setNativeStatusMsg('جاري تحفيظ البيانات في ملفات الجهاز الداخلية (Native Filesystem)...');
    try {
      const result = await exportFullBackupToNativeFile(allCurrentItems, auditSessions, null);
      if (result.success) {
        setNativeStatusMsg(`✓ تم تحفيظ الملف بنجاح داخل ذاكرة أندرويد المستندات:\n${result.fileName}`);
        const files = await listNativeBackupFiles();
        setNativeFileList(files);
      } else {
        setNativeStatusMsg(`❌ فشل التحفيظ: ${result.error || 'خطأ غير معروف'}`);
      }
    } catch (err: any) {
      setNativeStatusMsg(`❌ حدث خطأ: ${err?.message || err}`);
    }
  };

  // Handle Capacitor Filesystem Native Read
  const handleReadFromNativeFileSystem = async () => {
    setNativeStatusMsg('جاري قراءة واستعادة البيانات من ملفات أندرويد الداخلية...');
    try {
      const items = await readItemsFromNativeFile();
      const sessions = await readSessionsFromNativeFile();

      if ((items && items.length > 0) || (sessions && sessions.length > 0)) {
        if (items && items.length > 0) {
          await saveItemsAsync(items);
        }
        if (sessions && sessions.length > 0) {
          await saveAuditSessionsAsync(sessions);
        }
        setNativeStatusMsg(`✓ تم قراءة واستعادة البيانات بنجاح!\nالأصناف: ${items?.length || 0} - الجلسات: ${sessions?.length || 0}`);
        if (onDataReload) {
          onDataReload();
        } else {
          window.location.reload();
        }
      } else {
        setNativeStatusMsg('⚠️ لم يتم العثور على ملفات أصناف أو جلسات سابقة في مجلد المستندات الخاص بالذاكرة الداخلية.');
      }
    } catch (err: any) {
      setNativeStatusMsg(`❌ فشل قراءة الملفات: ${err?.message || err}`);
    }
  };

  // Excel File Processing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const parsed = await parseExcelFile(selectedFile);
      if (parsed.length === 0) {
        setError('الملف فارغ أو لا يحتوي على أعمدة صحيحة.');
        setPreviewItems([]);
      } else {
        setPreviewItems(parsed);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء معالجة ملف الإكسل');
      setPreviewItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (previewItems.length === 0) return;
    onImportItems(previewItems, importMode);
    setSuccessMessage(`تم إستيراد ${previewItems.length} صنف بنجاح في قاعدة البيانات!`);
    setPreviewItems([]);
    setFile(null);
  };

  // Header settings handlers
  const handleSaveHeaderConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveReportHeaderSettings(headerConfig);
    setHeaderSavedToast(true);
    setTimeout(() => setHeaderSavedToast(false), 3000);
  };

  const handleResetHeaderConfig = () => {
    if (confirm('هل تريد إعادة تعيين بيانات الترويسة والمخزن إلى الافتراضية؟')) {
      setHeaderConfig(DEFAULT_HEADER_SETTINGS);
      saveReportHeaderSettings(DEFAULT_HEADER_SETTINGS);
      setHeaderSavedToast(true);
      setTimeout(() => setHeaderSavedToast(false), 3000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;

    if (imgFile.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setHeaderConfig((prev) => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(imgFile);
  };

  const handleBranchChange = (index: number, value: string) => {
    const updated = [...headerConfig.branches];
    updated[index] = value;
    setHeaderConfig((prev) => ({ ...prev, branches: updated }));
  };

  const handleAddBranch = () => {
    setHeaderConfig((prev) => ({ ...prev, branches: [...prev.branches, ''] }));
  };

  const handleRemoveBranch = (index: number) => {
    setHeaderConfig((prev) => ({
      ...prev,
      branches: prev.branches.filter((_, i) => i !== index)
    }));
  };

  // JSON Backup File Handler
  const handleJsonBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      const res = await importFullOfflineBackup(selectedFile);
      alert(`تم استعادة النسخة الاحتياطية بنجاح!\nالأصناف: ${res.itemsCount}\nجلسات الجرد: ${res.sessionsCount}`);
      if (onDataReload) {
        onDataReload();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء استعادة النسخة الاحتياطية.');
    } finally {
      if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
    }
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
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      
      {/* Share App Quick Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-slate-900 to-indigo-900/40 border border-blue-500/30 rounded-2xl p-3 sm:p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black shrink-0 border border-blue-500/30">
            <Share2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-black text-xs sm:text-sm text-white">مشاركة التطبيق مع زملاء العمل والمستخدمين</h3>
            <p className="text-[11px] text-slate-300">أرسل رابط التطبيق مباشرة ليتمكنوا من فتحه وتثبيته على جوالاتهم بضغطة زر واحدة</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleShareApp}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
        >
          <Share2 className="w-4 h-4 text-white" />
          <span>مشاركة رابط التطبيق الآن</span>
        </button>
      </div>
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg border border-emerald-500/30 shrink-0">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              الضبط والتهيئة وإدارة النظام
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                إعدادات شاملة
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              استيراد وتصدير إكسل، تهيئة بيانات المخزن والترويسة، والنسخ الاحتياطي المحتفظ به محلياً
            </p>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('import')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeSubTab === 'import'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>استيراد وتصدير الأصناف</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('header')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeSubTab === 'header'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>بيانات الترويسة والمخزن</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeSubTab === 'users'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>المستخدمين والصلاحيات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('backup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeSubTab === 'backup'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>النسخ الاحتياطي والنظام</span>
          </button>
        </div>
      </div>

      {/* SUB TAB 1: Excel Import & Export */}
      {activeSubTab === 'import' && (
        <div className="space-y-4">
          
          {/* Action Toolbar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">استيراد وتصدير قاعدة بيانات الأصناف</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  تحميل وقراءة ملفات الإكسل (.xlsx, .xls, .csv) المباشرة للربط والأسعار والتكاليف
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadSampleTemplate('batch_db')}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                title="تحميل نموذج بتنسيق التشغيلة وتاريخ الانتهاء والأصناف"
              >
                <Download className="w-3.5 h-3.5" />
                <span>نموذج قاعدة البيانات (التشغيلة والانتهاء)</span>
              </button>

              <button
                onClick={() => downloadSampleTemplate('standard')}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>النموذج القياسي</span>
              </button>

              <button
                onClick={() => exportItemsToExcel(allCurrentItems)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>تصدير البيانات الحالية ({currentItemsCount})</span>
              </button>
            </div>
          </div>

          {/* Success Notification */}
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-emerald-900">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span className="font-bold text-sm">{successMessage}</span>
              </div>
              <button
                onClick={onNavigateToCatalog}
                className="flex items-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <span>الانتقال لقائمة الأصناف</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          )}

          {/* Supported Columns Schema Guide */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              الصيغ والأعمدة المدعومة للإستيراد والتطابق التلقائي:
            </h4>
            
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-emerald-300">1. صيغة قاعدة البيانات (التشغيلة، تاريخ الانتهاء، الكمية، والأسعار):</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 text-xs font-semibold text-slate-300">
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center text-emerald-300">رقم الصنف</span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center text-emerald-300">اسم الصنف</span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center text-amber-300">الوح\ة (الوحدة)</span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center">سعر البيع</span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center">التكلفة</span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center text-sky-300">الكمية</span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center text-rose-300">تاريخ الانتهاء</span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-center text-purple-300">التشغيلة</span>
              </div>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-800">
              <p className="text-[11px] font-bold text-slate-400">2. الصيغة القياسية (بالباروكود والاسم الأجنبي والتكلفة الأولية):</p>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                <span className="bg-slate-800/80 px-2 py-0.5 rounded">رقم الصنف</span>
                <span className="bg-slate-800/80 px-2 py-0.5 rounded">اسم الصنف</span>
                <span className="bg-slate-800/80 px-2 py-0.5 rounded">الاسم الأجنبي</span>
                <span className="bg-slate-800/80 px-2 py-0.5 rounded">الوحدة</span>
                <span className="bg-slate-800/80 px-2 py-0.5 rounded">رقم الباركود</span>
                <span className="bg-slate-800/80 px-2 py-0.5 rounded">سعر البيع</span>
              </div>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="bg-white border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 sm:p-8 text-center transition-all bg-gradient-to-b from-slate-50/50 to-white relative group"
          >
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-7 h-7" />
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              اسحب وأسقط ملف الإكسل هنا، أو اضغط لاختيار ملف من جهازك
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              يدعم كافة صيغ Excel (.xlsx, .xls) وملفات CSV
            </p>

            {file && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-300">
                <FileSpreadsheet className="w-4 h-4" />
                <span>الملف المختار: {file.name}</span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-3 text-sm font-bold">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2">
              <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin mx-auto" />
              <p className="text-xs sm:text-sm font-bold text-slate-700">جاري تحليل ملف الإكسل واستخراج الأصناف...</p>
            </div>
          )}

          {/* Preview Table & Confirmation */}
          {previewItems.length > 0 && !loading && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden space-y-4 p-5">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    معاينة الأصناف المستخرجة ({previewItems.length} صنف)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تأكد من صحة الأعمدة والبيانات قبل الاعتماد والحفظ
                  </p>
                </div>

                {/* Import Mode selection */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1 rounded-lg transition ${
                      importMode === 'replace'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    استبدال كافة البيانات
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`px-3 py-1 rounded-lg transition ${
                      importMode === 'append'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    دمج وإضافة للبيانات
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">رقم الصنف</th>
                      <th className="py-2 px-3">اسم الصنف</th>
                      <th className="py-2 px-3">الوحدة</th>
                      <th className="py-2 px-3 text-center">التشغيلة</th>
                      <th className="py-2 px-3 text-center">تاريخ الانتهاء</th>
                      <th className="py-2 px-3 text-center">الكمية</th>
                      <th className="py-2 px-3 text-center">التكلفة</th>
                      <th className="py-2 px-3 text-center">سعر البيع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.slice(0, 50).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{item.code}</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">{item.name}</td>
                        <td className="py-1.5 px-3 text-slate-600">{item.unit}</td>
                        <td className="py-1.5 px-3 text-center font-mono text-purple-700 font-bold">{item.batchNo || '-'}</td>
                        <td className="py-1.5 px-3 text-center font-mono text-rose-600 font-bold">{item.expiryDate || '-'}</td>
                        <td className="py-1.5 px-3 text-center font-mono text-sky-700 font-bold">{item.currentStock ?? item.quantity ?? 0}</td>
                        <td className="py-1.5 px-3 text-center font-bold text-slate-700">{item.initialCost.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-center font-bold text-emerald-600">{item.sellingPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    setPreviewItems([]);
                    setFile(null);
                  }}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-lg"
                >
                  إلغاء المعاينة
                </button>

                <button
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد إستيراد {previewItems.length} صنف</span>
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* SUB TAB 2: Store & Header Settings */}
      {activeSubTab === 'header' && (
        <form onSubmit={handleSaveHeaderConfig} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-5">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">إعدادات بيانات الترويسة والمخزن والصيدلية</h2>
                <p className="text-xs text-slate-500">
                  تظهر هذه البيانات في أعلى التقارير المطبوعة وكشوفات الجرد المخزني
                </p>
              </div>
            </div>

            {headerSavedToast && (
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-1 rounded-lg animate-pulse">
                ✓ تم حفظ التغييرات بنجاح
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Arabic Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الصيدلية / المؤسسة (بالعربية)
              </label>
              <input
                type="text"
                value={headerConfig.arabicName}
                onChange={(e) => setHeaderConfig({ ...headerConfig, arabicName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            {/* English Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الاسم بالإنجليزية (English Name)
              </label>
              <input
                type="text"
                value={headerConfig.englishName}
                onChange={(e) => setHeaderConfig({ ...headerConfig, englishName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 dir-ltr text-right focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Store Name & Store Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المخزن / الفرع المعتمد
              </label>
              <input
                type="text"
                value={headerConfig.storeName || ''}
                onChange={(e) => setHeaderConfig({ ...headerConfig, storeName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                placeholder="مثال: مخزن صيدلية الصحة والجمال - بن عبود"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم المخزن
              </label>
              <input
                type="text"
                value={headerConfig.storeNo || ''}
                onChange={(e) => setHeaderConfig({ ...headerConfig, storeNo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                placeholder="104"
              />
            </div>

            {/* Tele & Fax */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                أرقام الهاتف / التواصل
              </label>
              <input
                type="text"
                value={headerConfig.teleNo}
                onChange={(e) => setHeaderConfig({ ...headerConfig, teleNo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الفاكس / صندوق البريد
              </label>
              <input
                type="text"
                value={headerConfig.faxNo}
                onChange={(e) => setHeaderConfig({ ...headerConfig, faxNo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

          </div>

          {/* Logo Upload Section */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              شعار الصيدلية (Logo)
            </label>
            <div className="flex items-center gap-3">
              {headerConfig.logoUrl ? (
                <div className="relative group shrink-0">
                  <img
                    src={headerConfig.logoUrl}
                    alt="Logo"
                    className="w-16 h-16 object-contain bg-white rounded-lg border border-slate-200 p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setHeaderConfig({ ...headerConfig, logoUrl: '' })}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 text-xs shadow-md"
                    title="حذف الشعار"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-200 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}

              <div className="flex-1 space-y-1">
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition"
                >
                  رفع صورة الشعار
                </button>
                <p className="text-[10px] text-slate-400">
                  يفضل اختيار صورة مربعة بخلفية شفافة (PNG) أقل من 2 ميجابايت
                </p>
              </div>
            </div>
          </div>

          {/* Branches Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                الفروع والعناوين المدرجة بالترويسة
              </label>
              <button
                type="button"
                onClick={handleAddBranch}
                className="text-emerald-600 hover:text-emerald-700 text-xs font-bold"
              >
                + إضافة فرع
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {headerConfig.branches.map((branch, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => handleBranchChange(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    placeholder={`فرع ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveBranch(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Form Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetHeaderConfig}
              className="flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الترويسة الافتراضية</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ بيانات الترويسة والمخزن</span>
            </button>
          </div>

        </form>
      )}

      {/* SUB TAB 3: Backup & System Management */}
      {activeSubTab === 'backup' && (
        <div className="space-y-4">
          
          {/* Offline Storage Status Box */}
          {/* Manual App Sync & Refresh Card */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white p-5 rounded-2xl border border-emerald-500/40 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9.5 h-9.5 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30 shrink-0">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-emerald-300 flex items-center gap-2">
                    تحديث ومزامنة التطبيق وإعادة التحميل
                    <span className="text-[10px] font-mono font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded">
                      تحديث آمن 100%
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    تم إيقاف ميزة "السحب للأسفل للتحديث" تلقائياً لحماية شاشة الجرد ومنع فقدان البيانات غير المحفوظة.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              عند إدخال تعديلات جديدة أو الرغبة في مزامنة النسخة الأخيرة من التطبيق، انقر على الزر أدناه لإعادة تحميل وتحديث التطبيق بأمان تام مع الحفاظ على كافة بيانات الأصناف وجلسات الجرد المحلية.
            </p>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (confirm('هل تريد تحديث ومزامنة التطبيق الآن؟ سيتم إعادة تحميل الصفحة مع حفظ جميع البيانات المحلية.')) {
                    window.location.reload();
                  }
                }}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-slate-950" />
                <span>تحديث التطبيق ومزامنة التغييرات الآن</span>
              </button>
            </div>
          </div>

          {/* Termux & Node.js Direct Disk File Storage Status Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white p-5 rounded-2xl border border-sky-500/30 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-black border border-sky-500/30">
                  <HardDrive className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-sky-300 flex items-center gap-2">
                    تخزين البيانات في مجلد وملفات على القرص (Disk File Storage)
                    <span className="text-[10px] font-mono font-bold bg-sky-500/30 text-sky-200 border border-sky-400/40 px-2 py-0.5 rounded">
                      Termux / Node Server
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    تخزين الأصناف وجلسات الجرد كملفات JSON في مجلد محلي على القرص الصلب أو الهاتف (<code className="font-mono text-sky-400">/data_store/</code>)
                  </p>
                </div>
              </div>

              <span className="text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2.5 py-1 rounded-full font-mono font-bold">
                {diskStorageInfo ? '✓ مفعّل في السيرفر' : 'جاهز للعمل مع Termux'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              عند تشغيل التطبيق عبر <strong>Termux</strong> أو سيرفر Node.js محلي، يتم حفظ كافة بيانات الأصناف والجلسات والمسودات تلقائياً وبشكل فوري في ملفات حقيقية داخل مجلد التطبيق المخصص <code className="bg-slate-800 text-sky-300 px-1.5 py-0.5 rounded font-mono text-[11px]">./data_store/</code>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-bold">ملف الأصناف:</span>
                <span className="font-mono text-sky-300 font-bold block truncate">data_store/items.json</span>
                <span className="text-[10px] text-emerald-400 block font-medium mt-0.5">
                  {diskStorageInfo?.files?.items?.exists ? `✓ يحتوي ${diskStorageInfo.files.items.count} صنف` : 'سيتم إنشاؤه تلقائياً'}
                </span>
              </div>
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-bold">ملف الجلسات:</span>
                <span className="font-mono text-sky-300 font-bold block truncate">data_store/sessions.json</span>
                <span className="text-[10px] text-emerald-400 block font-medium mt-0.5">
                  {diskStorageInfo?.files?.sessions?.exists ? `✓ يحتوي ${diskStorageInfo.files.sessions.count} جلسة` : 'سيتم إنشاؤه تلقائياً'}
                </span>
              </div>
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-bold">ملف المسودة الجارية:</span>
                <span className="font-mono text-sky-300 font-bold block truncate">data_store/draft.json</span>
                <span className="text-[10px] text-emerald-400 block font-medium mt-0.5">
                  {diskStorageInfo?.files?.draft?.exists ? '✓ مسودة محفوظة' : 'سيتم إنشاؤه تلقائياً'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-emerald-400">حالة التخزين المحلي والنظام بدون إنترنت (Offline First)</h3>
              </div>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
                100% Local DB
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              تتم حفظ كافة أصناف الصيدلية وجلسات الجرد المخزني بأمان تام داخل ذاكرة متصفحك أو هاتفك عبر متصفحات (IndexedDB & LocalStorage).
              يمكنك تصدير نسخة احتياطية واستعادتها في أي وقت بنقرة واحدة.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-bold">عدد الأصناف المحفوظة:</span>
                <span className="text-base font-black text-emerald-400 font-mono">{currentItemsCount} صنف</span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-bold">جلسات الجرد المسجلة:</span>
                <span className="text-base font-black text-emerald-400 font-mono">{auditSessions.length} جلسات</span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block font-bold">نوع التخزين:</span>
                <span className="text-xs font-bold text-white">IndexedDB (محلي أوفلاين)</span>
              </div>
            </div>
          </div>

          {/* Capacitor Native Android Filesystem Direct Read/Write Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-2xl border border-emerald-500/30 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                    التحفيظ والقراءة المباشرة من ملفات الجهاز (Capacitor Filesystem)
                    <span className="text-[10px] font-mono font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded">
                      Android Native FS
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    كتابة وقراءة الملفات مباشرة في ذاكرة الأندرويد الداخلية (<code className="font-mono text-emerald-400">@capacitor/filesystem</code>)
                  </p>
                </div>
              </div>

              <div className="text-left text-xs">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                  isFilesystemAvailable()
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isFilesystemAvailable() ? '✓ مفعّل جاهز للعمل' : 'وضع المتصفح (مستعد للأندرويد)'}
                </span>
              </div>
            </div>

            {/* Action Buttons for Capacitor Native Filesystem */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleSaveToNativeFileSystem}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ البيانات في ملفات الجهاز (Write Native)</span>
              </button>

              <button
                type="button"
                onClick={handleReadFromNativeFileSystem}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 shadow-md transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>قراءة البيانات من ملفات الجهاز (Read Native)</span>
              </button>
            </div>

            {/* Status Feedback Message */}
            {nativeStatusMsg && (
              <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 text-xs font-mono whitespace-pre-wrap leading-relaxed text-emerald-300">
                {nativeStatusMsg}
              </div>
            )}

            {/* File list preview */}
            {nativeFileList.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-400">الملفات المحفوظة في مجلد المستندات الأصلي للجهاز:</p>
                <div className="flex flex-wrap gap-1.5">
                  {nativeFileList.map((fName, idx) => (
                    <span key={idx} className="bg-slate-800 px-2 py-1 rounded text-[10px] font-mono text-emerald-300 border border-slate-700">
                      📄 {fName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Offline JSON Backup Export / Restore Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">النسخ الاحتياطي واستعادة البيانات بالكامل (JSON Backup)</h3>
                <p className="text-xs text-slate-500">حفظ نسخة احتياطية شاملة لكافة البيانات ونقلها بين الأجهزة</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => exportFullOfflineBackup()}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تصدير نسخة احتياطية شاملة (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => jsonFileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>استعادة نسخة احتياطية من ملف (.json)</span>
              </button>

              <input
                type="file"
                ref={jsonFileInputRef}
                onChange={handleJsonBackupFileChange}
                accept=".json"
                className="hidden"
              />
            </div>
          </div>

          {/* Standalone HTML Single File Export Card */}
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-teal-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-black text-xl shrink-0">
                📱
              </div>
              <div>
                <h3 className="font-bold text-sm text-teal-300">تحميل تطبيق HTML المستقل المدمج بملف واحد</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  حفظ ملف HTML كامل يضم بياناتك والتطبيق لفتحه في أي جوال أو جهاز بدون إنترنت
                </p>
              </div>
            </div>

            <button
              onClick={() => downloadStandaloneHTMLApp(allCurrentItems, auditSessions)}
              className="w-full sm:w-auto px-5 py-2.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-xl transition shrink-0 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Code className="w-4 h-4" />
              <span>تحميل ملف HTML للجوال</span>
            </button>
          </div>

          {/* Data Reset Box */}
          <div className="bg-slate-100 p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              <p className="font-bold text-slate-800">إعادة تعيين البيانات وتحميل عينة الأصناف الافتراضية</p>
              <p className="text-slate-500">يقوم باستبدال الأصناف الحالية بعينة تجريبية افتراضية جاهزة للفحص</p>
            </div>
            <button
              type="button"
              onClick={onResetToDefault}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>تحميل العينة التجريبية الافتراضية</span>
            </button>
          </div>

        </div>
      )}

      {/* SUB TAB 4: Users & Permissions Management */}
      {activeSubTab === 'users' && (
        <UsersManagementView currentUsername={currentUsername} />
      )}

    </div>
  );
};
