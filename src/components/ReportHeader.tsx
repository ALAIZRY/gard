import React, { useState, useEffect } from 'react';
import { Settings, Upload, Image as ImageIcon, RotateCcw, X, Check, Building2, Phone, MapPin, Warehouse } from 'lucide-react';

export interface ReportHeaderSettings {
  arabicName: string;
  englishName: string;
  subTitle: string;
  teleNo: string;
  faxNo: string;
  poBox: string;
  branches: string[];
  logoUrl?: string;
  storeNo?: string;
  storeName?: string;
}

export const DEFAULT_HEADER_SETTINGS: ReportHeaderSettings = {
  arabicName: 'صيدليات الصحة والجمال - الصيدلية الوطنية',
  englishName: '- AL SAHA & AL JAMAL PHARMACY',
  subTitle: 'صيدلية الصحة والجمال',
  teleNo: '774-181-050',
  faxNo: '770-702-411',
  poBox: 'P.O.Box',
  branches: [
    'مارب - الشبواني',
    'مارب - سوق بن عبود',
    'مفرق الصحن',
    'الفاو'
  ],
  logoUrl: '',
  storeNo: '104',
  storeName: 'مخزن صيدلية الصحة والجمال - بن عبود'
};

const STORAGE_KEY = 'app_report_header_settings';

export const getReportHeaderSettings = (): ReportHeaderSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_HEADER_SETTINGS,
        ...parsed
      };
    }
  } catch (e) {
    console.error('Failed to load header settings', e);
  }
  return DEFAULT_HEADER_SETTINGS;
};

export const saveReportHeaderSettings = (settings: ReportHeaderSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save header settings', e);
  }
};

