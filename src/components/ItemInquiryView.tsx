import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { Item, AuditSession } from '../types';
import {
  Search,
  Camera,
  Barcode,
  Layers,
  Tag,
  DollarSign,
  Package,
  Calendar,
  FileText,
  Printer,
  Copy,
  Check,
  Globe,
  Info,
  Edit2,
  PlusCircle,
  Clock,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
  Eye,
  TrendingUp,
  Filter,
  ArrowRight,
  Columns,
  MapPin,
  Grid,
  ChevronDown,
  ChevronUp,
  List
} from 'lucide-react';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { hasUserPermission } from '../utils/userUtils';
import { useBackButtonClose } from '../hooks/useBackButtonClose';
import {
  getItemBarcodes,
  getConsolidatedItemBarcodes,
  getItemForeignNames,
  getItemUnitDetails,
  getConsolidatedItemUnitDetails,
  getItemUnits,
  itemMatchesQuery
} from '../utils/unitUtils';

interface ItemInquiryViewProps {
  items: Item[];
  auditSessions: AuditSession[];
  currentUser?: { username: string; role?: string; permissions?: string[] } | null;
  onEditItem?: (item: Item) => void;
  onAddToAuditSession?: (item: Item) => void;
  onUpdateItem?: (item: Item) => void;
}

