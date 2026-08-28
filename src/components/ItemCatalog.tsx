import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Item, ItemUnitDetail } from '../types';
import {
  Search,
  Plus,
  FileDown,
  Printer,
  Edit2,
  Trash2,
  DollarSign,
  Barcode,
  Layers,
  ArrowUpDown,
  SlidersHorizontal,
  Check,
  X,
  AlertTriangle,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Camera,
  Globe,
  Tag,
  ShieldCheck,
  FileText,
  Loader2,
  Sparkles
} from 'lucide-react';
import { exportItemsToExcel } from '../utils/excelUtils';
import { exportElementToPDF } from '../utils/pdfUtils';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { ReportHeader, ReportFooter, TableReportFooter, ReportHeaderSettingsModal } from './ReportHeader';
import {
  getItemUnits,
  getItemUnitDetails,
  getUnitPricing,
  getItemBarcodes,
  getItemForeignNames,
  itemMatchesQuery
} from '../utils/unitUtils';
import { PriceUpdateModal } from './PriceUpdateModal';
import { hasUserPermission } from '../utils/userUtils';
import { useBackButtonClose } from '../hooks/useBackButtonClose';

interface ItemCatalogProps {
  items: Item[];
  currentUser?: { username: string; role?: string; permissions?: string[] } | null;
  onAddItem: (item: Item) => void;
  onUpdateItem: (item: Item) => void;
  onDeleteItem: (id: string) => void;
  onDeleteMultipleItems?: (ids: string[]) => void;
  onClearAllItems?: () => void;
  onBatchPriceUpdate: (percent: number, priceType: 'initialCost' | 'price' | 'sellingPrice') => void;
  onNavigateToImport: () => void;
}

const arCollator = new Intl.Collator('ar', { numeric: true });

