import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Item, AuditRecord, AuditSession } from '../types';
import {
  Search,
  Barcode,
  Calendar,
  ClipboardCheck,
  Plus,
  Trash2,
  CheckCircle2,
  DollarSign,
  Camera,
  AlertTriangle,
  X,
  FileDown,
  FileText,
  Loader2,
  Printer,
  History,
  Layers,
  Sparkles,
  Save,
  Check,
  Tag,
  Grid,
  Filter,
  Columns,
  Eye,
  ChevronDown,
  User
} from 'lucide-react';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { exportAuditSessionToExcel } from '../utils/excelUtils';
import { exportElementToPDF } from '../utils/pdfUtils';
import { ReportHeader, ReportFooter, TableReportFooter, ReportHeaderSettingsModal } from './ReportHeader';
import { hasUserPermission } from '../utils/userUtils';
import { round2, fmtQty, fmtDiffQty, fmtMoney, fmtDiffMoney } from '../utils/numberUtils';
import {
  getItemUnits,
  getUnitPricing,
  getConsolidatedItemUnits,
  getConsolidatedUnitPricing,
  getItemBarcodes,
  getItemForeignNames,
  itemMatchesQuery
} from '../utils/unitUtils';

interface StockAuditProps {
  items: Item[];
  activeSession: AuditSession | null;
  currentUser?: { username: string; role?: string; permissions?: string[] } | null;
  onUpdateActiveSession: (session: AuditSession) => void;
  onCompleteSession: (session: AuditSession) => void;
  onNavigateToCatalog: () => void;
}

// Validation helper for Expiry Date formats (DD/MM/YYYY, MM/YYYY, MM/YY, YYYY-MM-DD, YYYY-MM)
export const isValidExpiryDate = (dateStr: string): boolean => {
  if (!dateStr || !dateStr.trim()) return false;
  const clean = dateStr.trim();

  if (clean === 'غير محدد') return true;

  // DD/MM/YYYY e.g. 01/01/2028 or 15/06/2027
  const ddmmyyyy = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(20\d{2})$/;
  if (ddmmyyyy.test(clean)) return true;

  // MM/YYYY e.g. 05/2028
  const mmyyyy = /^(0[1-9]|1[0-2])\/(20\d{2})$/;
  if (mmyyyy.test(clean)) return true;

  // MM/YY e.g. 05/28
  const mmyy = /^(0[1-9]|1[0-2])\/(\d{2})$/;
  if (mmyy.test(clean)) return true;

  // YYYY-MM-DD e.g. 2028-01-01
  const yyyymmdd = /^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (yyyymmdd.test(clean)) return true;

  // YYYY-MM e.g. 2028-01
  const yyyymm = /^(20\d{2})-(0[1-9]|1[0-2])$/;
  if (yyyymm.test(clean)) return true;

  return false;
};