interface ReportHeaderProps {
  reportTitle?: string;
  reportDate?: string;
  customSettings?: ReportHeaderSettings;
  onOpenSettings?: () => void;
  hideEditButton?: boolean;
  storeNo?: string;
  storeName?: string;
  showStoreBar?: boolean;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  reportTitle = 'بيانات المخزون',
  reportDate,
  customSettings,
  onOpenSettings,
  hideEditButton = true,
  storeNo,
  storeName,
  showStoreBar = true
}) => {
  const [settings, setSettings] = useState<ReportHeaderSettings>(getReportHeaderSettings());

  useEffect(() => {
    if (customSettings) {
      setSettings(customSettings);
    } else {
      setSettings(getReportHeaderSettings());
    }
  }, [customSettings]);

  const currentDateStr = reportDate || new Date().toLocaleDateString('ar-SA');
  const activeStoreNo = storeNo || settings.storeNo || '104';
  const activeStoreName = storeName || settings.storeName || 'مخزن صيدلية الصحة والجمال - بن عبود';

  return (
    <div className="w-full dir-rtl mb-0.5">
      {/* 1. TOP HEADER CONTAINER (الهيدر العلوي بكافة شروطه) */}
      <div className="relative border border-black rounded-md p-0.5 sm:p-1 bg-white text-black shadow-none print:border print:border-black print:rounded-md print:p-0.5">
        
        {/* Edit Button (Hidden in print) */}
        {!hideEditButton && onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="no-print print:hidden absolute -top-2 left-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-1 transition cursor-pointer z-10"
            title="تعديل ترويسة التقارير والشعار والمخزن"
          >
            <Settings className="w-2.5 h-2.5 text-emerald-400" />
            <span>تعديل الترويسة</span>
          </button>
        )}

        <div className="grid grid-cols-3 items-center gap-1">
          
          {/* RIGHT COLUMN: اسم الصيدلية والفروع باللغة العربية */}
          <div className="text-right space-y-0">
            <h2 className="font-black text-[10px] sm:text-[11px] text-black leading-none">
              {settings.arabicName || 'صيدليات الصحة والجمال - الصيدلية الوطنية'}
            </h2>
            <div className="space-y-0 text-[8.5px] sm:text-[9px] font-bold text-black">
              {settings.branches && settings.branches.length > 0 ? (
                settings.branches.map((branch, idx) => (
                  <p key={idx} className="leading-none">{branch}</p>
                ))
              ) : (
                <p className="leading-none text-[8.5px]">مارب - الشبواني | بن عبود | الصحن | الفاو</p>
              )}
            </div>
          </div>

          {/* CENTER COLUMN: شعار الصيدلية ومكانه في المنتصف، أسفله عنوان التقرير (بيانات المخزون) وتاريخ التقرير */}
          <div className="text-center flex flex-col items-center justify-center py-0.5">
            {/* Logo */}
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="h-14 sm:h-16 md:h-20 print:h-16 max-w-[200px] w-auto object-contain mx-auto mb-1"
              />
            ) : (
              <div className="flex flex-col items-center mb-1">
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 print:w-14 print:h-14 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#dc2626" strokeWidth="4" />
                    <circle cx="50" cy="50" r="39" fill="none" stroke="#16a34a" strokeWidth="2" />
                    <path d="M 32 65 C 28 35, 65 30, 48 50 C 35 65, 72 65, 68 35" fill="none" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" />
                    <path d="M 45 35 C 55 35, 62 42, 60 55 C 58 68, 48 72, 38 68" fill="none" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            )}

            {/* Report Title */}
            <div className="border-b border-black pb-0 leading-none">
              <h3 className="font-black text-[10px] sm:text-[11px] text-black px-1 leading-none">
                {reportTitle}
              </h3>
            </div>

            {/* Report Date */}
            <p className="text-[8.5px] sm:text-[9px] font-bold text-black leading-none mt-0.5">
              إلى تاريخ : <span className="font-mono font-black">{currentDateStr}</span>
            </p>
          </div>

          {/* LEFT COLUMN: اسم الصيدلية والهاتف والفاكس باللغة الإنجليزية */}
          <div className="text-left dir-ltr space-y-0">
            <h2 className="font-black text-[10px] sm:text-[11px] text-black font-sans leading-none">
              {settings.englishName || '- AL SAHA & AL JAMAL PHARMACY'}
            </h2>
            <div className="space-y-0 text-[8.5px] sm:text-[9px] font-bold text-black font-mono">
              {settings.teleNo && <p className="leading-none">Tele:{settings.teleNo}</p>}
              {settings.faxNo && <p className="leading-none">Fax:{settings.faxNo}</p>}
              {settings.poBox && <p className="leading-none">{settings.poBox}</p>}
            </div>
          </div>

        </div>
      </div>

      {/* 2. STORE BAR (شريط المخزن: شريط رمادي فاتح بخط أسود يحتوي على رقم المخزن واسم المخزن) */}
      {showStoreBar && (
        <div className="mt-0.5 bg-[#e2e8f0] border border-black py-0.5 px-2 rounded text-black font-bold text-[11px] flex items-center justify-between gap-2 report-store-bar">
          <div className="flex items-center gap-1.5">
            <span className="text-black font-extrabold">المخزن :</span>
            <span className="font-mono font-black text-black">{activeStoreNo}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-black font-extrabold">اسم المخزن :</span>
            <span className="font-black text-black">{activeStoreName}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newSettings: ReportHeaderSettings) => void;
}