export const ItemCatalog: React.FC<ItemCatalogProps> = ({
  items,
  currentUser,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onDeleteMultipleItems,
  onClearAllItems,
  onBatchPriceUpdate,
  onNavigateToImport
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isHeaderSettingsModalOpen, setIsHeaderSettingsModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [sortBy, setSortBy] = useState<'code' | 'name' | 'initialCost' | 'sellingPrice'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination state for handling large datasets (e.g. 50,000+ items)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50); // 50 items per page default

  // Selected item IDs for multi-delete
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Deletion Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk' | 'clearAll';
    itemToDelete?: Item | null;
  }>({
    isOpen: false,
    type: 'single',
    itemToDelete: null
  });

  // Selected item for modal edits
  const [selectedItemForPrice, setSelectedItemForPrice] = useState<Item | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isBatchPriceOpen, setIsBatchPriceOpen] = useState(false);

  // Quick Inline Edit State
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineData, setInlineData] = useState<Partial<Item>>({});

  // Comprehensive Add/Edit Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [catalogScannerTarget, setCatalogScannerTarget] = useState<'primary' | number | null>(null);

  // Register mobile back button handlers for modals & camera scanner
  useBackButtonClose(isScannerOpen, () => setIsScannerOpen(false));
  useBackButtonClose(isAddModalOpen, () => setIsAddModalOpen(false));
  useBackButtonClose(isPriceModalOpen, () => setIsPriceModalOpen(false));
  useBackButtonClose(isBatchPriceOpen, () => setIsBatchPriceOpen(false));
  useBackButtonClose(isHeaderSettingsModalOpen, () => setIsHeaderSettingsModalOpen(false));
  useBackButtonClose(catalogScannerTarget !== null, () => setCatalogScannerTarget(null));
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formForeignName, setFormForeignName] = useState('');
  const [formForeignNames, setFormForeignNames] = useState<string[]>([]);
  const [formBarcode, setFormBarcode] = useState('');
  const [formBarcodes, setFormBarcodes] = useState<string[]>([]);
  const [formUnitDetails, setFormUnitDetails] = useState<ItemUnitDetail[]>([
    { unit: 'حبة', sellingPrice: 0, initialCost: 0, barcode: '', pack: '1' }
  ]);
  const [formCodeError, setFormCodeError] = useState<string | null>(null);

  const canEditItems = hasUserPermission(currentUser, 'edit_items');
  const canDeleteItems = hasUserPermission(currentUser, 'delete_items');

  // Helper to open modal for adding
  const openAddModal = () => {
    if (!canEditItems) {
      alert('عذراً، ليس لديك صلاحية إضافة وتعديل الأصناف والأسعار.');
      return;
    }
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormForeignName('');
    setFormForeignNames([]);
    setFormBarcode('');
    setFormBarcodes([]);
    setFormUnitDetails([
      { unit: 'حبة', sellingPrice: 0, initialCost: 0, barcode: '', pack: '1' }
    ]);
    setFormCodeError(null);
    setIsAddModalOpen(true);
  };

  // Helper to open modal for editing an item
  const openEditModal = (item: Item) => {
    if (!canEditItems) {
      alert('عذراً، ليس لديك صلاحية تعديل الأصناف والأسعار.');
      return;
    }
    setEditingItem(item);
    setFormCode(item.code || '');
    setFormName(item.name || '');
    setFormForeignName(item.foreignName || '');
    const fnList = Array.isArray(item.foreignNames) ? item.foreignNames : (item.foreignNames ? [item.foreignNames] : []);
    setFormForeignNames(fnList.filter((fn) => fn !== item.foreignName));
    setFormBarcode(item.barcode || '');
    const bcList = Array.isArray(item.barcodes) ? item.barcodes : (item.barcodes ? [item.barcodes] : []);
    setFormBarcodes(bcList.filter((bc) => bc !== item.barcode));
    const details = getItemUnitDetails(item);
    setFormUnitDetails(
      details.length > 0
        ? details
        : [{ unit: item.unit || 'حبة', sellingPrice: item.sellingPrice || 0, initialCost: item.initialCost || 0, barcode: item.barcode || '', pack: item.pack || '1' }]
    );
    setFormCodeError(null);
    setIsAddModalOpen(true);
  };

  // Reset page to 1 whenever search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, sortBy, sortOrder, pageSize]);

  // High-performance Filter and Sort items
  const filteredItems = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase().trim();

    let list = items;
    if (query) {
      list = items.filter((item) => itemMatchesQuery(item, query));
    }

    return [...list].sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA);
      const strB = String(valB);
      return sortOrder === 'asc'
        ? arCollator.compare(strA, strB)
        : arCollator.compare(strB, strA);
    });
  }, [items, deferredSearchQuery, sortBy, sortOrder]);

  // Calculate Pagination Slices
  const isAllPages = pageSize === -1;
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = isAllPages ? 1 : Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    if (isAllPages) return filteredItems;
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize, isAllPages]);

  // Financial Stats (Calculated on whole dataset)
  const totalCostVal = useMemo(
    () => items.reduce((sum, item) => sum + (item.initialCost || 0), 0),
    [items]
  );
  const totalRetailVal = useMemo(
    () => items.reduce((sum, item) => sum + (item.sellingPrice || 0), 0),
    [items]
  );

  // High-performance Checkbox Selection logic (O(1) Set lookups)
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  const isCurrentPageSelected = useMemo(() => {
    if (paginatedItems.length === 0) return false;
    return paginatedItems.every((item) => selectedSet.has(item.id));
  }, [paginatedItems, selectedSet]);

  const toggleSelectCurrentPage = () => {
    if (isCurrentPageSelected) {
      const pageIds = new Set(paginatedItems.map((i) => i.id));
      setSelectedItemIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginatedItems.map((i) => i.id);
      setSelectedItemIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedItemIds(filteredItems.map((i) => i.id));
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      selectedSet.has(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Open Delete Modal Helpers
  const requestDeleteSingle = (item: Item) => {
    setDeleteModal({
      isOpen: true,
      type: 'single',
      itemToDelete: item
    });
  };

  const requestDeleteBulk = () => {
    if (selectedItemIds.length === 0) return;
    setDeleteModal({
      isOpen: true,
      type: 'bulk',
      itemToDelete: null
    });
  };

  const requestClearAll = () => {
    if (items.length === 0) return;
    setDeleteModal({
      isOpen: true,
      type: 'clearAll',
      itemToDelete: null
    });
  };

  // Execute Deletion
  const handleConfirmDelete = () => {
    if (deleteModal.type === 'single' && deleteModal.itemToDelete) {
      onDeleteItem(deleteModal.itemToDelete.id);
      setSelectedItemIds((prev) => prev.filter((id) => id !== deleteModal.itemToDelete?.id));
    } else if (deleteModal.type === 'bulk') {
      if (onDeleteMultipleItems) {
        onDeleteMultipleItems(selectedItemIds);
      } else {
        selectedItemIds.forEach((id) => onDeleteItem(id));
      }
      setSelectedItemIds([]);
    } else if (deleteModal.type === 'clearAll') {
      if (onClearAllItems) {
        onClearAllItems();
      } else {
        items.forEach((i) => onDeleteItem(i.id));
      }
      setSelectedItemIds([]);
    }
    setDeleteModal({ isOpen: false, type: 'single', itemToDelete: null });
  };

  const handleStartInlineEdit = (item: Item) => {
    setInlineEditingId(item.id);
    setInlineData({
      initialCost: item.initialCost,
      price: item.price,
      sellingPrice: item.sellingPrice
    });
  };

  const handleSaveInlineEdit = (item: Item) => {
    onUpdateItem({
      ...item,
      initialCost: Number(inlineData.initialCost ?? item.initialCost),
      price: Number(inlineData.price ?? item.price),
      sellingPrice: Number(inlineData.sellingPrice ?? item.sellingPrice),
      lastUpdated: new Date().toISOString()
    });
    setInlineEditingId(null);
  };

  const handleItemFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = formCode.trim();
    const trimmedName = formName.trim();

    if (!trimmedCode || !trimmedName) return;

    // Check code conflict: Only flag if code is used by a DIFFERENT item (different name) when adding new item
    const codeConflict = items.find(
      (i) =>
        i.code.trim().toLowerCase() === trimmedCode.toLowerCase() &&
        i.id !== editingItem?.id &&
        i.name.trim().toLowerCase() !== trimmedName.toLowerCase()
    );

    if (codeConflict && !editingItem) {
      setFormCodeError(`رقم الصنف (${trimmedCode}) مسجل بالفعل لصنف آخر بعنوان "${codeConflict.name}". يرجى اختيار رقم كود آخر غير مكرر لصنف مختلف.`);
      return;
    }

    // Process foreign names list
    const allForeignNames = Array.from(
      new Set([formForeignName.trim(), ...formForeignNames.map((f) => f.trim())].filter(Boolean))
    );

    // Process barcodes list
    const allBarcodes = Array.from(
      new Set([formBarcode.trim(), ...formBarcodes.map((b) => b.trim())].filter(Boolean))
    );

    // Filter valid unit details
    const validUnitDetails = formUnitDetails
      .filter((ud) => ud.unit && ud.unit.trim())
      .map((ud) => ({
        unit: ud.unit.trim(),
        sellingPrice: Number(ud.sellingPrice) || 0,
        initialCost: Number(ud.initialCost) || 0,
        barcode: ud.barcode?.trim() || '',
        pack: ud.pack || '1'
      }));

    const primaryUnitDetail = validUnitDetails[0] || {
      unit: 'حبة',
      sellingPrice: 0,
      initialCost: 0,
      barcode: '',
      pack: '1'
    };

    const savedItem: Item = {
      id: editingItem ? editingItem.id : `item-${Date.now()}`,
      code: trimmedCode,
      name: trimmedName,
      foreignName: allForeignNames[0] || '',
      foreignNames: allForeignNames,
      unit: primaryUnitDetail.unit,
      units: validUnitDetails.map((ud) => ud.unit),
      unitDetails: validUnitDetails,
      barcode: allBarcodes[0] || primaryUnitDetail.barcode || '',
      barcodes: allBarcodes,
      pack: primaryUnitDetail.pack || '1',
      initialCost: primaryUnitDetail.initialCost,
      price: primaryUnitDetail.initialCost,
      sellingPrice: primaryUnitDetail.sellingPrice,
      lastUpdated: new Date().toISOString()
    };

    if (editingItem) {
      onUpdateItem(savedItem);
    } else {
      onAddItem(savedItem);
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      
      {/* Official Header Template (Screen Only - Print version is inside table thead) */}
      <div className="no-print print:hidden">
        <ReportHeader
          reportTitle="بيانات المخزون"
          onOpenSettings={() => setIsHeaderSettingsModalOpen(true)}
        />
      </div>

      {/* KPI Cards & Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 no-print print:hidden">
        
        <div className="bg-white p-0.5 sm:p-1 rounded border border-slate-200/80 shadow-2xs flex items-center gap-1">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <Layers className="w-2.5 h-2.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[8.5px] font-bold text-slate-500 truncate leading-none">إجمالي الأصناف</p>
            <h3 className="text-[10px] sm:text-[11px] font-black text-slate-900 truncate leading-none mt-0.5">{items.length}</h3>
          </div>
        </div>

        <div className="bg-white p-0.5 sm:p-1 rounded border border-slate-200/80 shadow-2xs flex items-center gap-1">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-2.5 h-2.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[8.5px] font-bold text-slate-500 truncate leading-none">إجمالي التكلفة</p>
            <h3 className="text-[10px] sm:text-[11px] font-black text-slate-900 truncate leading-none mt-0.5">
              {totalCostVal.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-0.5 sm:p-1 rounded border border-slate-200/80 shadow-2xs flex items-center gap-1">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-2.5 h-2.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[8.5px] font-bold text-slate-500 truncate leading-none">إجمالي البيع</p>
            <h3 className="text-[10px] sm:text-[11px] font-black text-emerald-600 truncate leading-none mt-0.5">
              {totalRetailVal.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-0.5 sm:p-1 rounded border border-slate-200/80 shadow-2xs flex items-center gap-1">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Barcode className="w-2.5 h-2.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[8.5px] font-bold text-slate-500 truncate leading-none">المفلترة</p>
            <h3 className="text-[10px] sm:text-[11px] font-black text-slate-900 truncate leading-none mt-0.5">{filteredItems.length}</h3>
          </div>
        </div>

      </div>

      {/* Control Bar: Search, Filters, and Export Buttons */}
      <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5 no-print print:hidden">
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          
          {/* Main Search Input */}
          <div className="relative w-full md:w-96 flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الصنف، الاسم، الباركود..."
                className="w-full pr-8 pl-7 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shrink-0 shadow-xs active:scale-95 cursor-pointer"
              title="مسح الباركود بالكاميرا للبحث المباشر"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-100" />
              <span>مسح الباركود</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1 w-full md:w-auto justify-end">
            
            {items.length > 0 && (
              <button
                onClick={requestClearAll}
                className="flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs border border-red-200 transition"
                title="حذف كافة الأصناف المعروضة"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>حذف الكل</span>
              </button>
            )}

            <button
              onClick={() => setIsBatchPriceOpen(true)}
              className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 font-bold rounded-lg text-xs border border-amber-300 transition"
              title="تعديل نسبة مئوية لجميع الأسعار"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>تعديل الأسعار</span>
            </button>

            <button
              onClick={() => exportItemsToExcel(filteredItems)}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs border border-emerald-200 transition cursor-pointer"
              title="تصدير قائمة الأصناف المفلترة إلى إكسل"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600" />
              <span>إكسل</span>
            </button>

            <button
              onClick={async () => {
                setIsGeneratingPdf(true);
                await exportElementToPDF('printable-catalog-report', 'قائمة_المخزون_والأصناف');
                setIsGeneratingPdf(false);
              }}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded-lg text-xs border border-rose-200 transition cursor-pointer disabled:opacity-50"
              title="تصدير وتحميل قائمة المخزون كملف PDF"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 text-rose-600 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>{isGeneratingPdf ? 'جاري...' : 'PDF'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs border border-slate-200 transition cursor-pointer"
              title="فتح نافذة الطباعة أو الحفظ كـ PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صنف</span>
            </button>

          </div>

        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 text-xs font-semibold text-slate-600">
          
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
              إجمالي المعروض: {filteredItems.length} من {items.length} صنف
            </span>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">ترتيب بـ:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 text-slate-800 font-bold text-[11px]"
            >
              <option value="code">رقم الصنف</option>
              <option value="name">اسم الصنف</option>
              <option value="initialCost">التكلفة الأولية</option>
              <option value="sellingPrice">سعر البيع</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-0.5 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition"
              title="تغيير الاتجاه"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>

        </div>

      </div>

      {/* Main Table view */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">لم يتم العثور على أي أصناف مطابقة</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            تأكد من كتابة اسم الصنف، الرقم، أو الباركود بشكل صحيح، أو قم بإستيراد ملف إكسل يحتوي على الأصناف.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-xs rounded-xl text-slate-700 transition"
            >
              مسح البحث
            </button>
            <button
              onClick={onNavigateToImport}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition"
            >
              إستيراد من إكسل
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          
          {/* Floating Selection Action Bar */}
          {selectedItemIds.length > 0 && (
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between gap-4 shadow-xl border border-slate-800 animate-fadeIn">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500 text-slate-950 font-black px-3 py-1 rounded-xl text-xs">
                  تم تحديد {selectedItemIds.length} صنف
                </span>
                <p className="text-xs text-slate-300 font-medium hidden sm:block">
                  يمكنك حذف الأصناف المحددة أو تصديرها دفعة واحدة
                </p>
                {selectedItemIds.length < filteredItems.length && (
                  <button
                    onClick={handleSelectAllFiltered}
                    className="text-xs text-emerald-400 hover:underline font-bold"
                  >
                    (تحديد كافة الأصناف المفلترة: {filteredItems.length})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedItemIds([])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  إلغاء التحديد
                </button>

                <button
                  onClick={requestDeleteBulk}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف المحدد ({selectedItemIds.length})</span>
                </button>
              </div>
            </div>
          )}

          <div id="printable-catalog-report" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print:overflow-visible">
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-right text-sm print:text-xs border-collapse print:border print:border-black">
                <thead className="print:table-header-group">
                  {/* Repeating Official Header on print */}
                  <tr className="hidden print:table-row border-none bg-white">
                    <td colSpan={15} className="p-2 border-b border-black mb-2 bg-white font-normal text-right">
                      <ReportHeader
                        reportTitle="بيانات دليل الأصناف والمخزون"
                        onOpenSettings={() => setIsHeaderSettingsModalOpen(true)}
                        hideEditButton={true}
                      />
                    </td>
                  </tr>
                  <tr className="bg-slate-900 text-slate-200 text-xs font-bold uppercase tracking-wider border-b border-slate-800 print:bg-[#c5d9f1] print:text-black print:border-b print:border-black">
                    <th className="py-2 px-2 text-center no-print print:hidden">
                      <input
                        type="checkbox"
                        checked={isCurrentPageSelected}
                        onChange={toggleSelectCurrentPage}
                        className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                        title="تحديد كافة الأصناف في الصفحة الحالية"
                      />
                    </th>
                    <th className="hidden print:table-cell py-1 px-1.5 print:border print:border-black text-center font-bold">مـ</th>
                    <th className="py-2 px-2.5 print:py-1 print:px-1 print:border print:border-black text-center font-bold">رقم الصنف</th>
                    <th className="py-2 px-2.5 print:py-1 print:px-1 print:border print:border-black text-right font-bold">اسم الصنف</th>
                    <th className="py-2 px-2.5 print:py-1 print:px-1 print:border print:border-black text-right font-bold">الاسم الأجنبي</th>
                    <th className="py-2 px-2.5 print:py-1 print:px-1 print:border print:border-black text-center font-bold">الوحدة / العبوة</th>
                    <th className="py-2 px-2.5 print:py-1 print:px-1 print:border print:border-black text-center font-bold">رقم الباركود</th>
                    <th className="py-2 px-2.5 text-center print:py-1 print:px-1 print:border print:border-black font-bold">التكلفة الأولية</th>
                    <th className="py-2 px-2.5 text-center print:py-1 print:px-1 print:border print:border-black font-bold">السعر</th>
                    <th className="py-2 px-2.5 text-center print:py-1 print:px-1 print:border print:border-black font-bold">سعر البيع</th>
                    <th className="py-2 px-2 text-center no-print print:hidden">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.map((item, index) => {
                    const isEditingInline = inlineEditingId === item.id;
                    const isSelected = selectedSet.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/80 transition-colors group ${
                          isSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-2 text-center whitespace-nowrap no-print print:hidden">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                          />
                        </td>
                        {/* Print Serial Number */}
                        <td className="hidden print:table-cell py-1 px-1.5 print:border print:border-black text-center font-mono font-bold text-slate-900">
                          {index + 1}
                        </td>
                      {/* Code */}
                      <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-800">
                          {item.code}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-2 px-2.5 font-bold text-slate-900">
                        <div className="truncate text-slate-900 font-bold">{item.name}</div>
                        {(item.batchNo || item.expiryDate || item.currentStock !== undefined || item.quantity !== undefined) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-normal">
                            {item.batchNo && (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-mono font-bold">
                                تشغيلة: {item.batchNo}
                              </span>
                            )}
                            {item.expiryDate && (
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono font-bold">
                                انتهاء: {item.expiryDate}
                              </span>
                            )}
                            {(item.currentStock !== undefined || item.quantity !== undefined) && (
                              <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded font-mono font-bold">
                                الكمية: {item.currentStock ?? item.quantity}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Foreign Names */}
                      <td className="py-2 px-2.5 text-xs font-mono dir-ltr text-right">
                        {(() => {
                          const fNames = getItemForeignNames(item);
                          if (fNames.length === 0) return <span className="text-slate-400">-</span>;
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-800">{fNames[0]}</span>
                              {fNames.length > 1 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {fNames.slice(1).map((fn, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-200/80 rounded text-[10px] font-mono font-semibold">
                                      {fn}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Unit, Prices & Costs */}
                      <td className="py-2 px-2.5 text-xs text-slate-700">
                        {(() => {
                          const unitDetails = getItemUnitDetails(item);
                          if (unitDetails.length === 0) return <span className="text-slate-400">-</span>;
                          return (
                            <div className="flex flex-col gap-1 min-w-[130px]">
                              {unitDetails.map((ud, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded text-[11px]">
                                  <span className="font-black text-emerald-800 bg-emerald-100/90 px-1 py-0.2 rounded text-[10px]">
                                    {ud.unit}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-emerald-600">
                                      {ud.sellingPrice} ر.س
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      ({ud.initialCost})
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Barcode */}
                      <td className="py-2 px-2.5 text-xs font-mono text-slate-600 whitespace-nowrap">
                        {(() => {
                          const barcodes = getItemBarcodes(item);
                          if (barcodes.length === 0) return <span className="text-slate-400">-</span>;
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1 text-slate-800 font-bold">
                                <Barcode className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                {barcodes[0]}
                              </span>
                              {barcodes.length > 1 && (
                                <div className="flex flex-wrap gap-1">
                                  {barcodes.slice(1).map((bc, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-mono">
                                      {bc}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Initial Cost */}
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        {isEditingInline ? (
                          <input
                            type="number"
                            step="any"
                            value={inlineData.initialCost ?? item.initialCost}
                            onChange={(e) =>
                              setInlineData({ ...inlineData, initialCost: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-xs"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {item.initialCost.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isEditingInline ? (
                          <input
                            type="number"
                            step="any"
                            value={inlineData.price ?? item.price}
                            onChange={(e) =>
                              setInlineData({ ...inlineData, price: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-xs"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {item.price.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isEditingInline ? (
                          <input
                            type="number"
                            step="any"
                            value={inlineData.sellingPrice ?? item.sellingPrice}
                            onChange={(e) =>
                              setInlineData({ ...inlineData, sellingPrice: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-xs"
                          />
                        ) : (
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {item.sellingPrice.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isEditingInline ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveInlineEdit(item)}
                              className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition"
                              title="حفظ"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setInlineEditingId(null)}
                              className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                              title="إلغاء"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="تعديل كافة بيانات الصنف والوحدات والأسعار والبارتكودات"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => requestDeleteSingle(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="حذف الصنف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <TableReportFooter
                colSpan={10}
                printedBy={currentUser?.username || 'مدير النظام'}
                totalItemsCount={filteredItems.length}
              />
            </table>
          </div>
          
          {/* Pagination Navigation Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-600">
            
            {/* Range & Total info */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-800">
                عرض {filteredItems.length > 0 ? (safePage - 1) * (pageSize === -1 ? filteredItems.length : pageSize) + 1 : 0} - {Math.min(safePage * (pageSize === -1 ? filteredItems.length : pageSize), filteredItems.length)} من أصل {filteredItems.length.toLocaleString('ar-SA')} صنف
                {items.length !== filteredItems.length && (
                  <span className="text-slate-400 font-normal mr-1">
                    (إجمالي الأصناف: {items.length.toLocaleString('ar-SA')})
                  </span>
                )}
              </span>

              {/* Items per page selector */}
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
                <span className="text-slate-500 font-semibold">حجم الصفحة:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value={25}>25 صنف</option>
                  <option value={50}>50 صنف</option>
                  <option value={100}>100 صنف</option>
                  <option value={200}>200 صنف</option>
                  <option value={500}>500 صنف</option>
                  <option value={1000}>1000 صنف</option>
                  <option value={-1}>عرض الكل</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            {!isAllPages && totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                  title="الصفحة الأولى"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>

                {/* Prev Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Direct Page Jump Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      return (
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 2
                      );
                    })
                    .map((p, idx, array) => {
                      const prevP = array[idx - 1];
                      const showEllipsis = prevP && p - prevP > 1;

                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && (
                            <span className="px-1 text-slate-400 font-bold">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              safePage === p
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                  title="الصفحة الأخيرة"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

              </div>
            )}

          </div>
        </div>
      </div>
    )}

      {/* Single / Batch Price Adjustment Modal */}
      <PriceUpdateModal
        item={selectedItemForPrice}
        isOpen={isPriceModalOpen || isBatchPriceOpen}
        onClose={() => {
          setIsPriceModalOpen(false);
          setIsBatchPriceOpen(false);
          setSelectedItemForPrice(null);
        }}
        onSaveSingle={(updated) => {
          onUpdateItem(updated);
        }}
        onBatchUpdate={(percent, priceType) => {
          onBatchPriceUpdate(percent, priceType);
        }}
      />

      {/* Add / Edit Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>{editingItem ? 'تعديل بيانات الصنف والوحدات والأسعار' : 'إضافة صنف جديد لقاعدة البيانات'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleItemFormSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                  e.preventDefault();
                }
              }}
              className="p-6 space-y-6 max-h-[80vh] overflow-y-auto"
            >
              
              {/* Code Error Warning */}
              {formCodeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formCodeError}</span>
                </div>
              )}

              {/* SECTION 1: Item Code & Primary Names */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs border-b border-slate-200/80 pb-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>معلومات الصنف الأساسية (رقم الصنف كود فريد ووحيد)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Single Unique Item Code */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>رقم الصنف (كود فريد وحيد) *</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-bold">
                        كود واحد فقط
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formCode}
                      onChange={(e) => {
                        setFormCode(e.target.value);
                        setFormCodeError(null);
                      }}
                      placeholder="مثال: 1015"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      رقم فريد وخاص بالصنف فقط، ولا يمكن أن يحتوي الصنف على أكثر من كود واحد.
                    </p>
                  </div>

                  {/* Arabic Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم الصنف (بالعربي) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="مثال: عصير برتقال طبيعي"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Foreign Names (Multiple) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Globe className="w-4 h-4 text-sky-600" />
                    <span>الأسماء الأجنبية للصنف (يمكن إضافة أكثر من اسم أجنبي)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormForeignNames([...formForeignNames, ''])}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 px-2 py-1 rounded-lg border border-sky-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة اسم أجنبي آخر</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      الاسم الأجنبي الرئيسي
                    </label>
                    <input
                      type="text"
                      value={formForeignName}
                      onChange={(e) => setFormForeignName(e.target.value)}
                      placeholder="e.g. Orange Juice 1L"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-left bg-white"
                    />
                  </div>

                  {formForeignNames.map((fn, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fn}
                        onChange={(e) => {
                          const updated = [...formForeignNames];
                          updated[index] = e.target.value;
                          setFormForeignNames(updated);
                        }}
                        placeholder={`اسم أجنبي إضافي #${index + 2}`}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-left bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormForeignNames(formForeignNames.filter((_, i) => i !== index));
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0 cursor-pointer"
                        title="حذف الاسم"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: Barcodes (Multiple) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Barcode className="w-4 h-4 text-purple-600" />
                    <span>أرقام الباركود (يمكن أن يحتوي الصنف على أكثر من باركود)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormBarcodes([...formBarcodes, ''])}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة باركود إضافي</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        الباركود الرئيسي
                      </label>
                      <button
                        type="button"
                        onClick={() => setCatalogScannerTarget('primary')}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 transition cursor-pointer"
                        title="مسح الباركود الرئيسي بالكاميرا"
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-600" />
                        <span>مسح الكاميرا</span>
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                        placeholder="6281000..."
                        className="w-full px-3 py-1.5 pl-8 rounded-lg border border-slate-300 font-mono text-xs text-left bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setCatalogScannerTarget('primary')}
                        className="absolute left-1.5 p-1 text-slate-400 hover:text-emerald-600 rounded transition cursor-pointer"
                        title="فتح كاميرا الماسح الضوئي"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {formBarcodes.map((bc, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="text"
                          value={bc}
                          onChange={(e) => {
                            const updated = [...formBarcodes];
                            updated[index] = e.target.value;
                            setFormBarcodes(updated);
                          }}
                          placeholder={`باركود إضافي #${index + 2}`}
                          className="w-full px-3 py-1.5 pl-8 rounded-lg border border-slate-300 font-mono text-xs text-left bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setCatalogScannerTarget(index)}
                          className="absolute left-1.5 p-1 text-slate-400 hover:text-emerald-600 rounded transition cursor-pointer"
                          title="مسح هذا الباركود بالكاميرا"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCatalogScannerTarget(index)}
                        className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shrink-0 cursor-pointer text-xs font-bold flex items-center gap-1"
                        title="مسح بالكاميرا"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormBarcodes(formBarcodes.filter((_, i) => i !== index));
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0 cursor-pointer"
                        title="حذف الباركود"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: Units with Pricing and Cost (Multiple) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>الوحدات المسجلة للصنف (سعر البيع والتكلفة الخاصة لكل وحدة)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormUnitDetails([
                        ...formUnitDetails,
                        { unit: '', sellingPrice: 0, initialCost: 0, barcode: '', pack: '1' }
                      ])
                    }
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة وحدة جديدة</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formUnitDetails.map((ud, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          الوحدة #{index + 1} {index === 0 ? '(الرئيسية)' : ''}
                        </span>
                        {formUnitDetails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormUnitDetails(formUnitDetails.filter((_, i) => i !== index));
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 hover:bg-rose-50 px-2 py-0.5 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف الوحدة</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            اسم الوحدة *
                          </label>
                          <input
                            type="text"
                            required
                            value={ud.unit}
                            onChange={(e) => {
                              const updated = [...formUnitDetails];
                              updated[index] = { ...updated[index], unit: e.target.value };
                              setFormUnitDetails(updated);
                            }}
                            placeholder="مثال: حبة / كرتون"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            سعر البيع (ر.س) *
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={ud.sellingPrice}
                            onChange={(e) => {
                              const updated = [...formUnitDetails];
                              updated[index] = {
                                ...updated[index],
                                sellingPrice: parseFloat(e.target.value) || 0
                              };
                              setFormUnitDetails(updated);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-xs text-emerald-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            التكلفة (ر.س) *
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={ud.initialCost}
                            onChange={(e) => {
                              const updated = [...formUnitDetails];
                              updated[index] = {
                                ...updated[index],
                                initialCost: parseFloat(e.target.value) || 0
                              };
                              setFormUnitDetails(updated);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            باركود الوحدة (اختياري)
                          </label>
                          <input
                            type="text"
                            value={ud.barcode || ''}
                            onChange={(e) => {
                              const updated = [...formUnitDetails];
                              updated[index] = { ...updated[index], barcode: e.target.value };
                              setFormUnitDetails(updated);
                            }}
                            placeholder="باركود خاص..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-sm rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingItem ? 'حفظ التعديلات' : 'إضافة الصنف'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <span>
                  {deleteModal.type === 'single' && 'تأكيد حذف الصنف'}
                  {deleteModal.type === 'bulk' && 'تأكيد حذف الأصناف المحددة'}
                  {deleteModal.type === 'clearAll' && 'تأكيد مسح كافة الأصناف'}
                </span>
              </div>
              <button
                onClick={() => setDeleteModal({ isOpen: false, type: 'single', itemToDelete: null })}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-slate-800">
              {deleteModal.type === 'single' && deleteModal.itemToDelete && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    هل أنت متأكد من رغبتك في حذف الصنف التالي نهائياً؟
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs space-y-1">
                    <p className="text-slate-900 text-sm">{deleteModal.itemToDelete.name}</p>
                    <p className="text-slate-500 font-mono">الكود: {deleteModal.itemToDelete.code} | الباركود: {deleteModal.itemToDelete.barcode || '-'}</p>
                  </div>
                </div>
              )}

              {deleteModal.type === 'bulk' && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    هل أنت متأكد من رغبتك في حذف <strong className="text-red-600 font-black text-base">{selectedItemIds.length}</strong> أصناف محددة؟
                  </p>
                  <p className="text-xs text-slate-500">
                    سيتم إزالة هذه الأصناف نهائياً من قاعدة البيانات المحلية ولن يمكن استعادتها إلا بإعادة الاستيراد.
                  </p>
                </div>
              )}

              {deleteModal.type === 'clearAll' && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-red-600">
                    تنبيه هام جداً: أنت على وشك حذف جميع الأصناف ({items.length} صنف)!
                  </p>
                  <p className="text-xs text-slate-500">
                    سيتم تفريغ كافة سجلات المواد والأصناف الحالية نهائياً.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteModal({ isOpen: false, type: 'single', itemToDelete: null })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد الحذف</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal for Search */}
      <CameraBarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(scannedBarcode) => {
          setSearchQuery(scannedBarcode);
        }}
      />

      {/* Camera Barcode Scanner Modal for Add/Edit Form Fields */}
      <CameraBarcodeScanner
        isOpen={catalogScannerTarget !== null}
        title="مسح الباركود - نموذج الأصناف"
        onClose={() => setCatalogScannerTarget(null)}
        onDetected={(scannedBarcode) => {
          if (catalogScannerTarget === 'primary') {
            setFormBarcode(scannedBarcode);
          } else if (typeof catalogScannerTarget === 'number') {
            const updated = [...formBarcodes];
            updated[catalogScannerTarget] = scannedBarcode;
            setFormBarcodes(updated);
          }
          setCatalogScannerTarget(null);
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