export const ItemInquiryView: React.FC<ItemInquiryViewProps> = ({
  items,
  auditSessions,
  currentUser,
  onEditItem,
  onAddToAuditSession,
  onUpdateItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Selected item ID for detailed view
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Column Details Modal State
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [selectedColumnForModal, setSelectedColumnForModal] = useState<string | null>(null);

  // Dropdown List State under Audit History
  const [selectedAuditRecordIdx, setSelectedAuditRecordIdx] = useState<number | 'all'>('all');
  const [isAuditDropdownExpanded, setIsAuditDropdownExpanded] = useState(true);

  // Dropdown List State for Columns & Shelves
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>('all');
  const [isColumnsDropdownExpanded, setIsColumnsDropdownExpanded] = useState(true);

  // Direct In-View Item Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditBarcodeScannerOpen, setIsEditBarcodeScannerOpen] = useState(false);
  const [editingItemData, setEditingItemData] = useState<Item | null>(null);
  const [editFormCode, setEditFormCode] = useState('');
  const [editFormName, setEditFormName] = useState('');
  const [editFormForeignName, setEditFormForeignName] = useState('');
  const [editFormCategory, setEditFormCategory] = useState('');
  const [editFormBarcode, setEditFormBarcode] = useState('');
  const [editFormUnit, setEditFormUnit] = useState('حبة');
  const [editFormSellingPrice, setEditFormSellingPrice] = useState<number | ''>(0);
  const [editFormInitialCost, setEditFormInitialCost] = useState<number | ''>(0);
  const [editFormPrice, setEditFormPrice] = useState<number | ''>(0);
  const [editSuccessToast, setEditSuccessToast] = useState(false);

  // Mobile Back Button handlers for modals & camera scanner
  useBackButtonClose(isScannerOpen, () => setIsScannerOpen(false));
  useBackButtonClose(isColumnsModalOpen, () => setIsColumnsModalOpen(false));
  useBackButtonClose(isEditModalOpen, () => setIsEditModalOpen(false));
  useBackButtonClose(isEditBarcodeScannerOpen, () => setIsEditBarcodeScannerOpen(false));

  // 1. Pre-build high-performance O(1) Search Index & Barcode Map
  const searchIndex = useMemo(() => {
    const mapByBarcode = new Map<string, Item>();
    const mapById = new Map<string, Item>();
    const indexRecords: Array<{
      item: Item;
      searchTokens: string;
      category: string;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      mapById.set(item.id, item);

      const barcodes = getItemBarcodes(item);
      const foreignNames = getItemForeignNames(item);

      // Index barcodes for O(1) instant exact match
      for (let j = 0; j < barcodes.length; j++) {
        const cleanBc = barcodes[j].replace(/[\s\-_]/g, '').toLowerCase();
        if (cleanBc && !mapByBarcode.has(cleanBc)) {
          mapByBarcode.set(cleanBc, item);
        }
      }

      // Combine search strings into a single lowercase string for rapid substring matching
      const units = getItemUnits(item);
      const searchTokens = (
        (item.code || '') + ' ' +
        (item.name || '') + ' ' +
        (item.specs || '') + ' ' +
        (item.description || '') + ' ' +
        (item.scientificName || '') + ' ' +
        (item.category || '') + ' ' +
        (item.pack || '') + ' ' +
        units.join(' ') + ' ' +
        foreignNames.join(' ') + ' ' +
        barcodes.join(' ')
      ).toLowerCase();

      indexRecords.push({
        item,
        searchTokens,
        category: item.category || ''
      });
    }

    return { mapByBarcode, mapById, indexRecords };
  }, [items]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  // High-speed Filtered items calculation using indexed strings
  const filteredItems = useMemo(() => {
    const cleanQuery = deferredSearchQuery.trim().toLowerCase();
    if (!cleanQuery && selectedCategoryId === 'all') {
      return [];
    }

    const queryParts = cleanQuery.split(/\s+/).filter(Boolean);
    const uniqueMap = new Map<string, Item>();

    for (let i = 0; i < searchIndex.indexRecords.length; i++) {
      const rec = searchIndex.indexRecords[i];

      if (selectedCategoryId !== 'all' && rec.category !== selectedCategoryId) {
        continue;
      }

      if (queryParts.length > 0) {
        const matchesAllTokens = queryParts.every((part) => rec.searchTokens.includes(part));
        if (!matchesAllTokens) continue;
      }

      const item = rec.item;
      const key = (item.code && item.code.trim())
        ? item.code.trim().toLowerCase()
        : item.name.trim().toLowerCase();

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
        if (uniqueMap.size >= 100) break; // Limit to 100 items max for silky 60fps UI
      }
    }

    return Array.from(uniqueMap.values());
  }, [searchIndex, deferredSearchQuery, selectedCategoryId]);

  // Active selected item (Explicit selection or top matching item)
  const activeItem = useMemo(() => {
    if (selectedItemId) {
      const selectedObj = searchIndex.mapById.get(selectedItemId);
      if (selectedObj) return selectedObj;
    }
    if (filteredItems.length > 0) {
      return filteredItems[0];
    }
    return null;
  }, [filteredItems, selectedItemId, searchIndex]);

  // Memoized consolidated barcodes for active item
  const activeItemBarcodes = useMemo(() => {
    if (!activeItem) return [];
    return getConsolidatedItemBarcodes(activeItem, items);
  }, [activeItem, items]);

  // Memoized consolidated unit details for active item
  const activeItemUnitDetails = useMemo(() => {
    if (!activeItem) return [];
    return getConsolidatedItemUnitDetails(activeItem, items);
  }, [activeItem, items]);

  // Instant O(1) Auto-Select exact barcode match whenever searchQuery changes
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) return;

    const cleanQuery = query.replace(/[\s\-_]/g, '').toLowerCase();
    const exactMatch = searchIndex.mapByBarcode.get(cleanQuery);

    if (exactMatch) {
      setSelectedItemId(exactMatch.id);
      if (window.innerWidth < 1024) {
        setTimeout(() => {
          const cardElem = document.getElementById('printable-item-card');
          if (cardElem) {
            cardElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  }, [searchQuery, searchIndex]);

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    // On smaller screens, scroll to detail card smoothly
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const cardElem = document.getElementById('printable-item-card');
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    const cleanBc = barcode.trim().replace(/[\s\-_]/g, '').toLowerCase();
    setSearchQuery(barcode);

    // Auto-select exact barcode match using O(1) indexed barcode map
    const exactMatch = searchIndex.mapByBarcode.get(cleanBc);
    if (exactMatch) {
      handleSelectItem(exactMatch.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = searchQuery.trim();
      if (!val) return;

      const cleanBc = val.replace(/[\s\-_]/g, '').toLowerCase();
      // Try exact barcode match first using O(1) indexed map
      const exactBarcodeMatch = searchIndex.mapByBarcode.get(cleanBc);

      if (exactBarcodeMatch) {
        setSelectedItemId(exactBarcodeMatch.id);
      } else if (filteredItems.length > 0) {
        setSelectedItemId(filteredItems[0].id);
      }
    }
  };

  // Open Edit Modal for active item
  const handleOpenEditModal = (itemToEdit: Item) => {
    const canEdit = hasUserPermission(currentUser, 'edit_items');
    if (!canEdit) {
      alert('عذراً، ليس لديك صلاحية تعديل بيانات وأسعار الأصناف.');
      return;
    }
    setEditingItemData(itemToEdit);
    setEditFormCode(itemToEdit.code || '');
    setEditFormName(itemToEdit.name || '');
    setEditFormForeignName(itemToEdit.foreignName || '');
    setEditFormCategory(itemToEdit.category || '');
    setEditFormBarcode(itemToEdit.barcode || '');
    setEditFormUnit(itemToEdit.unit || 'حبة');
    setEditFormSellingPrice(itemToEdit.sellingPrice || 0);
    setEditFormInitialCost(itemToEdit.initialCost || 0);
    setEditFormPrice(itemToEdit.price || itemToEdit.sellingPrice || 0);
    setIsEditModalOpen(true);
  };

  // Save Item Edits
  const handleSaveItemEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItemData) return;

    if (!editFormName.trim()) {
      alert('يرجى إدخال اسم الصنف الرئيسي بالعربي');
      return;
    }

    const updated: Item = {
      ...editingItemData,
      code: editFormCode.trim(),
      name: editFormName.trim(),
      foreignName: editFormForeignName.trim(),
      category: editFormCategory.trim(),
      barcode: editFormBarcode.trim(),
      unit: editFormUnit.trim() || 'حبة',
      sellingPrice: editFormSellingPrice === '' ? 0 : Number(editFormSellingPrice),
      initialCost: editFormInitialCost === '' ? 0 : Number(editFormInitialCost),
      price: editFormPrice === '' ? (editFormSellingPrice === '' ? 0 : Number(editFormSellingPrice)) : Number(editFormPrice),
      lastUpdated: new Date().toISOString()
    };

    if (onUpdateItem) {
      onUpdateItem(updated);
    }
    if (onEditItem) {
      onEditItem(updated);
    }

    setIsEditModalOpen(false);
    setEditSuccessToast(true);
    setTimeout(() => setEditSuccessToast(false), 3000);
  };

  // Find all audit records for the active item across all sessions
  const itemAuditHistory = useMemo(() => {
    if (!activeItem) return [];
    const recordsList: {
      recordId?: string;
      sessionId: string;
      sessionTitle: string;
      sessionDate: string;
      auditorName: string;
      createdBy?: string;
      auditedQty: number;
      unit: string;
      columnNo: string;
      expiryDate: string;
      notes?: string;
      timestamp: string;
    }[] = [];

    const activeBarcodes = getConsolidatedItemBarcodes(activeItem, items);

    auditSessions.forEach((session) => {
      session.records.forEach((rec) => {
        const matchId = rec.itemId === activeItem.id;
        const matchCode = rec.itemCode && rec.itemCode.trim() === activeItem.code.trim();
        const matchBc = rec.barcode && activeBarcodes.includes(rec.barcode.trim());

        if (matchId || matchCode || matchBc) {
          recordsList.push({
            recordId: rec.id,
            sessionId: session.id,
            sessionTitle: session.title,
            sessionDate: session.date,
            auditorName: session.auditorName || 'مسؤول الجرد',
            createdBy: rec.createdBy || session.auditorName || 'مسؤول الجرد',
            auditedQty: Number(rec.auditedQty) || 0,
            unit: rec.unit || activeItem.unit || 'حبة',
            columnNo: (rec.columnNo && rec.columnNo.trim()) ? rec.columnNo.trim() : 'غير محدد',
            expiryDate: rec.expiryDate || 'غير محدد',
            notes: rec.notes,
            timestamp: rec.timestamp
          });
        }
      });
    });

    return recordsList;
  }, [activeItem, auditSessions, items]);

  // Group audit records by Column / Shelf Number for instant location summary
  const itemColumnsSummary = useMemo(() => {
    if (!itemAuditHistory.length) return [];

    const map = new Map<string, {
      columnNo: string;
      totalQty: number;
      unitsText: string;
      recordsCount: number;
      latestDate: string;
      auditorsList: string[];
      records: typeof itemAuditHistory;
    }>();

    itemAuditHistory.forEach((rec) => {
      const col = rec.columnNo || 'غير محدد';
      if (!map.has(col)) {
        map.set(col, {
          columnNo: col,
          totalQty: 0,
          unitsText: '',
          recordsCount: 0,
          latestDate: rec.sessionDate,
          auditorsList: [],
          records: []
        });
      }
      const entry = map.get(col)!;
      entry.totalQty += rec.auditedQty;
      entry.recordsCount += 1;
      entry.records.push(rec);
      if (rec.auditorName && !entry.auditorsList.includes(rec.auditorName)) {
        entry.auditorsList.push(rec.auditorName);
      }
      if (rec.sessionDate && rec.sessionDate > entry.latestDate) {
        entry.latestDate = rec.sessionDate;
      }
    });

    // Format units text for each column entry (e.g. "24 حبة + 2 كرتون")
    map.forEach((entry) => {
      const unitMap = new Map<string, number>();
      entry.records.forEach((r) => {
        unitMap.set(r.unit, (unitMap.get(r.unit) || 0) + r.auditedQty);
      });
      entry.unitsText = Array.from(unitMap.entries())
        .map(([unit, qty]) => `${qty} ${unit}`)
        .join(' + ');
    });

    return Array.from(map.values());
  }, [itemAuditHistory]);

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-2.5 pb-8">
      {/* Top Title & Header Card */}
      <div className="bg-slate-900 text-white rounded-xl p-2.5 sm:p-3 shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30 shrink-0">
            <Search className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              شاشة الاستعلام عن الأصناف
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {items.length} صنف
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate hidden md:block">
              ابحث باسم الصنف، الكود، الباركود الرئيسي والبديل، أو قارئ الباركود
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        {activeItem && (
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-bold shrink-0 max-w-full sm:max-w-xs">
            <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400 shrink-0">المختار:</span>
            <span className="text-emerald-400 font-black truncate">{activeItem.name}</span>
          </div>
        )}
      </div>

      {/* Main Search & Barcode Scanner Bar */}
      <div className="bg-white rounded-xl p-2 sm:p-3 shadow-xs border border-slate-200/90 space-y-2 no-print">
        <div className="flex flex-col sm:flex-row items-stretch gap-1.5">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ابحث برقم الصنف، الاسم، الباركود، أو مسح قارئ الباركود..."
              className="w-full pr-9 pl-20 py-1.5 sm:py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
            />
            
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md pointer-events-none">
                  <Barcode className="w-3 h-3 text-emerald-600" />
                  مستعد للباركود
                </span>
              )}
            </div>
          </div>

          {/* Barcode Camera Button */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-xs shrink-0 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>مسح باركود كاميرا</span>
          </button>
        </div>

        {/* Categories Bar */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-bold shrink-0 ml-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              التصنيف:
            </span>
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap shrink-0 ${
                selectedCategoryId === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({items.length})
            </button>
            {categories.map((cat) => {
              const count = items.filter((i) => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryId(cat)}
                  className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap shrink-0 ${
                    selectedCategoryId === cat
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Layout: Master List (Right/Top) + Detailed Card View (Left/Main) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Master Search Results Sidebar / Column (Ultra Compact Height) */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex flex-col max-h-[160px] lg:h-[190px] no-print">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 text-[10px] font-bold text-slate-500">
            <span>نتائج البحث ({filteredItems.length})</span>
            {searchQuery && (
              <span className="text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded text-[9px] truncate max-w-[90px]">
                "{searchQuery}"
              </span>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-2 text-slate-400 space-y-1">
              {!searchQuery.trim() && selectedCategoryId === 'all' ? (
                <>
                  <Search className="w-5 h-5 text-slate-300 stroke-[1.5]" />
                  <p className="font-black text-[10px] text-slate-700">شريط البحث فارغ</p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-slate-300 stroke-[1.5]" />
                  <p className="font-bold text-[10px] text-slate-700">لا توجد نتائج</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
              {filteredItems.map((item) => {
                const isSelected = activeItem?.id === item.id || (activeItem && activeItem.code && item.code && activeItem.code.trim() === item.code.trim());
                const unitDetails = getItemUnitDetails(item);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item.id)}
                    className={`w-full text-right px-2 py-1.5 rounded-lg border transition flex flex-col gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <h3 className={`font-black text-[11px] truncate leading-tight ${
                        isSelected ? 'text-emerald-950' : 'text-slate-800'
                      }`}>
                        {item.name}
                      </h3>
                      <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200/80 text-slate-700 shrink-0">
                        {item.code}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 gap-1">
                      <span className="text-emerald-700 font-mono font-black truncate">
                        {unitDetails[0] ? `${unitDetails[0].unit}: ${(unitDetails[0].sellingPrice || 0).toLocaleString('ar-SA')} ر.س` : ''}
                      </span>
                      {unitDetails.length > 1 && (
                        <span className="text-[8px] bg-slate-200/70 px-1 py-0.2 rounded text-slate-600 shrink-0">
                          +{unitDetails.length - 1} وحدات
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Item Card Display (9 Columns on LG) */}
        <div className="lg:col-span-9">
          {activeItem ? (
            <div id="printable-item-card" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5 print:shadow-none print:border-none print:p-0">
              
              {/* Card Header: Item Title & Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-emerald-500 text-slate-950 font-mono font-black text-xs px-2.5 py-1 rounded-lg">
                      كود الصنف: {activeItem.code}
                    </span>
                    {activeItem.category && (
                      <span className="bg-slate-100 text-slate-700 font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {activeItem.category}
                      </span>
                    )}
                    {activeItem.currentStock !== undefined && (
                      <span className={`font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                        activeItem.currentStock > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        <Package className="w-3 h-3" />
                        المخزون: {activeItem.currentStock} {activeItem.unit || 'حبة'}
                      </span>
                    )}

                    {itemColumnsSummary.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedColumnForModal(null);
                          setIsColumnsModalOpen(true);
                        }}
                        className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title="انقر لمشاهدة تفاصيل وتوزيع الأعمدة المجرودة لهذا الصنف"
                      >
                        <Columns className="w-3.5 h-3.5 text-sky-600" />
                        <span>أعمدة الجرد ({itemColumnsSummary.length} أعمدة)</span>
                      </button>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-slate-900 pt-1">
                    {activeItem.name}
                  </h2>

                  {getItemForeignNames(activeItem).length > 0 && (
                    <p className="text-xs sm:text-sm font-semibold text-slate-500 font-mono dir-ltr text-right">
                      {getItemForeignNames(activeItem).join(' | ')}
                    </p>
                  )}
                </div>

                {/* Card Top Control Buttons */}
                <div className="flex items-center gap-2 shrink-0 no-print self-end sm:self-auto">
                  {onAddToAuditSession && (
                    <button
                      onClick={() => onAddToAuditSession(activeItem)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-xs"
                      title="إضافة الصنف إلى جلسة الجرد النشطة"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>إضافة للجرد</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEditModal(activeItem)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 font-bold text-xs rounded-xl transition border border-slate-300 hover:border-emerald-400 cursor-pointer shadow-2xs"
                    title="تعديل بيانات وأسعار الصنف"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تعديل الصنف</span>
                  </button>

                  <button
                    onClick={handlePrintCard}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
                    title="طباعة تقرير الصنف"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>طباعة</span>
                  </button>
                </div>
              </div>

              {/* SECTION 1: Prices & Costs Grid */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  أسعار وتكلفة الصنف (الوحدة الأساسية: {activeItem.unit || 'حبة'})
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Selling Price */}
                  <div className="bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-emerald-800 block">سعر البيع الأساسي</span>
                    <div className="text-base sm:text-lg font-black text-emerald-950 font-mono">
                      {(activeItem.sellingPrice || 0).toLocaleString('ar-SA')} <span className="text-xs">ر.س</span>
                    </div>
                  </div>

                  {/* Initial Cost */}
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-slate-600 block">التكلفة الأولية</span>
                    <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                      {(activeItem.initialCost || 0).toLocaleString('ar-SA')} <span className="text-xs">ر.س</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-slate-600 block">السعر المعلم/الرئيسي</span>
                    <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                      {(activeItem.price || activeItem.sellingPrice || 0).toLocaleString('ar-SA')} <span className="text-xs">ر.س</span>
                    </div>
                  </div>

                  {/* Margin */}
                  {activeItem.sellingPrice > 0 && activeItem.initialCost > 0 && (
                    <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-xl space-y-1">
                      <span className="text-[11px] font-bold text-amber-800 block">الهامش الربحي المتوقع</span>
                      <div className="text-base sm:text-lg font-black text-amber-950 font-mono">
                        {(((activeItem.sellingPrice - activeItem.initialCost) / activeItem.sellingPrice) * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Min / Max Price if exists */}
                {(activeItem.maxSellingPrice || activeItem.minSellingPrice) && (
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {activeItem.minSellingPrice && (
                      <div>أقل سعر بيع مسموح: <span className="text-emerald-700 font-mono font-black">{activeItem.minSellingPrice} ر.س</span></div>
                    )}
                    {activeItem.maxSellingPrice && (
                      <div>أعلى سعر بيع مسموح: <span className="text-amber-700 font-mono font-black">{activeItem.maxSellingPrice} ر.س</span></div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: Barcodes Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Barcode className="w-4 h-4 text-emerald-600" />
                    جميع باركودات الصنف المعرّفة ({activeItemBarcodes.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeItemBarcodes.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 text-center font-bold">
                      لا يوجد باركود معرّف لهذا الصنف
                    </div>
                  ) : (
                    activeItemBarcodes.map((bc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs transition"
                      >
                        <div className="flex items-center gap-2">
                          <Barcode className="w-4 h-4 text-slate-500" />
                          <span className="font-mono font-black text-slate-900 tracking-wider text-xs sm:text-sm">
                            {bc}
                          </span>
                          {bc === activeItem.barcode && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded">
                              رئيسي
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleCopy(bc, `bc-${idx}`)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500 transition no-print cursor-pointer"
                          title="نسخ الباركود"
                        >
                          {copiedField === `bc-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SECTION 3: Multi-Units Breakdown Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  وحدات الصنف وتعبئة العبوات ({activeItemUnitDetails.length})
                </h3>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">الوحدة</th>
                        <th className="p-2.5">سعر البيع</th>
                        <th className="p-2.5">التكلفة</th>
                        <th className="p-2.5">السعة/التعبئة</th>
                        <th className="p-2.5">الباركود المخصص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {activeItemUnitDetails.map((ud, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-emerald-600" />
                            {ud.unit}
                            {ud.unit === activeItem.unit && (
                              <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                                أساسية
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono font-black text-emerald-700">
                            {(ud.sellingPrice || 0).toLocaleString('ar-SA')} ر.س
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">
                            {(ud.initialCost || 0).toLocaleString('ar-SA')} ر.س
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {ud.pack || activeItem.pack || '1'}
                          </td>
                          <td className="p-2.5 font-mono text-slate-700 font-bold">
                            {ud.barcode || activeItem.barcode || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 4: Specifications & Batch / Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Batch & Expiry */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2 text-xs">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    بيانات التشغيلة والصلاحية
                  </h4>
                  <div className="space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>رقم التشغيلة (Batch):</span>
                      <span className="font-mono font-bold text-slate-900">{activeItem.batchNo || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>تاريخ الانتهاء:</span>
                      <span className="font-mono font-bold text-slate-900">{activeItem.expiryDate || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>آخر تحديث بالأنظمة:</span>
                      <span className="font-mono text-slate-500">{activeItem.lastUpdated || 'محدث مؤخراً'}</span>
                    </div>
                  </div>
                </div>

                {/* Specs / Description / Scientific Name */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2 text-xs">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    الاسم العلمي والوصف
                  </h4>
                  <div className="space-y-1 text-slate-600">
                    {activeItem.scientificName && (
                      <div>
                        <span className="font-bold text-slate-700">الاسم العلمي: </span>
                        <span className="italic">{activeItem.scientificName}</span>
                      </div>
                    )}
                    {activeItem.specs && (
                      <div>
                        <span className="font-bold text-slate-700">المواصفات: </span>
                        <span>{activeItem.specs}</span>
                      </div>
                    )}
                    {activeItem.description && (
                      <div>
                        <span className="font-bold text-slate-700">الوصف: </span>
                        <span>{activeItem.description}</span>
                      </div>
                    )}
                    {!activeItem.scientificName && !activeItem.specs && !activeItem.description && (
                      <p className="text-slate-400 italic">لا توجد ملاحظات أو مواصفات مسجلة</p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 5: Columns & Shelves Audited Breakdown as Dropdown List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Columns className="w-4 h-4 text-sky-600" />
                    الأعمدة والرفوف المجرود فيها هذا الصنف ({itemColumnsSummary.length} أعمدة)
                  </h3>

                  {itemColumnsSummary.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsColumnsDropdownExpanded(!isColumnsDropdownExpanded)}
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Grid className="w-3.5 h-3.5 text-sky-600" />
                        <span>{isColumnsDropdownExpanded ? 'طي الأعمدة' : 'فتح القائمة المنسدلة'}</span>
                        {isColumnsDropdownExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedColumnForModal(null);
                          setIsColumnsModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة شاملة</span>
                      </button>
                    </div>
                  )}
                </div>

                {itemColumnsSummary.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 text-center font-bold">
                    لم يتم تسجيل جرد في أية أعمدة أو رفوف لهذا الصنف حتى الآن
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Columns Dropdown Menu Select */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                        <Columns className="w-3.5 h-3.5 text-sky-600" />
                        <span>اختر رقم العمود / الرف من القائمة المنسدلة:</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedColumnFilter}
                          onChange={(e) => {
                            setSelectedColumnFilter(e.target.value);
                            setIsColumnsDropdownExpanded(true);
                          }}
                          className="w-full px-3 py-2 bg-sky-50/80 hover:bg-sky-100 border-2 border-sky-500/80 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer transition shadow-2xs"
                        >
                          <option value="all">
                            🏢 كافة الأعمدة والرفوف المجرودة ({itemColumnsSummary.length} أعمدة)
                          </option>
                          {itemColumnsSummary.map((colSummary, idx) => (
                            <option key={idx} value={colSummary.columnNo}>
                              📌 عمود: {colSummary.columnNo} | الكمية: {colSummary.unitsText} | {colSummary.recordsCount} مرات جرد
                            </option>
                          ))}
                        </select>

                        {selectedColumnFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setSelectedColumnFilter('all')}
                            className="text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 px-3 py-2 rounded-xl shrink-0 transition cursor-pointer"
                          >
                            عرض الكل
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Columns Cards below Dropdown */}
                    {isColumnsDropdownExpanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {itemColumnsSummary
                          .filter((col) => selectedColumnFilter === 'all' || col.columnNo === selectedColumnFilter)
                          .map((colSummary, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedColumnForModal(colSummary.columnNo);
                                setIsColumnsModalOpen(true);
                              }}
                              className="text-right p-3 bg-sky-50 hover:bg-sky-100/90 border-2 border-sky-200 rounded-2xl text-xs transition space-y-1.5 cursor-pointer group shadow-2xs hover:shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-sky-950 text-sm flex items-center gap-1">
                                  <MapPin className="w-4 h-4 text-sky-600 group-hover:scale-110 transition" />
                                  عمود: {colSummary.columnNo}
                                </span>
                                <span className="bg-sky-200 text-sky-900 font-bold text-[10px] px-2 py-0.5 rounded-full border border-sky-300/60">
                                  {colSummary.recordsCount} مرات جرد
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-slate-700 font-bold">
                                <span className="text-[11px] text-slate-500">إجمالي الكمية:</span>
                                <span className="font-mono font-black text-sky-900 text-xs">
                                  {colSummary.unitsText}
                                </span>
                              </div>

                              <div className="text-[10px] text-slate-500 flex items-center justify-between border-t border-sky-200/60 pt-1">
                                <span className="truncate max-w-[120px]">الجارد: {colSummary.auditorsList.join('، ') || 'مسؤول الجرد'}</span>
                                <span>{colSummary.latestDate}</span>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 6: Audit History as Dropdown List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    سجل جرد هذا الصنف بالنظام ({itemAuditHistory.length} عمليات جرد)
                  </h3>

                  {itemAuditHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsAuditDropdownExpanded(!isAuditDropdownExpanded)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                    >
                      <List className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isAuditDropdownExpanded ? 'طي القائمة' : 'فتح القائمة المنسدلة'}</span>
                      {isAuditDropdownExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {itemAuditHistory.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 text-center font-bold">
                    لم يتم تسجيل جرد ميداني لهذا الصنف حتى الآن
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Interactive Dropdown Menu Select */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                        <List className="w-3.5 h-3.5 text-emerald-600" />
                        <span>اختر عملية الجرد / العمود من القائمة المنسدلة:</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedAuditRecordIdx === 'all' ? 'all' : selectedAuditRecordIdx}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedAuditRecordIdx(val === 'all' ? 'all' : Number(val));
                            setIsAuditDropdownExpanded(true);
                          }}
                          className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border-2 border-emerald-500/80 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer transition shadow-2xs"
                        >
                          <option value="all">
                            📋 كافة عمليات الجرد المسجلة ({itemAuditHistory.length} عمليات)
                          </option>
                          {itemAuditHistory.map((rec, idx) => (
                            <option key={idx} value={idx}>
                              📌 عمود: {rec.columnNo} | كمية: {rec.auditedQty} {rec.unit} | الجارد: {rec.auditorName} ({rec.sessionDate})
                            </option>
                          ))}
                        </select>

                        {selectedAuditRecordIdx !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setSelectedAuditRecordIdx('all')}
                            className="text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 px-3 py-2 rounded-xl shrink-0 transition cursor-pointer"
                          >
                            عرض الكل
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable / Collapsible Records List under Dropdown */}
                    {isAuditDropdownExpanded && (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pt-1">
                        {itemAuditHistory
                          .filter((_, idx) => selectedAuditRecordIdx === 'all' || selectedAuditRecordIdx === idx)
                          .map((rec, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setSelectedColumnForModal(rec.columnNo);
                                setIsColumnsModalOpen(true);
                              }}
                              className="flex items-center justify-between p-2.5 bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl text-xs transition cursor-pointer group"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900">{rec.sessionTitle}</span>
                                  <span className="bg-emerald-600 text-white font-mono font-black text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                    <MapPin className="w-3 h-3 text-emerald-200" />
                                    عمود: {rec.columnNo}
                                  </span>
                                </div>

                                <div className="text-[10px] text-slate-600 flex items-center gap-2 flex-wrap font-medium">
                                  <span>المستخدم المدخل: <strong className="text-slate-900 font-bold bg-sky-100 text-sky-900 px-1.5 py-0.5 rounded border border-sky-200">{rec.createdBy || rec.auditorName}</strong></span>
                                  <span>•</span>
                                  <span>التاريخ: {rec.sessionDate}</span>
                                  {rec.expiryDate && rec.expiryDate !== 'غير محدد' && (
                                    <>
                                      <span>•</span>
                                      <span className="text-amber-800 font-black bg-amber-100/80 px-1.5 py-0.2 rounded">
                                        الصلاحية: {rec.expiryDate}
                                      </span>
                                    </>
                                  )}
                                  {rec.notes && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-600 italic">"{rec.notes}"</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-left font-mono shrink-0">
                                <div className="font-black text-emerald-800 text-sm">
                                  {rec.auditedQty} {rec.unit}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Search className="w-12 h-12 mx-auto text-emerald-500/40 animate-pulse" />
              <h3 className="font-bold text-sm sm:text-base text-slate-800">ادخل اسم الصنف أو كوده أو امسح الباركود للبدء بالاستعلام</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                اكتب كلمة البحث في شريط البحث أعلاه أو اضغط على أحد الأصناف بالقائمة لعرض بطاقة بيانات الصنف الشاملة والأسعار والتكلفة والباركودات
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Barcode Camera Scanner Modal */}
      {isScannerOpen && (
        <CameraBarcodeScanner
          isOpen={isScannerOpen}
          onDetected={handleBarcodeScanned}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Audited Columns Breakdown Modal Popup */}
      {isColumnsModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 dir-rtl">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Columns className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-100 flex items-center gap-2">
                    <span>توزيع أعمدة ورفوف الجرد</span>
                    <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">
                      {activeItem.code}
                    </span>
                  </h3>
                  <p className="text-xs text-sky-300/80 font-bold truncate max-w-md">
                    {activeItem.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsColumnsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar by Column */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 shrink-0 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  تصفية بالعمود:
                </span>
                <button
                  onClick={() => setSelectedColumnForModal(null)}
                  className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedColumnForModal === null
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  جميع الأعمدة ({itemColumnsSummary.length})
                </button>

                {itemColumnsSummary.map((col) => (
                  <button
                    key={col.columnNo}
                    onClick={() => setSelectedColumnForModal(col.columnNo)}
                    className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedColumnForModal === col.columnNo
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    عمود {col.columnNo}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono font-bold text-slate-500 shrink-0">
                إجمالي المجرود: <span className="text-sky-700 font-black">{itemAuditHistory.reduce((sum, r) => sum + r.auditedQty, 0)}</span>
              </div>
            </div>

            {/* Modal Content / Table */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl">
                  <span className="text-[11px] font-bold text-sky-800 block">الأعمدة المجرودة</span>
                  <span className="text-lg font-mono font-black text-sky-950">
                    {itemColumnsSummary.length} {itemColumnsSummary.length === 1 ? 'عمود' : 'أعمدة'}
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                  <span className="text-[11px] font-bold text-emerald-800 block">مرات الجرد التسجيلية</span>
                  <span className="text-lg font-mono font-black text-emerald-950">
                    {itemAuditHistory.length} عمليات
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-bold text-slate-600 block">إجمالي الكميات المجرودة</span>
                  <span className="text-sm font-mono font-black text-slate-900 truncate block">
                    {itemColumnsSummary.map(c => c.unitsText).join(' | ') || '0'}
                  </span>
                </div>
              </div>

              {/* Detailed Entries Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>تفاصيل سجلات الجرد حسب العمود</span>
                  {selectedColumnForModal && (
                    <span className="text-sky-700 text-[11px] bg-sky-100 px-2 py-0.5 rounded-md">
                      عمود: {selectedColumnForModal}
                    </span>
                  )}
                </h4>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-slate-200 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">رقم العمود/الرف</th>
                        <th className="p-2.5">الكمية</th>
                        <th className="p-2.5">الوحدة</th>
                        <th className="p-2.5">جلسة الجرد والجارد</th>
                        <th className="p-2.5">التاريخ</th>
                        <th className="p-2.5">الصلاحية</th>
                        <th className="p-2.5">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {itemAuditHistory
                        .filter((r) => selectedColumnForModal === null || r.columnNo === selectedColumnForModal)
                        .map((rec, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 font-medium">
                            <td className="p-2.5 font-mono font-black text-sky-900 bg-sky-50/50">
                              <span className="inline-flex items-center gap-1 bg-sky-100 px-2 py-0.5 rounded-md text-sky-950">
                                <MapPin className="w-3 h-3 text-sky-600" />
                                {rec.columnNo}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono font-black text-emerald-700 text-sm">
                              {rec.auditedQty}
                            </td>
                            <td className="p-2.5 font-bold text-slate-700">
                              {rec.unit}
                            </td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-900">{rec.sessionTitle}</div>
                              <div className="text-[10px] text-slate-500">الجارد: {rec.auditorName}</div>
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                              {rec.sessionDate}
                            </td>
                            <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                              {rec.expiryDate}
                            </td>
                            <td className="p-2.5 text-slate-500 italic max-w-[150px] truncate">
                              {rec.notes || '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>طباعة تقرير الأعمدة</span>
              </button>

              <button
                onClick={() => setIsColumnsModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && editingItemData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">تعديل بيانات الصنف والأسعار</h3>
                  <p className="text-[11px] text-slate-400">كود الصنف: <span className="font-mono text-emerald-400">{editingItemData.code}</span></p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveItemEdit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs font-bold">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Item Code */}
                <div>
                  <label className="block text-slate-700 mb-1">كود الصنف / الرقم الفريد</label>
                  <input
                    type="text"
                    required
                    value={editFormCode}
                    onChange={(e) => setEditFormCode(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="مثال: 10025"
                  />
                </div>

                {/* Barcode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700">الباركود الرئيسي</label>
                    <button
                      type="button"
                      onClick={() => setIsEditBarcodeScannerOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 transition cursor-pointer"
                      title="مسح الباركود بالكاميرا"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ماسح الكاميرا</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={editFormBarcode}
                      onChange={(e) => setEditFormBarcode(e.target.value)}
                      className="w-full p-2 pl-9 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="6291100..."
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditBarcodeScannerOpen(true)}
                      className="absolute left-1.5 p-1 text-slate-500 hover:text-emerald-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                      title="فتح كاميرا ماسح الباركود"
                    >
                      <Camera className="w-4 h-4 text-emerald-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Item Arabic Name */}
              <div>
                <label className="block text-slate-700 mb-1">اسم الصنف بالعربي <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={editFormName}
                  onChange={(e) => setEditFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  placeholder="اسم الصنف بالعربي..."
                />
              </div>

              {/* Foreign Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">الاسم الأجنبي / الإنجليزي</label>
                  <input
                    type="text"
                    value={editFormForeignName}
                    onChange={(e) => setEditFormForeignName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 dir-ltr text-right focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="English Name..."
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">التصنيف / المجموعة</label>
                  <input
                    type="text"
                    value={editFormCategory}
                    onChange={(e) => setEditFormCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="مثال: أدوية، تجميل..."
                  />
                </div>
              </div>

              {/* Unit & Prices Section */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-slate-800 font-black text-xs flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  أسعار وتكلفة الوحدة الأساسية
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">اسم الوحدة الأساسية</label>
                    <input
                      type="text"
                      value={editFormUnit}
                      onChange={(e) => setEditFormUnit(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-emerald-500 outline-none"
                      placeholder="حبة"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">سعر البيع (ر.س)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormSellingPrice}
                      onChange={(e) => setEditFormSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-emerald-700 font-mono font-bold focus:border-emerald-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">التكلفة الأولية (ر.س)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormInitialCost}
                      onChange={(e) => setEditFormInitialCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:border-emerald-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {editSuccessToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500/40 flex items-center gap-2.5 animate-in slide-in-from-bottom duration-300">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs text-white">تم الحفظ بنجاح</div>
            <div className="text-[11px] text-slate-300">تم تحديث بيانات الصنف والأسعار مباشرة.</div>
          </div>
        </div>
      )}

      {/* Edit Barcode Camera Scanner */}
      <CameraBarcodeScanner
        isOpen={isEditBarcodeScannerOpen}
        title="مسح الباركود - تعديل الصنف"
        onDetected={(scannedBarcode) => {
          setEditFormBarcode(scannedBarcode);
          setIsEditBarcodeScannerOpen(false);
        }}
        onClose={() => setIsEditBarcodeScannerOpen(false)}
      />
    </div>
  );
};