export const ReportHeaderSettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<ReportHeaderSettings>(getReportHeaderSettings());
  const [newBranchText, setNewBranchText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData(getReportHeaderSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddBranch = () => {
    if (!newBranchText.trim()) return;
    setFormData((prev) => ({
      ...prev,
      branches: [...prev.branches, newBranchText.trim()]
    }));
    setNewBranchText('');
  };

  const handleRemoveBranch = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      branches: prev.branches.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveReportHeaderSettings(formData);
    onSave(formData);
    onClose();
  };

  const handleResetToDefault = () => {
    if (confirm('هل أنت متأكد من استعادة الترويسة وشريط المخزن الافتراضي؟')) {
      setFormData(DEFAULT_HEADER_SETTINGS);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <span>شاشة بيانات الترويسة والمخزن</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Store Info Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Warehouse className="w-4 h-4 text-indigo-600" />
              <span>بيانات المخزن (شريط المخزن في التقرير)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  رقم المخزن *
                </label>
                <input
                  type="text"
                  required
                  value={formData.storeNo || '01'}
                  onChange={(e) => setFormData({ ...formData, storeNo: e.target.value })}
                  placeholder="01"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  اسم المخزن *
                </label>
                <input
                  type="text"
                  required
                  value={formData.storeName || 'المخزن الرئيسي / صيدلية المركز الرئيسي'}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="اسم المخزن..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                />
              </div>
            </div>
          </div>

          {/* Grid 1: Company Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الصيدلية / المنشأة (بالعربي) *
              </label>
              <input
                type="text"
                required
                value={formData.arabicName}
                onChange={(e) => setFormData({ ...formData, arabicName: e.target.value })}
                placeholder="مثال: صيدليات الصحة والجمال"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الصيدلية / المنشأة (بالإنجليزي) *
              </label>
              <input
                type="text"
                required
                value={formData.englishName}
                onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
                placeholder="e.g. AL SAHA PHARMACY"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-xs font-sans text-left"
              />
            </div>
          </div>

          {/* Subtitle & Logo Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العنوان الفرعي تحت الشعار
              </label>
              <input
                type="text"
                value={formData.subTitle}
                onChange={(e) => setFormData({ ...formData, subTitle: e.target.value })}
                placeholder="مثال: صيدلية الصحة والجمال"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                شعار الترويسة (اللوجو)
              </label>
              <div className="flex items-center gap-2">
                {formData.logoUrl ? (
                  <div className="relative w-12 h-12 border border-slate-200 rounded-lg overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center p-1">
                    <img src={formData.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: '' })}
                      className="absolute top-0 right-0 bg-rose-600 text-white rounded-bl p-0.5"
                      title="حذف اللوجو"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 border-2 border-dashed border-slate-300 rounded-lg shrink-0 flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}

                <label className="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-300 text-center flex items-center justify-center gap-1.5 transition">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>رفع صورة اللوجو</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>أرقام التواصل والعناوين (الجهة اليسرى)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  رقم الهاتف (Tele No.)
                </label>
                <input
                  type="text"
                  value={formData.teleNo}
                  onChange={(e) => setFormData({ ...formData, teleNo: e.target.value })}
                  placeholder="774-181-050"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  رقم الفاكس (Fax No.)
                </label>
                <input
                  type="text"
                  value={formData.faxNo}
                  onChange={(e) => setFormData({ ...formData, faxNo: e.target.value })}
                  placeholder="770-702-411"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  صندوق البريد (P.O.Box)
                </label>
                <input
                  type="text"
                  value={formData.poBox}
                  onChange={(e) => setFormData({ ...formData, poBox: e.target.value })}
                  placeholder="P.O.Box"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Branches / Addresses */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>فروع وعناوين الصيدلية (الجهة اليمنى)</span>
            </h4>

            <div className="space-y-2">
              {formData.branches.map((branch, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-xs font-bold text-slate-800 flex-1">{branch}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBranch(idx)}
                    className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                    title="حذف هذا الفرع"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newBranchText}
                  onChange={(e) => setNewBranchText(e.target.value)}
                  placeholder="إضافة سطر فرع/عنوان جديد..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBranch();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddBranch}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer shrink-0"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center gap-1 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الترويسة النموذجية</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

interface ReportFooterProps {
  printedBy?: string;
  reportDateStr?: string;
  totalItemsCount?: number;
  totalStoreCost?: number;
  totalSellingValue?: number;
  showTotalsSummary?: boolean;
  showCost?: boolean;
  showSellingPrice?: boolean;
  totalPages?: number;
  showBottomBar?: boolean;
}

export const TableReportFooter: React.FC<{
  colSpan: number;
  printedBy?: string;
  reportDateStr?: string;
  totalPages?: number;
  totalItemsCount?: number;
}> = ({
  colSpan,
  printedBy = 'مدير النظام',
  reportDateStr,
  totalPages,
  totalItemsCount,
}) => {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const formattedTime = currentDate.toLocaleTimeString('en-US', { hour12: true }); // hh:mm:ss AM/PM
  const nowDisplayStr = reportDateStr || `${formattedTime} ${formattedDate}`;

  const computedTotalPages = totalPages && totalPages > 0
    ? totalPages
    : (totalItemsCount && totalItemsCount > 0 ? Math.max(1, Math.ceil(totalItemsCount / 22)) : 1);

  return (
    <tfoot className="print:table-footer-group bg-white">
      <tr>
        <td colSpan={colSpan} className="p-0 border-0">
          <div className="flex items-center justify-between w-full pt-1 px-1.5 pb-0.5 text-[10px] font-extrabold text-black bg-white border-t border-black print:border-t">
            <div className="text-right whitespace-nowrap">
              تاريخ التقرير : <span className="font-mono">{nowDisplayStr}</span>
            </div>
            <div className="font-mono font-bold text-center whitespace-nowrap dir-ltr">
              <span className="print-page-number-curr"><span className="print:hidden">1</span></span>
              <span> / </span>
              <span>{computedTotalPages}</span>
            </div>
            <div className="text-left whitespace-nowrap">
              طبع بواسطة : <span className="font-bold">{printedBy || 'مدير النظام'}</span>
            </div>
          </div>
        </td>
      </tr>
    </tfoot>
  );
};

export const ReportFooter: React.FC<ReportFooterProps> = ({
  printedBy = 'مدير النظام',
  reportDateStr,
  totalItemsCount,
  totalStoreCost,
  totalSellingValue,
  showTotalsSummary = false,
  showCost = true,
  showSellingPrice = true,
  totalPages,
  showBottomBar = true
}) => {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const formattedTime = currentDate.toLocaleTimeString('en-US', { hour12: true }); // hh:mm:ss AM/PM
  const nowDisplayStr = reportDateStr || `${formattedTime} ${formattedDate}`;

  const computedTotalPages = totalPages && totalPages > 0
    ? totalPages
    : (totalItemsCount && totalItemsCount > 0 ? Math.max(1, Math.ceil(totalItemsCount / 22)) : 1);

  return (
    <div className="w-full dir-rtl mt-2 text-black text-xs font-bold space-y-1">
      {/* Total Summary Block (at end of report if enabled) */}
      {showTotalsSummary && totalItemsCount !== undefined && (
        <div className="border border-black bg-slate-50 p-2 rounded text-xs space-y-1 my-1">
          <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
            <span>عدد الاصناف :</span>
            <span className="font-mono font-black text-sm">{totalItemsCount}</span>
          </div>
          {showCost && totalStoreCost !== undefined && (
            <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
              <span>إجمالي التكلفة حسب المخزن :</span>
              <span className="font-mono font-black text-sm">{totalStoreCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {showSellingPrice && totalSellingValue !== undefined && (
            <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
              <span>إجمالي قيمة البيع :</span>
              <span className="font-mono font-black text-sm">{totalSellingValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      )}

      {/* Official Bottom Page Footer Row - Matched exactly with user image */}
      {showBottomBar && (
        <div className="flex items-center justify-between w-full pt-1 px-1.5 text-[10px] font-extrabold text-black bg-white border-t border-black">
          <div className="text-right whitespace-nowrap">
            تاريخ التقرير : <span className="font-mono">{nowDisplayStr}</span>
          </div>
          <div className="font-mono font-bold text-center whitespace-nowrap dir-ltr">
            <span className="print-page-number-curr"><span className="print:hidden">1</span></span>
            <span> / </span>
            <span>{computedTotalPages}</span>
          </div>
          <div className="text-left whitespace-nowrap">
            طبع بواسطة : <span className="font-bold">{printedBy || 'مدير النظام'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