export const StockAudit: React.FC<StockAuditProps> = ({
  items,
  activeSession,
  onUpdateActiveSession,
  onCompleteSession,
  onNavigateToCatalog
}) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Manual Expiry Date Input Auto-Formatter (e.g. 01012028 -> 01/01/2028)
  const handleManualDateInput = (val: string) => {
    // If date comes from HTML5 date picker or already formatted ISO (e.g., YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      setExpiryDate(val);
      return;
    }

    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length > 0) {
      let formatted = digitsOnly.slice(0, 8);
      if (formatted.length > 4) {
        formatted = `${formatted.slice(0, 2)}/${formatted.slice(2, 4)}/${formatted.slice(4)}`;
      } else if (formatted.length > 2) {
        formatted = `${formatted.slice(0, 2)}/${formatted.slice(2)}`;
      }
      setExpiryDate(formatted);
    } else {
      setExpiryDate(val);
    }
  };

  // Form Fields as requested by user
  const [selectedUnit, setSelectedUnit] = useState('حبة');
  const [expiryDate, setExpiryDate] = useState('');
  const [columnNo, setColumnNo] = useState('1'); // رقم العمود / الرف
  const [auditedQty, setAuditedQty] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Table view & filter state
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  const [filterColumn, setFilterColumn] = useState<string>('all');

  // Print & Preview Options (خيارات الطباعة والاستعراض)
  const [showCost, setShowCost] = useState(true);
  const [showSellingPrice, setShowSellingPrice] = useState(true);

  // Modals for full report & print by column
  const [isFullReportModalOpen, setIsFullReportModalOpen] = useState(false);
  const [isPrintByColumnModalOpen, setIsPrintByColumnModalOpen] = useState(false);
  const [selectedColumnToPrint, setSelectedColumnToPrint] = useState<string>('all');
  const [isHeaderSettingsModalOpen, setIsHeaderSettingsModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Custom unit addition inline for item
  const [showAddUnitInput, setShowAddUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  // Dark Popups for Unit, Expiry Date, and Quantity entry (matching user screenshot)
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isExpiryModalOpen, setIsExpiryModalOpen] = useState(false);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);

  // Auditor details & Document information
  const [auditorName, setAuditorName] = useState(activeSession?.auditorName || 'مسؤول الجرد');
  const [voucherType, setVoucherType] = useState('سند جرد مخزني');
  const [sessionStatement, setSessionStatement] = useState(
    activeSession?.notes || 'محضر جرد وتدقيق المواد والأصناف المخزنية'
  );
  const [sessionTitle, setSessionTitle] = useState(
    activeSession?.title || `جرد مخزني - ${new Date().toLocaleDateString('ar-SA')}`
  );

  // Camera Scanner Modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Audit Approval & Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Ghost-click protection for modals on touch devices
  const modalOpenTimeRef = useRef<{ [key: string]: number }>({});

  const trackModalOpen = (modalName: string) => {
    modalOpenTimeRef.current[modalName] = Date.now();
  };

  const isGhostClick = (modalName: string) => {
    const openedAt = modalOpenTimeRef.current[modalName] || 0;
    return Date.now() - openedAt < 450;
  };

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const unitSelectRef = useRef<HTMLSelectElement | null>(null);
  const expiryDateSelectRef = useRef<HTMLSelectElement | null>(null);
  const expiryDateInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const modalQtyInputRef = useRef<HTMLInputElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  // Available units linked specifically to the selected item across all matching items
  const linkedUnits = useMemo(() => {
    if (!selectedItem) return ['حبة'];
    return getConsolidatedItemUnits(selectedItem, items);
  }, [selectedItem, items]);

  // Available expiry dates linked specifically to the selected item ONLY
  const availableExpiryDates = useMemo(() => {
    if (!selectedItem) return [];
    const dateSet = new Set<string>();

    if (selectedItem.expiryDate && selectedItem.expiryDate.trim()) {
      dateSet.add(selectedItem.expiryDate.trim());
    }

    items.forEach((it) => {
      if ((it.code === selectedItem.code || it.name === selectedItem.name) && it.expiryDate && it.expiryDate.trim()) {
        dateSet.add(it.expiryDate.trim());
      }
    });

    (activeSession?.records || []).forEach((rec) => {
      if (
        (rec.itemCode === selectedItem.code || rec.itemName === selectedItem.name) &&
        rec.expiryDate &&
        rec.expiryDate !== 'غير محدد' &&
        rec.expiryDate.trim()
      ) {
        dateSet.add(rec.expiryDate.trim());
      }
    });

    return Array.from(dateSet);
  }, [selectedItem, items, activeSession]);

  // O(1) Fast lookup Map for Barcodes (primary, alternative, multi-unit) and Item Code
  const itemMaps = useMemo(() => {
    const barcodeMap = new Map<string, { item: Item; unit?: string }>();
    const codeMap = new Map<string, Item>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.code) codeMap.set(item.code.trim().toLowerCase(), item);

      const allBarcodes = getItemBarcodes(item);
      allBarcodes.forEach((bc) => {
        const lower = bc.toLowerCase();
        if (!barcodeMap.has(lower)) {
          barcodeMap.set(lower, { item });
        }
      });

      // Specific unit barcode mapping so scanning a unit barcode auto-selects that unit
      const unitDetailsList = item.unitDetails || (item as any).unitsDetails;
      if (unitDetailsList && Array.isArray(unitDetailsList)) {
        unitDetailsList.forEach((ud: any) => {
          if (ud && ud.unit) {
            const udBcs = getItemBarcodes({
              ...item,
              barcode: ud.barcode || '',
              barcode1: ud.barcode1,
              barcode2: ud.barcode2,
              barcodes: ud.barcodes,
              unitDetails: []
            });
            udBcs.forEach((uBc) => {
              barcodeMap.set(uBc.toLowerCase(), { item, unit: ud.unit.trim() });
            });
          }
        });
      }
    }
    return { barcodeMap, codeMap };
  }, [items]);

  // Filter items matching search (deduplicated by item name so each item appears ONCE)
  const searchResults = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    if (!term) return [];

    const results: Item[] = [];
    const seenNames = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (itemMatchesQuery(item, term)) {
        const nameKey = (item.name || '').trim().toLowerCase();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          results.push(item);
          if (results.length >= 8) break;
        }
      }
    }
    return results;
  }, [items, deferredSearchTerm]);

  // Handle item selection from search dropdown or barcode scan
  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    const units = getConsolidatedItemUnits(item, items);
    setSelectedUnit(units[0] || 'حبة');

    // Automatically check for registered available dates for this item
    const dateSet = new Set<string>();
    if (item.expiryDate && item.expiryDate.trim()) {
      dateSet.add(item.expiryDate.trim());
    }
    items.forEach((it) => {
      if ((it.code === item.code || it.name === item.name) && it.expiryDate && it.expiryDate.trim()) {
        dateSet.add(it.expiryDate.trim());
      }
    });
    (activeSession?.records || []).forEach((rec) => {
      if (
        (rec.itemCode === item.code || rec.itemName === item.name) &&
        rec.expiryDate &&
        rec.expiryDate !== 'غير محدد' &&
        rec.expiryDate.trim()
      ) {
        dateSet.add(rec.expiryDate.trim());
      }
    });
    // Keep date selection and quantity EMPTY so user must pick or enter date & quantity explicitly
    setExpiryDate('');
    setAuditedQty('');

    setSearchTerm(item.name);
    setShowDropdown(false);
    setShowAddUnitInput(false);

    // Auto open Unit Picker Modal immediately upon selecting item with ghost click protection
    trackModalOpen('unit');
    setIsUnitModalOpen(true);
  };

  // Selection transition handlers for custom dark modals
  const handleSelectUnitFromModal = (unit: string) => {
    setSelectedUnit(unit);
    setIsUnitModalOpen(false);

    // Auto open Expiry Date Picker Modal
    setTimeout(() => {
      trackModalOpen('expiry');
      setIsExpiryModalOpen(true);
    }, 150);
  };

  const handleSelectExpiryFromModal = (dateVal: string) => {
    if (!dateVal || !dateVal.trim()) {
      alert('يرجى اختيار أو إدخال تاريخ الانتهاء');
      return;
    }

    if (!isValidExpiryDate(dateVal)) {
      alert('تنسيق تاريخ الانتهاء غير صحيح. يرجى إدخاله بتنسيق صحيح (مثال: 01/01/2028 أو 05/2028)');
      return;
    }

    setExpiryDate(dateVal.trim());
    setIsExpiryModalOpen(false);

    // Auto open Quantity Input Modal popup
    setTimeout(() => {
      trackModalOpen('quantity');
      setIsQuantityModalOpen(true);
      setTimeout(() => {
        if (modalQtyInputRef.current) {
          modalQtyInputRef.current.focus();
          modalQtyInputRef.current.select();
        }
      }, 100);
    }, 150);
  };

  const handleOpenQuantityModal = () => {
    if (!expiryDate.trim()) {
      alert('يرجى اختيار أو إدخال تاريخ الانتهاء أولاً قبل الانتقال لإدخال الكمية');
      trackModalOpen('expiry');
      setIsExpiryModalOpen(true);
      setTimeout(() => {
        if (expiryDateInputRef.current) {
          expiryDateInputRef.current.focus();
          expiryDateInputRef.current.select();
        }
      }, 150);
      return;
    }

    if (!isValidExpiryDate(expiryDate)) {
      alert('تنسيق تاريخ الانتهاء غير صحيح. يرجى تعديله وإدخاله بتنسيق صحيح أولاً (مثال: 01/01/2028 أو 05/2028)');
      trackModalOpen('expiry');
      setIsExpiryModalOpen(true);
      setTimeout(() => {
        if (expiryDateInputRef.current) {
          expiryDateInputRef.current.focus();
          expiryDateInputRef.current.select();
        }
      }, 150);
      return;
    }

    trackModalOpen('quantity');
    setIsQuantityModalOpen(true);
    setTimeout(() => {
      if (modalQtyInputRef.current) {
        modalQtyInputRef.current.focus();
        modalQtyInputRef.current.select();
      }
    }, 100);
  };

  // Add new unit to selected item
  const handleAddNewUnitToItem = () => {
    if (!newUnitName.trim() || !selectedItem) return;
    const unitClean = newUnitName.trim();
    const updatedUnits = Array.from(new Set([...(selectedItem.units || [selectedItem.unit]), unitClean]));
    const updatedItem = {
      ...selectedItem,
      units: updatedUnits
    };
    setSelectedItem(updatedItem);
    setSelectedUnit(unitClean);
    setNewUnitName('');
    setShowAddUnitInput(false);
  };

  // Search input change handler - ONLY updates search text and opens suggestions dropdown without interrupting typing
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setShowDropdown(true);
  };

  // Explicit search submission (e.g. Enter key, barcode scanner Enter event, or mobile keyboard submission)
  const handleSearchSubmit = () => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return;

    const exactBarcode = itemMaps.barcodeMap.get(trimmed);
    const exactCode = itemMaps.codeMap.get(trimmed);
    if (exactBarcode) {
      handleSelectItem(exactBarcode.item);
      if (exactBarcode.unit) {
        setSelectedUnit(exactBarcode.unit);
      }
    } else if (exactCode) {
      handleSelectItem(exactCode);
    } else if (searchResults.length > 0) {
      handleSelectItem(searchResults[0]);
    }
  };

  // Add item to audit session
  const executeAddAuditRecord = (qtyOverride?: number) => {
    if (!selectedItem || !activeSession) return;

    if (!columnNo.trim()) {
      alert('يرجى كتابة رقم العمود أولاً');
      return;
    }

    if (!expiryDate.trim()) {
      setIsQuantityModalOpen(false);
      alert('يرجى اختيار أو إدخال تاريخ الانتهاء أولاً');
      setTimeout(() => {
        setIsExpiryModalOpen(true);
        if (expiryDateInputRef.current) {
          expiryDateInputRef.current.focus();
          expiryDateInputRef.current.select();
        }
      }, 150);
      return;
    }

    if (!isValidExpiryDate(expiryDate)) {
      setIsQuantityModalOpen(false);
      alert('تنسيق تاريخ الانتهاء غير صحيح. يرجى إدخال التاريخ بتنسيق صحيح (مثال: 01/01/2028 أو 05/2028)');
      setTimeout(() => {
        setIsExpiryModalOpen(true);
        if (expiryDateInputRef.current) {
          expiryDateInputRef.current.focus();
          expiryDateInputRef.current.select();
        }
      }, 150);
      return;
    }

    const qty = qtyOverride !== undefined ? qtyOverride : (typeof auditedQty === 'number' ? auditedQty : parseFloat(auditedQty as string));

    if (isNaN(qty) || qty <= 0) {
      alert('يرجى إدخال كمية الجرد الحقيقية (أكبر من صفر)');
      return;
    }

    const unitPricing = getConsolidatedUnitPricing(selectedItem, selectedUnit, items);
    const cost = unitPricing.initialCost;
    const price = unitPricing.sellingPrice;

    const totalCostValue = Number((qty * cost).toFixed(2));
    const totalSellingValue = Number((qty * price).toFixed(2));

    const newRecord: AuditRecord = {
      id: `rec-${Date.now()}`,
      auditSessionId: activeSession.id,
      itemId: selectedItem.id,
      itemCode: selectedItem.code,
      itemName: selectedItem.name,
      foreignName: selectedItem.foreignName,
      barcode: selectedItem.barcode,
      unit: selectedUnit,
      columnNo: columnNo.trim(),
      pack: selectedItem.pack,
      expiryDate: expiryDate.trim(),
      auditedQty: qty,
      initialCost: cost,
      sellingPrice: price,
      totalCostValue,
      totalSellingValue,
      notes,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdBy: auditorName || activeSession?.auditorName || 'مسؤول الجرد'
    };

    const updatedSession: AuditSession = {
      ...activeSession,
      auditorName,
      records: [newRecord, ...(activeSession.records || [])]
    };

    onUpdateActiveSession(updatedSession);

    // Reset form for fast continuous scanning
    setSelectedItem(null);
    setSearchTerm('');
    setAuditedQty('');
    setExpiryDate('');
    setNotes('');
    setIsQuantityModalOpen(false);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleAddAuditRecord = (e: React.FormEvent) => {
    e.preventDefault();
    executeAddAuditRecord();
  };

  // Remove record from current active session
  const handleRemoveRecord = (recordId: string) => {
    if (!activeSession) return;
    const updatedRecords = (activeSession.records || []).filter((r) => r.id !== recordId);
    onUpdateActiveSession({
      ...activeSession,
      records: updatedRecords
    });
  };

  // Clear all records from active draft session
  const handleClearActiveSessionRecords = () => {
    if (!activeSession || !activeSession.records || activeSession.records.length === 0) return;
    if (confirm('هل أنت متأكد من مسح كافة البنود من نموذج الجرد الحالي؟')) {
      onUpdateActiveSession({
        ...activeSession,
        records: []
      });
    }
  };

  // Complete & Confirm Audit Session
  const handleConfirmFinishAudit = () => {
    if (!activeSession || !activeSession.records || activeSession.records.length === 0) return;

    const completed: AuditSession = {
      ...activeSession,
      title: sessionTitle,
      auditorName,
      status: 'completed'
    };
    onCompleteSession(completed);
    setIsConfirmModalOpen(false);
    alert('تم اعتماد وحفظ نموذج الجرد بنجاح وأرشيفه في السجلات والتقارير!');
  };

  // Session Totals
  const totalAuditedQty = useMemo(
    () => (activeSession?.records || []).reduce((sum, r) => sum + r.auditedQty, 0),
    [activeSession]
  );
  const totalCostSum = useMemo(
    () => (activeSession?.records || []).reduce((sum, r) => sum + r.totalCostValue, 0),
    [activeSession]
  );
  const totalSellingSum = useMemo(
    () => (activeSession?.records || []).reduce((sum, r) => sum + r.totalSellingValue, 0),
    [activeSession]
  );

  // Column-based helper computations
  const activeColumns = useMemo(() => {
    if (!activeSession || !activeSession.records) return [];
    const cols = new Set<string>();
    (activeSession.records || []).forEach((r) => {
      cols.add(r.columnNo || '1');
    });
    return Array.from(cols).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [activeSession]);

  const recordsByColumnMap = useMemo(() => {
    if (!activeSession || !activeSession.records) return new Map<string, AuditRecord[]>();
    const map = new Map<string, AuditRecord[]>();
    (activeSession.records || []).forEach((r) => {
      const col = r.columnNo || '1';
      if (!map.has(col)) map.set(col, []);
      map.get(col)!.push(r);
    });
    return map;
  }, [activeSession]);

  const filteredRecords = useMemo(() => {
    if (!activeSession || !activeSession.records) return [];
    if (filterColumn === 'all') return activeSession.records;
    return activeSession.records.filter((r) => (r.columnNo || '1') === filterColumn);
  }, [activeSession, filterColumn]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main Stock Audit Workspace - Hidden on Print */}
      <div className="space-y-3 sm:space-y-4 print:hidden">
      
      {/* ================= PART 1: HEADER & DOCUMENT DATA (الجزء الأول: رأس المستند وبيانات الجلسة) ================= */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
        {/* Header Title & Actions Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
              <ClipboardCheck className="w-3 h-3 text-slate-950" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                الجزء الأول
              </span>
              <h2 className="text-[11px] sm:text-xs font-black text-slate-900">رأس المستند (بيانات مستند الجرد)</h2>
            </div>
          </div>
        </div>

        {/* Document Metadata & Column Location Form Fields Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80 text-xs">
          <div>
            <label className="block text-[9px] font-bold text-slate-700 mb-0.5">عنوان المستند *</label>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="عنوان المستند..."
              className="w-full px-1.5 py-0.5 rounded border border-slate-300 font-bold text-slate-900 bg-white focus:ring-1 focus:ring-emerald-500 text-[11px]"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-700 mb-0.5">اسم القائم بالجرد *</label>
            <input
              type="text"
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              placeholder="اسم المسئول..."
              className="w-full px-1.5 py-0.5 rounded border border-slate-300 font-bold text-slate-900 bg-white focus:ring-1 focus:ring-emerald-500 text-[11px]"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-indigo-800 mb-0.5">رقم العمود / الرف *</label>
            <input
              type="text"
              required
              value={columnNo}
              onChange={(e) => setColumnNo(e.target.value)}
              placeholder="رقم العمود..."
              className="w-full px-1.5 py-0.5 rounded border border-indigo-300 font-black text-slate-900 bg-white focus:ring-1 focus:ring-indigo-500 text-[11px]"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-indigo-800 mb-0.5">البيان / وصف العمود</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="وصف الرف/الموقع..."
              className="w-full px-1.5 py-0.5 rounded border border-indigo-200 font-medium text-slate-900 bg-white focus:ring-1 focus:ring-indigo-500 text-[11px]"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-700 mb-0.5">تاريخ الجرد والمستند</label>
            <input
              type="text"
              readOnly
              value={activeSession?.date || new Date().toISOString().split('T')[0]}
              className="w-full px-1.5 py-0.5 rounded border border-slate-200 font-mono font-bold text-slate-600 bg-slate-100 cursor-not-allowed text-[11px]"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-700 mb-0.5">حالة المستند والجلسة</label>
            <div className="flex items-center justify-between px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50/80 text-emerald-900 font-bold text-[11px]">
              <span className="text-[10px]">جلسة نشطة</span>
              <span className="bg-emerald-600 text-white px-1 py-0.2 rounded text-[9px] font-mono">
                {activeSession?.records.length || 0} صنف
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PART 2: ITEMS DATA & AUDIT OPERATIONS (بيانات وتفاصيل الأصناف) ================= */}
      <div className="space-y-3">
        {/* Side-by-Side Grid Layout: Entry Form & Audit Session Records Tracking */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-4 items-start">
          
          {/* Item Audit Entry Form Panel */}
          <div className="lg:col-span-5 bg-white p-2 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-md space-y-2.5 lg:sticky lg:top-4">

            {/* البحث واختيار الصنف */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchSubmit();
              }}
              className="space-y-2 relative"
            >
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                اسم الصنف أو رقم الباركود أو رقم الكود *
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleSearchInputChange}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchSubmit();
                      }
                    }}
                    placeholder="اكتب اسم الصنف، رقم الباركود، أو كود الصنف..."
                    className="w-full pr-9 pl-8 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900 text-xs bg-slate-50/50"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedItem(null);
                      }}
                      className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0 active:scale-95 cursor-pointer"
                  title="مسح الباركود بالكاميرا للجرد"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-100" />
                  <span className="hidden sm:inline">مسح الباركود</span>
                </button>
              </div>

              {/* Search Suggestions Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-20 top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectItem(item);
                      }}
                      className="p-3 hover:bg-emerald-50/90 cursor-pointer transition flex items-center justify-between group text-xs active:bg-emerald-100"
                    >
                      <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-700">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </form>

        {/* 5, 6, 7, 8: عند اختيار الصنف -> الوحدة، تاريخ الانتهاء، كمية الجرد والتفاصيل التلقائية */}
        {selectedItem ? (
          <form onSubmit={handleAddAuditRecord} className="space-y-4 pt-3 border-t border-slate-200">
            
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center">4</span>
              <span>إدخال بيانات الجرد والتفاصيل التلقائية للصنف</span>
            </div>

            {/* 5, 6, 7: Input controls grid: الوحدة, تاريخ الانتهاء, كمية الجرد */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
              
              {/* 5. الوحدة المربوطة بالصنف */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    الوحدة المربوطة بالصنف *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddUnitInput(!showAddUnitInput)}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إضافة وحدة</span>
                  </button>
                </div>

                {/* Quick selection chips for multi-unit items */}
                {linkedUnits.length > 0 && !showAddUnitInput && (
                  <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                    {linkedUnits.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setSelectedUnit(u)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                          selectedUnit === u
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                )}

                {showAddUnitInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="اسم الوحدة..."
                      className="w-full px-2 py-1.5 rounded-lg border border-emerald-400 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewUnitToItem}
                      className="p-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-400 shrink-0"
                      title="حفظ الوحدة المربوطة"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddUnitInput(false)}
                      className="p-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-300 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsUnitModalOpen(true)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-emerald-500 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900 bg-white text-xs cursor-pointer flex items-center justify-between shadow-2xs transition"
                    >
                      <span>{selectedUnit || 'اختر الوحدة...'}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                    {selectedItem && selectedUnit && (() => {
                      const pricing = getConsolidatedUnitPricing(selectedItem, selectedUnit, items);
                      return (
                        <div className="mt-1 flex items-center justify-between px-2 py-1 bg-emerald-50 border border-emerald-200/80 rounded-md text-[10px] font-bold">
                          <span className="text-emerald-800">سعر البيع ({selectedUnit}): <strong className="text-emerald-700">{pricing.sellingPrice} ر.س</strong></span>
                          <span className="text-slate-600 font-mono">التكلفة: <strong>{pricing.initialCost} ر.س</strong></span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* 6. تاريخ الانتهاء */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    تاريخ الانتهاء *
                  </label>
                  {availableExpiryDates.length > 0 ? (
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded font-bold border border-emerald-200">
                      {availableExpiryDates.length} تاريخ مسجل
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded font-bold border border-amber-200">
                      لا يوجد تاريخ
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  {/* زر فتح البوب اب المظلم للتواريخ المسجلة */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsExpiryModalOpen(true)}
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 hover:border-emerald-500 focus:ring-2 focus:ring-emerald-500 font-bold text-xs text-slate-900 bg-white cursor-pointer flex items-center justify-between transition"
                    >
                      <span className={expiryDate ? 'font-black text-emerald-700' : 'text-slate-500'}>
                        {expiryDate || '-- اختر التاريخ المسجل --'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  </div>

                  {/* الكتابة اليدوية السريعة */}
                  <div className="pt-1 border-t border-slate-150">
                    <input
                      ref={expiryDateInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={expiryDate}
                      onChange={(e) => {
                        handleManualDateInput(e.target.value);
                        const digitsOnly = e.target.value.replace(/\D/g, '');
                        if (digitsOnly.length === 8) {
                          const formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
                          if (isValidExpiryDate(formatted)) {
                            setTimeout(() => {
                              handleOpenQuantityModal();
                            }, 150);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleOpenQuantityModal();
                        }
                      }}
                      placeholder="أو ادخل مباشرة (مثال: 01012028)"
                      className="w-full px-2 py-1 rounded-md border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-xs text-slate-900 bg-white focus:border-emerald-500"
                      title="اكتب الأرقام مباشرة وتضاف الفواصل تلقائياً"
                    />
                  </div>
                </div>
              </div>

              {/* 7. كمية الجرد الحقيقية */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  كمية الجرد الحقيقية *
                </label>
                <div
                  onClick={handleOpenQuantityModal}
                  className="w-full px-2.5 py-2 rounded-lg border border-emerald-400 focus:ring-2 focus:ring-emerald-500 font-black text-slate-900 text-sm bg-amber-50/60 hover:bg-amber-100/80 cursor-pointer flex items-center justify-between transition shadow-2xs"
                >
                  <span className={auditedQty !== '' ? 'text-emerald-800 font-black text-base' : 'text-slate-400 font-bold text-xs'}>
                    {auditedQty !== '' ? auditedQty : 'اضغط لإدخال الكمية...'}
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-md">
                    إدخال
                  </span>
                </div>
              </div>

            </div>

            {/* Form Validation Status & Submit Button */}
            {(() => {
              const isQtyFilled = typeof auditedQty === 'number' && !isNaN(auditedQty) && auditedQty > 0;
              const isValid = Boolean(
                columnNo.trim() !== '' &&
                expiryDate.trim() !== '' &&
                isQtyFilled
              );

              return (
                <div className="space-y-1.5 pt-1">
                  {!isValid && (
                    <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2 text-amber-900 text-[11px] font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                      <span>
                        {!expiryDate.trim()
                          ? 'الخطوة التالية: اختر أو ادخل تاريخ الانتهاء لتجاوزه إلى الكمية'
                          : !isQtyFilled
                          ? 'الخطوة التالية: حدد الكمية الحقيقية لإتاحة زر الحفظ'
                          : 'تنبيه: يرجى استكمال البيانات المطلوبة'}
                      </span>
                    </div>
                  )}

                  {/* يظهر زر الحفظ بوضوح عند إدخال وتحديد الكمية واستكمال البيانات */}
                  {(isQtyFilled || isValid) && (
                    <div className="animate-fade-in">
                      <button
                        ref={saveButtonRef}
                        type="submit"
                        disabled={!isValid}
                        className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 ${
                          isValid
                            ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-500/50 cursor-pointer font-black text-sm'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-4 h-4 text-emerald-100" />
                        <span>حفظ البند وإضافته للجرد (الكمية: {auditedQty} {selectedUnit})</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          </form>
        ) : null}

      </div>

        {/* Active Audit Session Records Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-3.5 sm:p-5">
        
        {/* Session Meta Header & Column Filter Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">سجل أصناف الجرد الحالي</h3>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs font-bold whitespace-nowrap">
                قيد الإدخال ({activeSession?.records.length || 0} صنف)
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500">
              قائمة البنود والمواد المعاينة في هذا النموذج مقسمة ومجمعة بحسب العمود والرف
            </p>
          </div>

          {/* Session View Controls, Column Filter & Session Title */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                عرض موحد
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                  viewMode === 'grouped'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>تجميع بحسب العمود</span>
              </button>
            </div>

            {/* Column Filter Dropdown */}
            {activeColumns.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-slate-500">العمود:</span>
                <select
                  value={filterColumn}
                  onChange={(e) => setFilterColumn(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">الكل ({activeSession?.records.length || 0})</option>
                  {activeColumns.map((col) => {
                    const count = recordsByColumnMap.get(col)?.length || 0;
                    return (
                      <option key={col} value={col}>
                        عمود {col} ({count} صنف)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {activeSession && activeSession.records.length > 0 && (
              <button
                type="button"
                onClick={handleClearActiveSessionRecords}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs border border-red-200 transition shrink-0"
                title="تفريغ كافة الأصناف المضافة بالجرد الحالي"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تفريغ</span>
              </button>
            )}
          </div>
        </div>

        {/* Audit Table */}
        {!activeSession || activeSession.records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300" />
            <p className="font-bold text-sm text-slate-600">جدول الجرد الحالي فارغ</p>
            <p className="text-xs text-slate-400">ابحث عن الأصناف بالنموذج أعلاه لإضافتها للقائمة وتحديد رقم العمود</p>
          </div>
        ) : (
          <>
            {viewMode === 'grouped' ? (
              /* Grouped View By Column */
              <div className="space-y-6">
                {activeColumns
                  .filter((col) => filterColumn === 'all' || filterColumn === col)
                  .map((col) => {
                    const colRecords = recordsByColumnMap.get(col) || [];
                    const colTotalQty = colRecords.reduce((sum, r) => sum + r.auditedQty, 0);
                    const colTotalCost = colRecords.reduce((sum, r) => sum + r.totalCostValue, 0);
                    const colTotalSelling = colRecords.reduce((sum, r) => sum + r.totalSellingValue, 0);

                    return (
                      <div key={col} className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        {/* Column Sub-header */}
                        <div className="bg-indigo-950 text-white p-3.5 px-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                              {col}
                            </span>
                            <div>
                              <h4 className="font-black text-sm text-white">العمود / الرف رقم: {col}</h4>
                              <p className="text-[11px] text-indigo-200">
                                عدد الأصناف: {colRecords.length} صنف • إجمالي الكمية: {colTotalQty}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <div className="text-right">
                              <span className="text-[10px] text-indigo-300 block">تكلفة العمود:</span>
                              <span className="font-black text-white">{colTotalCost.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-indigo-300 block">بيع العمود:</span>
                              <span className="font-black text-emerald-400">{colTotalSelling.toFixed(2)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedColumnToPrint(col);
                                setIsPrintByColumnModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>طباعة هذا العمود</span>
                            </button>
                          </div>
                        </div>

                        {/* Column Records Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">م</th>
                                <th className="py-2.5 px-3">رقم الصنف</th>
                                <th className="py-2.5 px-3">اسم الصنف</th>
                                <th className="py-2.5 px-3">الباركود</th>
                                <th className="py-2.5 px-3">الوحدة</th>
                                <th className="py-2.5 px-3">تاريخ الانتهاء</th>
                                <th className="py-2.5 px-3">المستخدم المدخل</th>
                                <th className="py-2.5 px-3 text-center bg-amber-100/50">كمية الجرد</th>
                                <th className="py-2.5 px-3 text-center">التكلفة الأولية</th>
                                <th className="py-2.5 px-3 text-center">سعر البيع</th>
                                <th className="py-2.5 px-3 text-center">إجمالي التكلفة</th>
                                <th className="py-2.5 px-3 text-center">إجمالي البيع</th>
                                <th className="py-2.5 px-3 text-center">حذف</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {colRecords.map((rec, index) => (
                                <tr key={rec.id} className="hover:bg-slate-50 transition">
                                  <td className="py-2 px-3 font-bold text-slate-400">{index + 1}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{rec.itemCode}</td>
                                  <td className="py-2 px-3 font-bold text-slate-800 truncate">{rec.itemName}</td>
                                  <td className="py-2 px-3 font-mono text-slate-500">{rec.barcode || '-'}</td>
                                  <td className="py-2 px-3 font-bold text-slate-700">{rec.unit}</td>
                                  <td className="py-2 px-3 font-mono text-slate-600">
                                    {rec.expiryDate === 'غير محدد' ? (
                                      <span className="text-slate-400">غير محدد</span>
                                    ) : (
                                      <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                        {rec.expiryDate}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-slate-800 font-bold whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 text-[11px]">
                                      <User className="w-3 h-3 text-sky-600 shrink-0" />
                                      <span>{rec.createdBy || auditorName || 'مسؤول الجرد'}</span>
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center font-black text-slate-900 bg-amber-50/50">
                                    {rec.auditedQty}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-600">{rec.initialCost.toFixed(2)}</td>
                                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">{rec.sellingPrice.toFixed(2)}</td>
                                  <td className="py-2 px-3 text-center font-bold text-slate-900">{rec.totalCostValue.toFixed(2)}</td>
                                  <td className="py-2 px-3 text-center font-bold text-emerald-600">{rec.totalSellingValue.toFixed(2)}</td>
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      onClick={() => handleRemoveRecord(rec.id)}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition"
                                      title="حذف البند"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* All Records Unified Table */
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-200 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">م</th>
                      <th className="py-3 px-3 text-center bg-indigo-900/60 text-indigo-200">العمود</th>
                      <th className="py-3 px-3">رقم الصنف</th>
                      <th className="py-3 px-3">اسم الصنف</th>
                      <th className="py-3 px-3">الباركود</th>
                      <th className="py-3 px-3">الوحدة</th>
                      <th className="py-3 px-3">تاريخ الانتهاء</th>
                      <th className="py-3 px-3">المستخدم المدخل</th>
                      <th className="py-3 px-3 text-center bg-amber-900/40">كمية الجرد</th>
                      <th className="py-3 px-3 text-center">التكلفة الأولية</th>
                      <th className="py-3 px-3 text-center">سعر البيع</th>
                      <th className="py-3 px-3 text-center">إجمالي التكلفة</th>
                      <th className="py-3 px-3 text-center">إجمالي البيع</th>
                      <th className="py-3 px-3 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((rec, index) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{index + 1}</td>
                        <td className="py-2.5 px-3 text-center font-black text-indigo-700 bg-indigo-50/60 rounded">
                          {rec.columnNo || '1'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{rec.itemCode}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 truncate">{rec.itemName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{rec.barcode || '-'}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">{rec.unit}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {rec.expiryDate === 'غير محدد' ? (
                            <span className="text-slate-400">غير محدد</span>
                          ) : (
                            <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200">
                              {rec.expiryDate}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-bold whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 text-[11px]">
                            <User className="w-3 h-3 text-sky-600 shrink-0" />
                            <span>{rec.createdBy || auditorName || 'مسؤول الجرد'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-slate-900 bg-amber-50/50 text-sm">
                          {rec.auditedQty}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{rec.initialCost.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{rec.sellingPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">{rec.totalCostValue.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{rec.totalSellingValue.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleRemoveRecord(rec.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition"
                            title="حذف البند"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Session Summary Totals Footer */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="grid grid-cols-3 gap-6 text-center md:text-right w-full md:w-auto">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">مجموع الكميات المجرودة</span>
                  <span className="text-xl font-black text-amber-400">{totalAuditedQty}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">إجمالي التكلفة الأولية</span>
                  <span className="text-xl font-black text-white">{totalCostSum.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">إجمالي قيمة البيع</span>
                  <span className="text-xl font-black text-emerald-400">{totalSellingSum.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsFullReportModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
                >
                  <Eye className="w-4 h-4" />
                  <span>استعراض تقرير المجرود</span>
                </button>

                <button
                  onClick={() => exportAuditSessionToExcel(activeSession, `جرد_${sessionTitle}.xlsx`)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <span>تصدير لإكسل</span>
                </button>

                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>اعتماد وحفظ الجرد</span>
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  </div>
  </div>

      {/* Comprehensive Report & Preview Modal (استعراض وطباعة تقرير جميع المجرود) */}
      {isFullReportModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
          <div id="printable-full-audit-report" className="bg-white rounded-3xl max-w-5xl w-full p-3 sm:p-5 shadow-2xl border border-slate-200 space-y-3 sm:space-y-4 my-4 print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:max-w-none">
            
            {/* Modal Header (Hidden on Print) */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {filterColumn === 'all' ? 'تقرير جميع المجرودات الشامل' : `تقرير المجرود - عمود رقم ${filterColumn}`}
                  </h3>
                  <p className="text-xs text-slate-500">معاينة تفصيلية للمواد والأصناف المجرودة مجمعة ومقسمة بحسب العمود</p>
                </div>
              </div>
              <button
                onClick={() => setIsFullReportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Report Content */}
            <div className="space-y-3 print:space-y-2">
              
              {/* Summary Stats Grid (Screen Only) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print print:hidden">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs text-slate-500 block font-bold">مجموع أصناف التقرير</span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">{filteredRecords.length}</span>
                </div>
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
                  <span className="text-xs text-amber-800 block font-bold">إجمالي الكميات</span>
                  <span className="text-xl font-black text-amber-700 mt-1 block">
                    {fmtQty(filteredRecords.reduce((sum, r) => sum + r.auditedQty, 0))}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs text-slate-500 block font-bold">إجمالي التكلفة</span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    {fmtMoney(filteredRecords.reduce((sum, r) => sum + (r.totalCostValue || (r.auditedQty * r.initialCost)), 0))}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
                  <span className="text-xs text-emerald-800 block font-bold">إجمالي قيمة البيع</span>
                  <span className="text-xl font-black text-emerald-700 mt-1 block">
                    {fmtMoney(filteredRecords.reduce((sum, r) => sum + (r.totalSellingValue || (r.auditedQty * r.sellingPrice)), 0))}
                  </span>
                </div>
              </div>

              {/* Column Breakdown Summary Table (Screen Only) */}
              {filterColumn === 'all' && (
                <div className="space-y-2 no-print print:hidden">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Grid className="w-4 h-4 text-indigo-600" />
                    <span>ملخص التجميع بحسب العمود / الرف</span>
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-indigo-950 text-white font-bold">
                        <tr>
                          <th className="py-2.5 px-3">رقم العمود</th>
                          <th className="py-2.5 px-3 text-center">عدد الأصناف</th>
                          <th className="py-2.5 px-3 text-center">مجموع الكمية</th>
                          <th className="py-2.5 px-3 text-center">إجمالي التكلفة</th>
                          <th className="py-2.5 px-3 text-center">إجمالي البيع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {activeColumns.map((col) => {
                          const recs = recordsByColumnMap.get(col) || [];
                          const q = recs.reduce((sum, r) => sum + r.auditedQty, 0);
                          const c = recs.reduce((sum, r) => sum + r.totalCostValue, 0);
                          const s = recs.reduce((sum, r) => sum + r.totalSellingValue, 0);
                          return (
                            <tr key={col} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-black text-indigo-700">عمود رقم {col}</td>
                              <td className="py-2 px-3 text-center font-bold">{recs.length}</td>
                              <td className="py-2 px-3 text-center font-black text-amber-700 bg-amber-50/40">{fmtQty(q)}</td>
                              <td className="py-2 px-3 text-center font-bold text-slate-800">{fmtMoney(c)}</td>
                              <td className="py-2 px-3 text-center font-bold text-emerald-700">{fmtMoney(s)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full Itemized Audit List - Requested Columns */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 no-print print:hidden">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>جدول تفاصيل الأصناف المجرودة</span>
                  </h4>
                </div>

                {/* Print & Preview Controls Toolbar (شريط خيارات الطباعة والاستعراض) */}
                <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 space-y-2.5 no-print print:hidden my-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-extrabold text-xs">خيارات الطباعة والاستعراض:</span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setShowCost(true); setShowSellingPrice(true); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          showCost && showSellingPrice
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                        <span>طباعة مع التكلفة والسعر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowCost(false); setShowSellingPrice(true); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          !showCost && showSellingPrice
                            ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span>بدون تكلفة (سعر البيع فقط)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowCost(false); setShowSellingPrice(false); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          !showCost && !showSellingPrice
                            ? 'bg-rose-500 text-white font-black shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span>طباعة بدون (كميات فقط)</span>
                      </button>
                    </div>
                  </div>

                  {/* Individual Checkbox Toggles */}
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/80 text-xs font-bold">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showCost}
                        onChange={(e) => setShowCost(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-800 border-slate-700 cursor-pointer"
                      />
                      <span className={showCost ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        إظهار أعمدة التكلفة الأولية وإجمالي التكلفة
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showSellingPrice}
                        onChange={(e) => setShowSellingPrice(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-800 border-slate-700 cursor-pointer"
                      />
                      <span className={showSellingPrice ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        إظهار أعمدة سعر البيع وإجمالي البيع
                      </span>
                    </label>
                  </div>
                </div>

                <div className="border-2 border-slate-700 rounded-xl overflow-x-auto print:overflow-visible shadow-none my-2 bg-white">
                  <table className="w-full text-right text-xs border-collapse border border-slate-700">
                    <thead className="print:table-header-group">
                      {/* Report Header & Document Info (Repeated on every page when printed) */}
                      <tr className="border-none bg-white">
                        <td colSpan={15} className="p-0 border-none pb-1 text-right bg-white font-normal">
                          <div className="bg-white space-y-1 my-1">
                            <ReportHeader
                              reportTitle={filterColumn === 'all' ? 'بيانات التقرير الشامل' : `تقرير الجرد - عمود ${filterColumn}`}
                              reportDate={activeSession.date}
                              onOpenSettings={() => setIsHeaderSettingsModalOpen(true)}
                            />

                            {/* بيانات التقرير - Report Information Block */}
                            <div className="bg-slate-50 border border-slate-300 rounded-lg p-1.5 px-2 text-xs space-y-1 print:bg-white print:border-slate-400 my-1">
                              <div className="grid grid-cols-2 gap-1.5 text-slate-800">
                                {/* تاريخ */}
                                <div className="bg-white py-1 px-2 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                  <span className="text-slate-500 font-bold text-[11px] shrink-0 whitespace-nowrap">التاريخ:</span>
                                  <span className="font-mono font-bold text-slate-900 text-xs whitespace-nowrap">{activeSession.date}</span>
                                </div>

                                {/* نوع السند */}
                                <div className="bg-white py-1 px-2 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                  <span className="text-slate-500 font-bold text-[11px] shrink-0 whitespace-nowrap">نوع السند:</span>
                                  <input
                                    type="text"
                                    value={voucherType}
                                    onChange={(e) => setVoucherType(e.target.value)}
                                    className="w-full font-bold text-indigo-900 text-xs bg-transparent border-none p-0 focus:ring-0 text-left print:border-none whitespace-nowrap"
                                    placeholder="نوع السند"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Column titles - Repeated cleanly on top of each page if report spans multiple pages */}
                      <tr className="bg-[#c2d7ed] text-slate-900 font-bold border-b-2 border-slate-700 print:bg-[#c2d7ed]">
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">مـ</th>
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">رقم الصنف</th>
                        <th className="py-1.5 px-1.5 border border-slate-700 text-right font-bold bg-[#c2d7ed] min-w-[140px] text-[11px]">اسم الصنف</th>
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الوحدة</th>
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">تاريخ الانتهاء</th>
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الكمية</th>
                        {showCost && (
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">التكلفة</th>
                        )}
                        {showSellingPrice && (
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">السعر</th>
                        )}
                        {showCost && (
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">اجمالي التكلفة</th>
                        )}
                        {showSellingPrice && (
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">اجمالي السعر</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white print:table-row-group">
                      {filteredRecords.map((rec, index) => {
                        const totalCost = rec.totalCostValue || round2(rec.auditedQty * rec.initialCost);
                        const totalSelling = rec.totalSellingValue || round2(rec.auditedQty * rec.sellingPrice);
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50 break-inside-avoid print:break-inside-avoid">
                            <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-800 whitespace-nowrap text-[11px]">{index + 1}</td>
                            <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.itemCode}</td>
                            <td className="py-1 px-1.5 border border-slate-700 font-bold text-right text-slate-900 whitespace-nowrap text-[11px]">{rec.itemName}</td>
                            <td className="py-1 px-1.5 border border-slate-700 font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.unit}</td>
                            <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.expiryDate || '-'}</td>
                            <td className="py-1 px-1.5 border border-slate-700 text-center font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">{fmtQty(rec.auditedQty)}</td>
                            {showCost && (
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-mono text-slate-900 whitespace-nowrap text-[11px]">{fmtMoney(rec.initialCost)}</td>
                            )}
                            {showSellingPrice && (
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-mono text-slate-900 whitespace-nowrap text-[11px]">{fmtMoney(rec.sellingPrice)}</td>
                            )}
                            {showCost && (
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">{fmtMoney(totalCost)}</td>
                            )}
                            {showSellingPrice && (
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">{fmtMoney(totalSelling)}</td>
                            )}
                          </tr>
                        );
                      })}
                      {/* Total Row & Summary Block inside tbody */}
                      {(() => {
                        const totalQtySum = filteredRecords.reduce((sum, r) => sum + r.auditedQty, 0);
                        const totalCostSum = filteredRecords.reduce((sum, r) => sum + (r.totalCostValue || (r.auditedQty * r.initialCost)), 0);
                        const totalSellingSum = filteredRecords.reduce((sum, r) => sum + (r.totalSellingValue || (r.auditedQty * r.sellingPrice)), 0);
                        const colSpanCount = 6 + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0);

                        return (
                          <>
                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-700 text-slate-900 break-inside-avoid print:break-inside-avoid">
                              <td colSpan={5} className="py-1 px-1.5 border border-slate-700 text-left font-black whitespace-nowrap text-[11px]">الإجمالي:</td>
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtQty(totalQtySum)}</td>
                              {showCost && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-mono text-slate-500 whitespace-nowrap text-[11px]">-</td>
                              )}
                              {showSellingPrice && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-mono text-slate-500 whitespace-nowrap text-[11px]">-</td>
                              )}
                              {showCost && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtMoney(totalCostSum)}</td>
                              )}
                              {showSellingPrice && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtMoney(totalSellingSum)}</td>
                              )}
                            </tr>
                            {/* Totals Summary Box before bottom footer bar */}
                            <tr className="break-inside-avoid print:break-inside-avoid">
                              <td colSpan={colSpanCount} className="p-0 border-0 pt-2">
                                <div className="w-full border border-black bg-slate-50 p-2.5 text-xs space-y-1.5 my-1 text-black font-bold">
                                  <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                    <span>عدد الاصناف :</span>
                                    <span className="font-mono font-black text-sm">{filteredRecords.length}</span>
                                  </div>
                                  <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                    <span>إجمالي الكمية المجرودة :</span>
                                    <span className="font-mono font-black text-sm text-indigo-900">{fmtQty(totalQtySum)}</span>
                                  </div>
                                  {showCost && (
                                    <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                      <span>إجمالي التكلفة حسب المخزن :</span>
                                      <span className="font-mono font-black text-sm">{fmtMoney(totalCostSum)}</span>
                                    </div>
                                  )}
                                  {showSellingPrice && (
                                    <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                      <span>إجمالي قيمة البيع :</span>
                                      <span className="font-mono font-black text-sm">{fmtMoney(totalSellingSum)}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                    <TableReportFooter
                      colSpan={6 + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0)}
                      printedBy={auditorName || 'مدير النظام'}
                      totalItemsCount={filteredRecords.length}
                    />
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Actions Footer (Hidden on Print) */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 print:hidden">
              <button
                type="button"
                onClick={() => setIsFullReportModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
              >
                إغلاق
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportAuditSessionToExcel(activeSession, `تقرير_جرد_${sessionTitle}.xlsx`)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <span>تصدير لإكسل</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsGeneratingPdf(true);
                    await exportElementToPDF('printable-full-audit-report', `تقرير_جرد_${sessionTitle}`);
                    setIsGeneratingPdf(false);
                  }}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md shadow-rose-600/20"
                  title="تصدير وتحميل التقرير كملف PDF مباشر"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 text-rose-200 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 text-rose-200" />
                  )}
                  <span>{isGeneratingPdf ? 'جاري تجهيز PDF...' : 'تصدير PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer"
                  title="فتح نافذة الطباعة أو الحفظ بتنسيق PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة / حفظ PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Print By Column Modal (طباعة بحسب العمود) */}
      {isPrintByColumnModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Columns className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">طباعة الجرد بحسب رقم العمود</h3>
                  <p className="text-xs text-slate-500">اختر عموداً محدداً لطباعة تقرير الأصناف والمواد المتواجدة فيه فقط</p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintByColumnModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Select Column Control */}
            <div className="space-y-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
              <label className="block text-xs font-bold text-slate-800">
                اختر العمود أو الرف المراد طباعته:
              </label>
              <select
                value={selectedColumnToPrint}
                onChange={(e) => setSelectedColumnToPrint(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 font-bold text-slate-900 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">-- طباعة كافة الأعمدة (تقرير مقسم) --</option>
                {activeColumns.map((col) => {
                  const count = recordsByColumnMap.get(col)?.length || 0;
                  return (
                    <option key={col} value={col}>
                      العمود رقم {col} (يحتوي على {count} صنف)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Column Preview Metrics */}
            {selectedColumnToPrint !== 'all' && recordsByColumnMap.has(selectedColumnToPrint) && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-700">معاينة عمود رقم {selectedColumnToPrint}:</h4>
                {(() => {
                  const recs = recordsByColumnMap.get(selectedColumnToPrint) || [];
                  const q = recs.reduce((s, r) => s + r.auditedQty, 0);
                  const sel = recs.reduce((s, r) => s + r.totalSellingValue, 0);
                  return (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">عدد الأصناف</span>
                        <span className="font-black text-slate-900">{recs.length} صنف</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">إجمالي الكمية</span>
                        <span className="font-black text-amber-600">{q}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">إجمالي البيع</span>
                        <span className="font-black text-emerald-600">{sel.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPrintByColumnModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedColumnToPrint !== 'all') {
                    setFilterColumn(selectedColumnToPrint);
                  } else {
                    setFilterColumn('all');
                  }
                  setIsPrintByColumnModalOpen(false);
                  setIsFullReportModalOpen(true);
                  setTimeout(() => window.print(), 300);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة تقرير العمود</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Audit Approval & Confirmation Modal */}
      {isConfirmModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">اعتماد وحفظ نموذج الجرد</h3>
                  <p className="text-xs text-slate-500">تأكيد إغلاق عملية الجرد وإضافتها للتقارير والسجلات</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Info & Financial Totals */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-200/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                <span>عنوان الجرد: {sessionTitle}</span>
                <span>تاريخ الجرد: {activeSession.date}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-bold">عدد الأصناف</span>
                  <span className="text-base font-black text-slate-900">{activeSession.records.length} صنف</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-bold">مجموع الكميات</span>
                  <span className="text-base font-black text-amber-600">{totalAuditedQty}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-bold">إجمالي التكلفة</span>
                  <span className="text-base font-black text-emerald-600">{totalCostSum.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>عند اعتماد الجرد، سيتم إغلاق هذا النموذج وحفظه كأرشيف جرد مكتمل مع إمكانية طباعته وتصديره لإكسل بأي وقت.</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmFinishAudit}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد واعتماد الجرد النهائي</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Dark Unit Selection Modal Popup (Matching User Screenshot 2) */}
      {isUnitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isGhostClick('unit')) {
              setIsUnitModalOpen(false);
            }
          }}
        >
          <div
            className="bg-[#24262B] text-white rounded-3xl max-w-sm w-full p-4 shadow-2xl border border-zinc-700/80 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-700/60 pb-2.5 px-1">
              <div>
                <span className="text-xs font-bold text-zinc-400">اختر الوحدة للصنف</span>
                {selectedItem && (
                  <p className="text-sm font-black text-emerald-400 mt-0.5">{selectedItem.name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {linkedUnits.map((u) => {
                const isSelected = selectedUnit === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleSelectUnitFromModal(u)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition text-right ${
                      isSelected
                        ? 'bg-zinc-800 border border-blue-500/50'
                        : 'hover:bg-zinc-800/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'border-blue-400 bg-blue-500/20' : 'border-zinc-500'
                        }`}
                      >
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />}
                      </div>
                    </div>
                    <span className="text-white text-xl font-black tracking-wide mr-3">{u}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick manual unit input in dark modal */}
            <div className="pt-2 border-t border-zinc-700/60 space-y-1.5">
              <label className="block text-[11px] text-zinc-400 font-bold">أو أدخل وحدة جديدة للصنف:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="مثال: علبة، درزن..."
                  className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newUnitName.trim()) {
                      handleAddNewUnitToItem();
                      handleSelectUnitFromModal(newUnitName.trim());
                      setNewUnitName('');
                    }
                  }}
                  disabled={!newUnitName.trim()}
                  className="px-4 py-1.5 bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl hover:bg-emerald-500 transition cursor-pointer"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dark Expiry Date Selection Modal Popup (Matching User Screenshot 1) */}
      {isExpiryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isGhostClick('expiry')) {
              setIsExpiryModalOpen(false);
            }
          }}
        >
          <div
            className="bg-[#24262B] text-white rounded-3xl max-w-sm w-full p-4 shadow-2xl border border-zinc-700/80 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-700/60 pb-2 px-1">
              <span className="text-xs font-bold text-zinc-400">تاريخ الانتهاء</span>
              <button
                type="button"
                onClick={() => setIsExpiryModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {/* Option 1: "-- اختر التاريخ المسجل --" */}
              <button
                type="button"
                onClick={() => handleSelectExpiryFromModal('')}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition text-right ${
                  expiryDate === ''
                    ? 'bg-zinc-800 border border-blue-500/50'
                    : 'hover:bg-zinc-800/70 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-center">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      expiryDate === '' ? 'border-blue-400 bg-blue-500/20' : 'border-zinc-500'
                    }`}
                  >
                    {expiryDate === '' && <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />}
                  </div>
                </div>
                <span className="text-white text-lg font-bold mr-3">-- اختر التاريخ المسجل --</span>
              </button>

              <div className="border-t border-zinc-700/60 my-1" />

              {/* Options from availableExpiryDates */}
              {availableExpiryDates.length > 0 ? (
                availableExpiryDates.map((d) => {
                  const isSelected = expiryDate === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleSelectExpiryFromModal(d)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition text-right ${
                        isSelected
                          ? 'bg-zinc-800 border border-blue-500/50'
                          : 'hover:bg-zinc-800/70 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'border-blue-400 bg-blue-500/20' : 'border-zinc-500'
                          }`}
                        >
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />}
                        </div>
                      </div>
                      <span className="text-white text-xl font-black tracking-wide mr-3 dir-ltr">
                        {d}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-zinc-400">
                  لا توجد تواريخ مسجلة سابقة لهذا الصنف
                </div>
              )}
            </div>

            {/* Quick manual date input */}
            <div className="pt-2 border-t border-zinc-700/60 space-y-1.5">
              <label className="block text-[11px] text-zinc-400 font-bold">أو ادخل تاريخاً يدوياً (مثال: 01012028):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={expiryDate}
                  onChange={(e) => handleManualDateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSelectExpiryFromModal(expiryDate);
                    }
                  }}
                  placeholder="01/01/2028..."
                  className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSelectExpiryFromModal(expiryDate)}
                  disabled={!expiryDate.trim()}
                  className="px-4 py-1.5 bg-blue-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
                >
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dark Quantity Input Modal Popup */}
      {isQuantityModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isGhostClick('quantity')) {
              setIsQuantityModalOpen(false);
            }
          }}
        >
          <div
            className="bg-[#24262B] text-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-zinc-700/80 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-700/60 pb-3">
              <span className="text-sm font-black text-emerald-400">إدخال كمية الجرد الحقيقية</span>
              <button
                type="button"
                onClick={() => setIsQuantityModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected item context info */}
            {selectedItem && (
              <div className="bg-zinc-800/90 rounded-2xl p-3 border border-zinc-700/60 text-right text-xs space-y-1">
                <div className="font-bold text-white text-sm">{selectedItem.name}</div>
                <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                  <span>الوحدة: <strong className="text-emerald-400">{selectedUnit || selectedItem.unit}</strong></span>
                  <span>الانتهاء: <strong className="text-blue-400">{expiryDate || 'غير محدد'}</strong></span>
                </div>
              </div>
            )}

            {/* Quantity Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeAddAuditRecord();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2 text-right">أدخل الكمية المجرودة:</label>
                <input
                  ref={modalQtyInputRef}
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  autoFocus
                  value={auditedQty}
                  onChange={(e) =>
                    setAuditedQty(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0"
                  className="w-full text-center text-3xl font-black py-3 px-4 rounded-2xl bg-zinc-900 border-2 border-emerald-500 text-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 tracking-wider"
                />
              </div>



              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={!auditedQty || Number(auditedQty) <= 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-base rounded-2xl shadow-lg transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>حفظ وإضافة للجرد</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(scannedCode) => {
          const cleanCode = scannedCode.trim();
          setSearchTerm(cleanCode);
          const lower = cleanCode.toLowerCase();
          const matchObj = itemMaps.barcodeMap.get(lower);
          const codeMatch = !matchObj ? itemMaps.codeMap.get(lower) : null;

          if (matchObj) {
            handleSelectItem(matchObj.item);
            if (matchObj.unit) {
              setSelectedUnit(matchObj.unit);
            }
          } else if (codeMatch) {
            handleSelectItem(codeMatch);
          } else {
            const fallback = items.find((i) => itemMatchesQuery(i, cleanCode));
            if (fallback) {
              handleSelectItem(fallback);
            } else {
              alert(`تم مسح الباركود بنجاح: (${cleanCode})، ولكن لم يتم العثور على صنف مطابق بملف البيانات.`);
            }
          }
        }}
      />

      {/* Report Header & Logo Customization Settings Modal */}
      <ReportHeaderSettingsModal
        isOpen={isHeaderSettingsModalOpen}
        onClose={() => setIsHeaderSettingsModalOpen(false)}
        onSave={() => {}}
      />

    </div>
  );
};
