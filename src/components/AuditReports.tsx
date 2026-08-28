import React, { useState, useMemo } from 'react';
import { AuditSession, AuditRecord, Item } from '../types';
import {
  BarChart3,
  Calendar,
  FileText,
  Printer,
  FileDown,
  Trash2,
  AlertTriangle,
  Search,
  CheckCircle2,
  Eye,
  X,
  Layers,
  Columns,
  Grid,
  Filter,
  Loader2,
  Pencil,
  Edit3,
  PlusCircle,
  Save,
  RotateCcw,
  Plus,
  Scale
} from 'lucide-react';
import { exportAuditSessionToExcel, exportAllSessionsToExcel } from '../utils/excelUtils';
import { exportElementToPDF } from '../utils/pdfUtils';
import { ReportHeader, ReportFooter, TableReportFooter, ReportHeaderSettingsModal } from './ReportHeader';
import { hasUserPermission } from '../utils/userUtils';
import { round2, fmtQty, fmtDiffQty, fmtMoney, fmtDiffMoney } from '../utils/numberUtils';

interface AuditReportsProps {
  sessions: AuditSession[];
  catalogItems?: Item[];
  currentUser?: { username: string; role?: string; permissions?: string[] } | null;
  onDeleteSession: (sessionId: string) => void;
  onUpdateSession?: (session: AuditSession) => void;
  onReopenSession?: (session: AuditSession) => void;
  onDeleteMultipleSessions?: (sessionIds: string[]) => void;
}

export const AuditReports: React.FC<AuditReportsProps> = ({
  sessions,
  catalogItems = [],
  currentUser,
  onDeleteSession,
  onUpdateSession,
  onReopenSession,
  onDeleteMultipleSessions
}) => {
  const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'sessions' | 'expiry'>('sessions');

  // Modal View & Filter States
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  const [filterColumn, setFilterColumn] = useState<string>('all');
  const [isPrintByColumnModalOpen, setIsPrintByColumnModalOpen] = useState(false);
  const [selectedColumnToPrint, setSelectedColumnToPrint] = useState<string>('all');
  const [isHeaderSettingsModalOpen, setIsHeaderSettingsModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [customVoucherType, setCustomVoucherType] = useState('سند جرد مخزني');
  const [customStatement, setCustomStatement] = useState('محضر جرد وتدقيق المواد والأصناف المخزنية');

  // Print & Preview Options (خيارات الطباعة والاستعراض - أعمدة مخصصة)
  const [showCost, setShowCost] = useState(true);
  const [showSellingPrice, setShowSellingPrice] = useState(true);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showCreatedBy, setShowCreatedBy] = useState(false);
  const [showColumnNo, setShowColumnNo] = useState(false);
  const [showVarianceMatching, setShowVarianceMatching] = useState(false);

  // Helper to get Available System Stock for an AuditRecord
  const getRecordSystemStock = (record: AuditRecord): number => {
    if (typeof (record as any).systemQty === 'number') return (record as any).systemQty;
    if (typeof (record as any).systemStock === 'number') return (record as any).systemStock;
    const match = (catalogItems || []).find(
      (item) => item.id === record.itemId || item.code === record.itemCode || (record.barcode && item.barcode === record.barcode)
    );
    if (match) {
      return match.currentStock ?? match.quantity ?? 0;
    }
    return 0;
  };

  // Selected Record Detail Modal Popup
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<{
    record: any;
    sessionTitle: string;
    sessionDate: string;
    auditorName: string;
  } | null>(null);

  // --- EDIT SAVED AUDIT SESSION STATES & HANDLERS ---
  // Session Header Edit State
  const [isEditingSessionHeader, setIsEditingSessionHeader] = useState(false);
  const [editSessionTitle, setEditSessionTitle] = useState('');
  const [editAuditorName, setEditAuditorName] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionNotes, setEditSessionNotes] = useState('');

  // Single Record Edit State
  const [editingRecord, setEditingRecord] = useState<AuditRecord | null>(null);
  const [editRecordQty, setEditRecordQty] = useState<number | ''>('');
  const [editRecordColumnNo, setEditRecordColumnNo] = useState('1');
  const [editRecordUnit, setEditRecordUnit] = useState('حبة');
  const [editRecordExpiryDate, setEditRecordExpiryDate] = useState('');
  const [editRecordInitialCost, setEditRecordInitialCost] = useState<number>(0);
  const [editRecordSellingPrice, setEditRecordSellingPrice] = useState<number>(0);
  const [editRecordNotes, setEditRecordNotes] = useState('');

  // Add Item to Session State
  const [isAddingRecordModalOpen, setIsAddingRecordModalOpen] = useState(false);
  const [addRecordSearchTerm, setAddRecordSearchTerm] = useState('');
  const [selectedItemForAdd, setSelectedItemForAdd] = useState<Item | null>(null);
  const [addRecordQty, setAddRecordQty] = useState<number | ''>(1);
  const [addRecordColumnNo, setAddRecordColumnNo] = useState('1');
  const [addRecordUnit, setAddRecordUnit] = useState('حبة');
  const [addRecordExpiryDate, setAddRecordExpiryDate] = useState('');

  // Handler: Start Editing Session Header
  const handleStartEditSessionHeader = () => {
    if (!selectedSession) return;
    setEditSessionTitle(selectedSession.title);
    setEditAuditorName(selectedSession.auditorName);
    setEditSessionDate(selectedSession.date);
    setEditSessionNotes(selectedSession.notes || '');
    setIsEditingSessionHeader(true);
  };

  // Handler: Save Session Header
  const handleSaveSessionHeader = () => {
    if (!selectedSession) return;
    const updated: AuditSession = {
      ...selectedSession,
      title: editSessionTitle.trim() || selectedSession.title,
      auditorName: editAuditorName.trim() || selectedSession.auditorName,
      date: editSessionDate || selectedSession.date,
      notes: editSessionNotes
    };
    setSelectedSession(updated);
    if (onUpdateSession) onUpdateSession(updated);
    setIsEditingSessionHeader(false);
  };

  // Handler: Open Single Record Edit Modal
  const handleOpenEditRecordModal = (rec: AuditRecord) => {
    setEditingRecord(rec);
    setEditRecordQty(rec.auditedQty);
    setEditRecordColumnNo(rec.columnNo || '1');
    setEditRecordUnit(rec.unit || 'حبة');
    setEditRecordExpiryDate(rec.expiryDate || '');
    setEditRecordInitialCost(rec.initialCost || 0);
    setEditRecordSellingPrice(rec.sellingPrice || 0);
    setEditRecordNotes(rec.notes || '');
  };

  // Handler: Save Single Record Edits
  const handleSaveEditedRecord = () => {
    if (!selectedSession || !editingRecord) return;
    const qty = editRecordQty === '' ? 0 : Number(editRecordQty);
    const cost = Number(editRecordInitialCost) || 0;
    const price = Number(editRecordSellingPrice) || 0;

    const updatedRecords = selectedSession.records.map((r) => {
      if (r.id === editingRecord.id || (r.itemCode === editingRecord.itemCode && r.timestamp === editingRecord.timestamp)) {
        return {
          ...r,
          auditedQty: qty,
          columnNo: editRecordColumnNo.trim() || '1',
          unit: editRecordUnit.trim() || 'حبة',
          expiryDate: editRecordExpiryDate.trim() || 'غير محدد',
          initialCost: cost,
          sellingPrice: price,
          totalCostValue: Number((qty * cost).toFixed(2)),
          totalSellingValue: Number((qty * price).toFixed(2)),
          notes: editRecordNotes
        };
      }
      return r;
    });

    const updatedSession: AuditSession = {
      ...selectedSession,
      records: updatedRecords
    };

    setSelectedSession(updatedSession);
    if (onUpdateSession) onUpdateSession(updatedSession);
    setEditingRecord(null);
  };

  // Handler: Delete Record from Saved Session
  const handleDeleteRecordFromSession = (recordId: string) => {
    if (!selectedSession) return;
    if (!confirm('هل ترغب بتأكيد حذف هذا العنصر من الجلسة المحفوظة؟')) return;

    const updatedRecords = selectedSession.records.filter((r) => r.id !== recordId);
    const updatedSession: AuditSession = {
      ...selectedSession,
      records: updatedRecords
    };

    setSelectedSession(updatedSession);
    if (onUpdateSession) onUpdateSession(updatedSession);
  };

  // Filter items for adding new record to session
  const filteredCatalogForAdd = useMemo(() => {
    if (!addRecordSearchTerm.trim()) return [];
    const q = addRecordSearchTerm.toLowerCase().trim();
    return catalogItems.filter(
      (it) =>
        it.code.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.barcode && it.barcode.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [catalogItems, addRecordSearchTerm]);

  // Handler: Save New Record to Saved Session
  const handleSaveNewRecordToSession = () => {
    if (!selectedSession || !selectedItemForAdd) return;
    const qty = addRecordQty === '' ? 1 : Number(addRecordQty);
    const cost = selectedItemForAdd.initialCost || 0;
    const price = selectedItemForAdd.sellingPrice || selectedItemForAdd.price || 0;

    const newRecord: AuditRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      auditSessionId: selectedSession.id,
      itemId: selectedItemForAdd.id,
      itemCode: selectedItemForAdd.code,
      itemName: selectedItemForAdd.name,
      foreignName: selectedItemForAdd.foreignName,
      barcode: selectedItemForAdd.barcode,
      unit: addRecordUnit || selectedItemForAdd.unit || 'حبة',
      columnNo: addRecordColumnNo.trim() || '1',
      expiryDate: addRecordExpiryDate.trim() || selectedItemForAdd.expiryDate || 'غير محدد',
      auditedQty: qty,
      initialCost: cost,
      sellingPrice: price,
      totalCostValue: Number((qty * cost).toFixed(2)),
      totalSellingValue: Number((qty * price).toFixed(2)),
      timestamp: new Date().toISOString(),
      createdBy: currentUser?.username || 'مسؤول الجرد'
    };

    const updatedSession: AuditSession = {
      ...selectedSession,
      records: [newRecord, ...selectedSession.records]
    };

    setSelectedSession(updatedSession);
    if (onUpdateSession) onUpdateSession(updatedSession);

    // Reset add state
    setSelectedItemForAdd(null);
    setAddRecordSearchTerm('');
    setAddRecordQty(1);
    setIsAddingRecordModalOpen(false);
  };

  // Master Consolidated Report Modal State
  const [isMasterReportModalOpen, setIsMasterReportModalOpen] = useState(false);
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [masterFilterColumn, setMasterFilterColumn] = useState('all');

  // Combined Records across ALL Sessions
  const allAuditedRecordsCombined = useMemo(() => {
    const result: { sessionTitle: string; sessionDate: string; auditorName: string; record: any }[] = [];
    (sessions || []).forEach((s) => {
      (s.records || []).forEach((r) => {
        result.push({
          sessionTitle: s.title,
          sessionDate: s.date,
          auditorName: s.auditorName,
          record: r
        });
      });
    });
    return result;
  }, [sessions]);

  const filteredMasterRecords = useMemo(() => {
    return allAuditedRecordsCombined.filter((item) => {
      const query = masterSearchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        item.record.itemCode?.toLowerCase().includes(query) ||
        item.record.itemName?.toLowerCase().includes(query) ||
        item.record.barcode?.includes(query) ||
        item.sessionTitle?.toLowerCase().includes(query) ||
        (item.record.columnNo && item.record.columnNo.toString().includes(query));

      const matchesColumn =
        masterFilterColumn === 'all' || (item.record.columnNo || '1') === masterFilterColumn;

      return matchesSearch && matchesColumn;
    });
  }, [allAuditedRecordsCombined, masterSearchQuery, masterFilterColumn]);

  const masterColumnsList = useMemo(() => {
    const cols = new Set<string>();
    allAuditedRecordsCombined.forEach((item) => {
      cols.add(item.record.columnNo || '1');
    });
    return Array.from(cols).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'ar');
    });
  }, [allAuditedRecordsCombined]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.auditorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.date.includes(searchQuery)
    );
  }, [sessions, searchQuery]);

  // Expiration warning calculation (items with expiry date set in records)
  const expiringRecords = useMemo(() => {
    const today = new Date();
    const result: { sessionTitle: string; sessionDate: string; record: any; daysLeft: number }[] = [];

    sessions.forEach((s) => {
      s.records.forEach((r) => {
        if (r.expiryDate && r.expiryDate !== 'غير محدد') {
          const exp = new Date(r.expiryDate);
          if (!isNaN(exp.getTime())) {
            const diffTime = exp.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (daysLeft <= 90) { // within 90 days or expired
              result.push({
                sessionTitle: s.title,
                sessionDate: s.date,
                record: r,
                daysLeft
              });
            }
          }
        }
      });
    });

    return result.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [sessions]);

  // Overall Financial Stats across completed audits
  const totalAuditsCount = sessions.length;
  const totalItemsAuditedAll = sessions.reduce(
    (sum, s) => sum + s.records.reduce((rSum, r) => rSum + r.auditedQty, 0),
    0
  );
  const totalCostValAll = sessions.reduce(
    (sum, s) => sum + s.records.reduce((rSum, r) => rSum + r.totalCostValue, 0),
    0
  );
  const totalSellingValAll = sessions.reduce(
    (sum, s) => sum + s.records.reduce((rSum, r) => rSum + r.totalSellingValue, 0),
    0
  );

  // Column Grouping & Filtering for Selected Session
  const sessionColumns = useMemo(() => {
    if (!selectedSession) return [];
    const cols = new Set<string>();
    selectedSession.records.forEach((r) => {
      cols.add(r.columnNo || '1');
    });
    return Array.from(cols).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'ar');
    });
  }, [selectedSession]);

  const sessionRecordsByColumn = useMemo(() => {
    if (!selectedSession) return new Map<string, typeof selectedSession.records>();
    const map = new Map<string, typeof selectedSession.records>();
    selectedSession.records.forEach((r) => {
      const col = r.columnNo || '1';
      if (!map.has(col)) map.set(col, []);
      map.get(col)!.push(r);
    });
    return map;
  }, [selectedSession]);

  return (
    <div className="space-y-3 sm:space-y-4">
      
      {/* Main Page Content - Hidden on Print */}
      <div className="space-y-3 sm:space-y-4 print:hidden">
        
        {/* Full Master Audit Print Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-4 sm:p-4.5 rounded-2xl border border-emerald-500/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
              <Printer className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>طباعة تقرير الجرد الشامل لكافة المجرودات</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                  {totalItemsAuditedAll} قطعة مجرودة
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                توليد وطباعة تقرير متكامل يتضمن جميع الأصناف والكميات المجرودة عبر كافة الجلسات والسلسلات المعتمدة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsMasterReportModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>طباعة تقرير الجرد الكامل</span>
            </button>

            <button
              type="button"
              onClick={() => exportAllSessionsToExcel(sessions)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 transition cursor-pointer flex items-center justify-center gap-1.5"
              title="تصدير جميع المجرودات لملف إكسل واحد"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>إكسل شامل</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 truncate">إجمالي عمليات الجرد</p>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{totalAuditsCount}</h3>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 truncate">إجمالي الكميات</p>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{totalItemsAuditedAll}</h3>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 truncate">قيمة التكلفة الإجمالية</p>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 truncate">
              {totalCostValAll.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 truncate">تنبيهات الانتهاء</p>
            <h3 className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">{expiringRecords.length}</h3>
          </div>
        </div>

      </div>

      {/* Tabs Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition ${
              activeTab === 'sessions'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سجلات الجرد المخزني ({sessions.length})
          </button>

          <button
            onClick={() => setActiveTab('expiry')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition ${
              activeTab === 'expiry'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تنبيهات تواريخ الانتهاء ({expiringRecords.length})
          </button>
        </div>

        {activeTab === 'sessions' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالعنوان، التاريخ، أو اسم المسؤول..."
              className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Sessions List */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <FileText className="w-12 h-12 mx-auto text-slate-300" />
              <p className="font-bold text-sm text-slate-600">لا توجد جلسات جرد سابقة محفوظة</p>
              <p className="text-xs text-slate-400">قم بتنفيذ عملية جرد من نموذج الجرد لحفظها هنا</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSessions.map((session) => {
                const totalQty = session.records.reduce((sum, r) => sum + r.auditedQty, 0);
                const totalCost = session.records.reduce((sum, r) => sum + r.totalCostValue, 0);
                const totalSelling = session.records.reduce((sum, r) => sum + r.totalSellingValue, 0);

                return (
                  <div
                    key={session.id}
                    className="p-5 hover:bg-slate-50 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">{session.title}</h4>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold">
                          مكتمل
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          التاريخ: {session.date}
                        </span>
                        <span>•</span>
                        <span>القائم بالجرد: <strong className="text-slate-800">{session.auditorName}</strong></span>
                        <span>•</span>
                        <span>عدد الأصناف: <strong className="text-slate-800">{session.records.length}</strong></span>
                        <span>•</span>
                        <span>إجمالي الكمية: <strong className="text-slate-800">{fmtQty(totalQty)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-left font-bold text-xs">
                        <span className="text-slate-500 block">إجمالي القيمة:</span>
                        <span className="text-slate-900 text-sm font-black">{fmtMoney(totalCost)} تكلفة</span>
                        <span className="text-emerald-600 block">{fmtMoney(totalSelling)} بيع</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setSelectedSession(session)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-2xs"
                          title="استعراض وطباعة تقرير شامل لجميع المجرودات"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>عرض وتعديل</span>
                        </button>

                        {onReopenSession && (
                          <button
                            onClick={() => {
                              if (confirm(`هل ترغب بفتح الجلسة (${session.title}) في شاشة الجرد الميداني للتعديل والاستكمال؟`)) {
                                onReopenSession(session);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-2xs"
                            title="فتح الجلسة في شاشة الجرد الميداني لاستكمالها والتعديل عليها"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-950" />
                            <span>استكمال الجرد</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedSession(session);
                            setIsPrintByColumnModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition"
                          title="طباعة تقرير الجرد مخصصاً بحسب رقم العمود"
                        >
                          <Columns className="w-3.5 h-3.5 text-emerald-600" />
                          <span>طباعة بحسب العمود</span>
                        </button>

                        <button
                          onClick={() => exportAuditSessionToExcel(session)}
                          className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition border border-emerald-200"
                          title="تصدير إكسل"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('هل ترغب بتأكيد حذف سجل الجرد هذا؟')) {
                              onDeleteSession(session.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Expiration Warnings */}
      {activeTab === 'expiry' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              أصناف قريبة من انتهاء الصلاحية (خلال 90 يوماً أو منتهية)
            </h3>
            <span className="text-xs text-slate-500">
              عدد الأصناف المتأثرة: <strong className="text-amber-600">{expiringRecords.length}</strong>
            </span>
          </div>

          {expiringRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm">ممتاز! لا توجد مواد قريبة الانتهاء في سجلات الجرد الحالية</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">رقم الصنف</th>
                    <th className="py-3 px-3">اسم الصنف</th>
                    <th className="py-3 px-3">الباركود</th>
                    <th className="py-3 px-3">تاريخ الانتهاء</th>
                    <th className="py-3 px-3">الأيام المتبقية</th>
                    <th className="py-3 px-3">كمية الجرد</th>
                    <th className="py-3 px-3">جلسة الجرد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expiringRecords.map((item, index) => {
                    const isExpired = item.daysLeft < 0;
                    return (
                      <tr key={index} className="hover:bg-amber-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {item.record.itemCode}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 truncate">
                          {item.record.itemName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {item.record.barcode}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-red-600">
                          {item.record.expiryDate}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          {isExpired ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-md">
                              منتهي الصلاحية ({Math.abs(item.daysLeft)} يوم مضت)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md">
                              متبقي {item.daysLeft} يوم
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.record.auditedQty} {item.record.unit}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.sessionTitle} ({item.sessionDate})
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Detailed Report Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
          <div id="printable-audit-report" className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden my-4 sm:my-6 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:overflow-visible">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div>
                <h3 className="font-bold text-lg">تقرير نموذج الجرد التفصيلي بالسجلات</h3>
                <p className="text-xs text-slate-400">
                  {selectedSession.title} • القائم بالجرد: {selectedSession.auditorName} • بتاريخ: {selectedSession.date}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartEditSessionHeader}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="تعديل عنوان الجلسة، اسم القائم بالجرد والتاريخ"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-950" />
                  <span>تعديل الجلسة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingRecordModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="إضافة صنف جديد إلى هذه الجلسة المحفوظة"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-slate-950" />
                  <span>إضافة صنف</span>
                </button>

                {onReopenSession && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`هل ترغب بفتح الجلسة (${selectedSession.title}) في شاشة الجرد الميداني للتعديل والاستكمال؟`)) {
                        onReopenSession(selectedSession);
                      }
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="فتح هذه الجلسة في شاشة الجرد الميداني لاستكمالها بالحاسبة والماسح"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-white" />
                    <span>الجرد الميداني</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsPrintByColumnModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Columns className="w-4 h-4" />
                  <span>طباعة بحسب العمود</span>
                </button>

                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-3 max-h-[80vh] overflow-y-auto print:p-0 print:space-y-2 print:max-h-none print:overflow-visible">
              
              {/* Print & Preview Controls Toolbar (شريط خيارات الطباعة والاستعراض) */}
              <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 space-y-2.5 no-print print:hidden my-1">
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

                    <button
                      type="button"
                      onClick={() => setShowVarianceMatching(!showVarianceMatching)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        showVarianceMatching
                          ? 'bg-amber-400 text-slate-950 font-black shadow-md border border-amber-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title="إظهار المخزون المتوفر بالنظام ومطابقة العجز والفائض"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>مطابقة العجز والفائض</span>
                    </button>
                  </div>
                </div>

                {/* Individual Checkbox Toggles */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 border-t border-slate-800/80 text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-amber-950/40 hover:bg-amber-900/60 px-2.5 py-1 rounded-xl border border-amber-600/60">
                    <input
                      type="checkbox"
                      checked={showVarianceMatching}
                      onChange={(e) => setShowVarianceMatching(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-amber-500 cursor-pointer"
                    />
                    <span className={showVarianceMatching ? 'text-amber-300 font-black' : 'text-slate-300'}>
                      مطابقة العجز والفائض (المخزون المتوفر)
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                    <input
                      type="checkbox"
                      checked={showBarcode}
                      onChange={(e) => setShowBarcode(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <span className={showBarcode ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                      عمود رقم الباركود
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                    <input
                      type="checkbox"
                      checked={showCreatedBy}
                      onChange={(e) => setShowCreatedBy(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <span className={showCreatedBy ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                      عمود المدخل
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                    <input
                      type="checkbox"
                      checked={showColumnNo}
                      onChange={(e) => setShowColumnNo(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <span className={showColumnNo ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                      عمود العمود/الرف
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                    <input
                      type="checkbox"
                      checked={showCost}
                      onChange={(e) => setShowCost(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <span className={showCost ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                      أعمدة التكلفة
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                    <input
                      type="checkbox"
                      checked={showSellingPrice}
                      onChange={(e) => setShowSellingPrice(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <span className={showSellingPrice ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                      أعمدة سعر البيع
                    </span>
                  </label>
                </div>
              </div>

              {/* View mode & Column Filter Toolbar */}
              <div className="hidden flex-wrap items-center justify-between gap-3 bg-slate-100/80 p-3 rounded-2xl border border-slate-200 text-xs no-print print:hidden">
                {/* View Switcher */}
                <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 font-bold">
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className={`px-3 py-1 rounded-lg transition ${
                      viewMode === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    عرض موحد
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                      viewMode === 'grouped'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>تجميع بحسب العمود</span>
                  </button>
                </div>

                {/* Filter Selector */}
                {sessionColumns.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-slate-500">فلترة بالعمود:</span>
                    <select
                      value={filterColumn}
                      onChange={(e) => setFilterColumn(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="all">كافة الأعمدة ({selectedSession.records.length} صنف)</option>
                      {sessionColumns.map((col) => {
                        const count = sessionRecordsByColumn.get(col)?.length || 0;
                        return (
                          <option key={col} value={col}>
                            عمود رقم {col} ({count} صنف)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* View Content: Grouped or Unified */}
              {viewMode === 'grouped' ? (
                /* Grouped View By Column */
                <div className="space-y-6 print:space-y-4">
                  {sessionColumns
                    .filter((col) => filterColumn === 'all' || filterColumn === col)
                    .map((col, colIdx) => {
                      const colRecords = sessionRecordsByColumn.get(col) || [];
                      const colTotalQty = colRecords.reduce((sum, r) => sum + r.auditedQty, 0);
                      const colTotalCost = colRecords.reduce((sum, r) => sum + (r.totalCostValue || r.auditedQty * r.initialCost), 0);
                      const colTotalSelling = colRecords.reduce((sum, r) => sum + (r.totalSellingValue || r.auditedQty * r.sellingPrice), 0);

                      return (
                        <div key={col} className="border-2 border-slate-700 rounded-xl overflow-x-auto print:overflow-visible shadow-none my-3 bg-white">
                          <table className="w-full text-right text-xs border-collapse border border-slate-700">
                            <thead className="print:table-header-group">
                              {/* Top Report Header inside thead so it repeats on every printed page */}
                              {colIdx === 0 && (
                                <tr className="border-none bg-white">
                                  <td colSpan={15} className="p-0 border-none pb-1 text-right bg-white font-normal">
                                    <div className="bg-white space-y-1 my-1">
                                      <ReportHeader
                                        reportTitle={filterColumn !== 'all' ? `بيانات التقرير - عمود رقم ${filterColumn}` : "بيانات التقرير - تجميع بحسب العمود"}
                                        reportDate={selectedSession.date}
                                        onOpenSettings={() => setIsHeaderSettingsModalOpen(true)}
                                        hideEditButton={true}
                                      />

                                      {/* بيانات التقرير - Report Info Block */}
                                      <div className="bg-slate-50 border border-slate-300 rounded-lg p-1.5 px-2 text-xs space-y-1 print:bg-white print:border-slate-400 my-1">
                                        <div className="grid grid-cols-2 gap-1.5 text-slate-800">
                                          <div className="bg-white py-1 px-2 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                            <span className="text-slate-500 font-bold text-[11px] shrink-0 whitespace-nowrap">التاريخ:</span>
                                            <span className="font-mono font-bold text-slate-900 text-xs whitespace-nowrap">{selectedSession.date}</span>
                                          </div>
                                          <div className="bg-white py-1 px-2 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                            <span className="text-slate-500 font-bold text-[11px] shrink-0 whitespace-nowrap">نوع السند:</span>
                                            <input
                                              type="text"
                                              value={customVoucherType}
                                              onChange={(e) => setCustomVoucherType(e.target.value)}
                                              className="w-full font-bold text-indigo-900 text-xs bg-transparent border-none p-0 focus:ring-0 text-left print:border-none whitespace-nowrap"
                                              placeholder="نوع السند"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              <tr className="border-none bg-white">
                                <td colSpan={15} className="p-0 border-none pb-1 text-right bg-white">
                                  {/* Column Group Header Banner */}
                                  <div className="bg-slate-200 text-slate-900 p-1 px-3 flex flex-wrap items-center justify-between gap-2 border border-slate-700 rounded-md font-bold text-xs my-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center font-black text-[11px]">
                                        {col}
                                      </span>
                                      <h4 className="font-black text-xs text-slate-900 whitespace-nowrap">العمود / الرف رقم: {col}</h4>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs font-bold whitespace-nowrap">
                                      <span>عدد الأصناف: <strong className="font-mono">{colRecords.length}</strong></span>
                                      <span>إجمالي الكمية: <strong className="font-mono">{fmtQty(colTotalQty)}</strong></span>
                                      <span>إجمالي التكلفة: <strong className="font-mono">{fmtMoney(colTotalCost)} SAR</strong></span>
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              <tr className="bg-[#c2d7ed] text-slate-900 font-bold border-b-2 border-slate-700 print:bg-[#c2d7ed]">
                                <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">مـ</th>
                                {showColumnNo && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">العمود/الرف</th>
                                )}
                                <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">رقم الصنف</th>
                                <th className="py-1.5 px-1.5 border border-slate-700 text-right font-bold bg-[#c2d7ed] min-w-[140px] text-[11px]">اسم الصنف</th>
                                {showBarcode && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الباركود</th>
                                )}
                                <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الوحدة</th>
                                <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">تاريخ الانتهاء</th>
                                {showCreatedBy && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">المستخدم المدخل</th>
                                )}
                                <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">ك. الجرد</th>
                                {showVarianceMatching && (
                                  <>
                                    <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">ك. المتوفرة</th>
                                    <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">ك. الفارق</th>
                                  </>
                                )}
                                {showCost && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">التكلفة</th>
                                )}
                                {showSellingPrice && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">السعر</th>
                                )}
                                {showCost && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">إجمالي التكلفة</th>
                                )}
                                {showSellingPrice && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">اجمالي السعر</th>
                                )}
                                {showVarianceMatching && showCost && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">فارق التكلفة</th>
                                )}
                                {showVarianceMatching && showSellingPrice && (
                                  <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">فارق البيع</th>
                                )}
                                <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px] no-print print:hidden">إجراءات</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white print:table-row-group">
                              {colRecords.map((rec, i) => {
                                const totalCost = rec.totalCostValue || round2(rec.auditedQty * rec.initialCost);
                                const totalSelling = rec.totalSellingValue || round2(rec.auditedQty * rec.sellingPrice);
                                const sysStock = getRecordSystemStock(rec);
                                const diff = round2(rec.auditedQty - sysStock);
                                const diffCost = round2(diff * rec.initialCost);
                                const diffSelling = round2(diff * rec.sellingPrice);
                                return (
                                  <tr
                                    key={i}
                                    onClick={() => setSelectedRecordDetail({
                                      record: rec,
                                      sessionTitle: selectedSession.title,
                                      sessionDate: selectedSession.date,
                                      auditorName: selectedSession.auditorName
                                    })}
                                    className="hover:bg-sky-50 transition cursor-pointer break-inside-avoid print:break-inside-avoid"
                                    title="انقر لعرض تفاصيل هذا السجل بالعمود"
                                  >
                                    <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-800 whitespace-nowrap text-[11px]">{i + 1}</td>
                                    {showColumnNo && (
                                      <td className="py-1 px-1.5 border border-slate-700 font-mono font-black text-center text-indigo-900 bg-indigo-50/70 whitespace-nowrap text-[11px]">📌 {rec.columnNo || col}</td>
                                    )}
                                    <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.itemCode}</td>
                                    <td className="py-1 px-1.5 border border-slate-700 font-bold text-right text-slate-900 text-[11px]">{rec.itemName}</td>
                                    {showBarcode && (
                                      <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.barcode || '-'}</td>
                                    )}
                                    <td className="py-1 px-1.5 border border-slate-700 font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.unit}</td>
                                    <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.expiryDate || '-'}</td>
                                    {showCreatedBy && (
                                      <td className="py-1 px-1.5 border border-slate-700 font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.createdBy || selectedSession.auditorName || 'مسؤول الجرد'}</td>
                                    )}
                                    <td className="py-1 px-1.5 border border-slate-700 text-center font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">{fmtQty(rec.auditedQty)}</td>
                                    {showVarianceMatching && (
                                      <>
                                        <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-900 bg-amber-50/50 whitespace-nowrap text-[11px]">{fmtQty(sysStock)}</td>
                                        <td className="py-1 px-1.5 border border-slate-700 font-mono font-black text-center whitespace-nowrap text-[11px]">
                                          {diff === 0 ? (
                                            <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">0</span>
                                          ) : diff > 0 ? (
                                            <span className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold">+{fmtQty(diff)}</span>
                                          ) : (
                                            <span className="text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{fmtQty(diff)}</span>
                                          )}
                                        </td>
                                      </>
                                    )}
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
                                    {showVarianceMatching && showCost && (
                                      <td className={`py-1 px-1.5 border border-slate-700 text-center font-mono font-bold whitespace-nowrap text-[11px] ${diffCost === 0 ? 'text-slate-700' : diffCost > 0 ? 'text-blue-700 font-black' : 'text-rose-700 font-black'}`}>
                                        {fmtDiffMoney(diffCost)}
                                      </td>
                                    )}
                                    {showVarianceMatching && showSellingPrice && (
                                      <td className={`py-1 px-1.5 border border-slate-700 text-center font-mono font-bold whitespace-nowrap text-[11px] ${diffSelling === 0 ? 'text-slate-700' : diffSelling > 0 ? 'text-blue-700 font-black' : 'text-rose-700 font-black'}`}>
                                        {fmtDiffMoney(diffSelling)}
                                      </td>
                                    )}
                                    <td className="py-1 px-1.5 border border-slate-700 text-center whitespace-nowrap no-print print:hidden">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditRecordModal(rec);
                                          }}
                                          className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold text-[10px] flex items-center gap-0.5 transition cursor-pointer"
                                          title="تعديل هذا العنصر"
                                        >
                                          <Pencil className="w-3 h-3 text-amber-800" />
                                          <span>تعديل</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRecordFromSession(rec.id);
                                          }}
                                          className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-900 rounded font-bold text-[10px] flex items-center gap-0.5 transition cursor-pointer"
                                          title="حذف هذا العنصر"
                                        >
                                          <Trash2 className="w-3 h-3 text-red-800" />
                                          <span>حذف</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-700 text-slate-900 break-inside-avoid print:break-inside-avoid">
                              <td colSpan={5 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0)} className="py-1 px-1.5 border border-slate-700 text-left font-black whitespace-nowrap text-[11px]">إجمالي العمود {col}:</td>
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtQty(colTotalQty)}</td>
                              {showVarianceMatching && (() => {
                                const colTotalSys = colRecords.reduce((sum, r) => sum + getRecordSystemStock(r), 0);
                                const colTotalDiff = round2(colTotalQty - colTotalSys);
                                return (
                                  <>
                                    <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono text-amber-900 bg-amber-50 whitespace-nowrap text-[11px]">{fmtQty(colTotalSys)}</td>
                                    <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                      {colTotalDiff === 0 ? (
                                        <span className="text-emerald-700">0</span>
                                      ) : colTotalDiff > 0 ? (
                                        <span className="text-blue-700">+{fmtQty(colTotalDiff)}</span>
                                      ) : (
                                        <span className="text-rose-700">{fmtQty(colTotalDiff)}</span>
                                      )}
                                    </td>
                                  </>
                                );
                              })()}
                              {showCost && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-mono text-slate-500 whitespace-nowrap text-[11px]">-</td>
                              )}
                              {showSellingPrice && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-mono text-slate-500 whitespace-nowrap text-[11px]">-</td>
                              )}
                              {showCost && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtMoney(colTotalCost)}</td>
                              )}
                              {showSellingPrice && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtMoney(colTotalSelling)}</td>
                              )}
                              {showVarianceMatching && showCost && (() => {
                                const colDiffCost = colRecords.reduce((sum, r) => sum + (r.auditedQty - getRecordSystemStock(r)) * r.initialCost, 0);
                                return (
                                  <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                    {fmtDiffMoney(colDiffCost)}
                                  </td>
                                );
                              })()}
                              {showVarianceMatching && showSellingPrice && (() => {
                                const colDiffSelling = colRecords.reduce((sum, r) => sum + (r.auditedQty - getRecordSystemStock(r)) * r.sellingPrice, 0);
                                return (
                                  <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                    {fmtDiffMoney(colDiffSelling)}
                                  </td>
                                );
                              })()}
                            </tr>
                          </tbody>
                          <TableReportFooter
                            colSpan={6 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0) + (showVarianceMatching ? 2 : 0) + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0) + (showVarianceMatching && showCost ? 1 : 0) + (showVarianceMatching && showSellingPrice ? 1 : 0)}
                            printedBy={selectedSession?.auditorName || currentUser?.username || 'مدير النظام'}
                            totalItemsCount={colRecords.length}
                          />
                        </table>
                        </div>
                      );
                    })}
                </div>
              ) : (
                /* Unified Table View */
                <div className="space-y-2">
                  <div className="border-2 border-slate-700 rounded-xl overflow-x-auto print:overflow-visible shadow-none my-2 bg-white">
                    <table className="w-full text-right text-xs border-collapse border border-slate-700">
                      <thead className="print:table-header-group">
                        {/* Top Report Header inside thead so it repeats on every printed page */}
                        <tr className="border-none bg-white">
                          <td colSpan={15} className="p-0 border-none pb-1 text-right bg-white font-normal">
                            <div className="bg-white space-y-1 my-1">
                              <ReportHeader
                                reportTitle="بيانات التقرير"
                                reportDate={selectedSession.date}
                                onOpenSettings={() => setIsHeaderSettingsModalOpen(true)}
                                hideEditButton={true}
                              />

                              {/* بيانات التقرير - Report Info Block */}
                              <div className="bg-slate-50 border border-slate-300 rounded-lg p-1.5 px-2 text-xs space-y-1 print:bg-white print:border-slate-400 my-1">
                                <div className="grid grid-cols-2 gap-1.5 text-slate-800">
                                  {/* تاريخ */}
                                  <div className="bg-white py-1 px-2 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                    <span className="text-slate-500 font-bold text-[11px] shrink-0 whitespace-nowrap">التاريخ:</span>
                                    <span className="font-mono font-bold text-slate-900 text-xs whitespace-nowrap">{selectedSession.date}</span>
                                  </div>

                                  {/* نوع السند */}
                                  <div className="bg-white py-1 px-2 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                    <span className="text-slate-500 font-bold text-[11px] shrink-0 whitespace-nowrap">نوع السند:</span>
                                    <input
                                      type="text"
                                      value={customVoucherType}
                                      onChange={(e) => setCustomVoucherType(e.target.value)}
                                      className="w-full font-bold text-indigo-900 text-xs bg-transparent border-none p-0 focus:ring-0 text-left print:border-none whitespace-nowrap"
                                      placeholder="نوع السند"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr className="bg-[#c2d7ed] text-slate-900 font-bold border-b-2 border-slate-700 print:bg-[#c2d7ed]">
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">مـ</th>
                          {showColumnNo && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">العمود/الرف</th>
                          )}
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">رقم الصنف</th>
                          <th className="py-1.5 px-1.5 border border-slate-700 text-right font-bold bg-[#c2d7ed] min-w-[140px] text-[11px]">اسم الصنف</th>
                          {showBarcode && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الباركود</th>
                          )}
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الوحدة</th>
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">تاريخ الانتهاء</th>
                          {showCreatedBy && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">المستخدم المدخل</th>
                          )}
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">ك. الجرد</th>
                          {showVarianceMatching && (
                            <>
                              <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">ك. المتوفرة</th>
                              <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">ك. الفارق</th>
                            </>
                          )}
                          {showCost && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">التكلفة</th>
                          )}
                          {showSellingPrice && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">السعر</th>
                          )}
                          {showCost && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">إجمالي التكلفة</th>
                          )}
                          {showSellingPrice && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">اجمالي السعر</th>
                          )}
                          {showVarianceMatching && showCost && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">فارق التكلفة</th>
                          )}
                          {showVarianceMatching && showSellingPrice && (
                            <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">فارق البيع</th>
                          )}
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px] no-print print:hidden">إجراءات</th>
                        </tr>
                      </thead>
                    <tbody className="bg-white print:table-row-group">
                      {selectedSession.records
                        .filter((rec) => filterColumn === 'all' || (rec.columnNo || '1') === filterColumn)
                        .map((rec, i) => {
                          const totalCost = rec.totalCostValue || round2(rec.auditedQty * rec.initialCost);
                          const totalSelling = rec.totalSellingValue || round2(rec.auditedQty * rec.sellingPrice);
                          const sysStock = getRecordSystemStock(rec);
                          const diff = round2(rec.auditedQty - sysStock);
                          const diffCost = round2(diff * rec.initialCost);
                          const diffSelling = round2(diff * rec.sellingPrice);
                          return (
                            <tr
                              key={i}
                              onClick={() => setSelectedRecordDetail({
                                record: rec,
                                sessionTitle: selectedSession.title,
                                sessionDate: selectedSession.date,
                                auditorName: selectedSession.auditorName
                              })}
                              className="hover:bg-sky-50 transition cursor-pointer break-inside-avoid print:break-inside-avoid"
                              title="انقر لعرض تفاصيل هذا السجل بالعمود"
                            >
                              <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-800 whitespace-nowrap text-[11px]">{i + 1}</td>
                              {showColumnNo && (
                                <td className="py-1 px-1.5 border border-slate-700 font-mono font-black text-center text-indigo-900 bg-indigo-50/70 whitespace-nowrap text-[11px]">📌 {rec.columnNo || '1'}</td>
                              )}
                              <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.itemCode}</td>
                              <td className="py-1 px-1.5 border border-slate-700 font-bold text-right text-slate-900 whitespace-nowrap text-[11px]">{rec.itemName}</td>
                              {showBarcode && (
                                <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.barcode || '-'}</td>
                              )}
                              <td className="py-1 px-1.5 border border-slate-700 font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.unit}</td>
                              <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.expiryDate || '-'}</td>
                              {showCreatedBy && (
                                <td className="py-1 px-1.5 border border-slate-700 font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.createdBy || selectedSession.auditorName || 'مسؤول الجرد'}</td>
                              )}
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">{fmtQty(rec.auditedQty)}</td>
                              {showVarianceMatching && (
                                <>
                                  <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-900 bg-amber-50/50 whitespace-nowrap text-[11px]">{fmtQty(sysStock)}</td>
                                  <td className="py-1 px-1.5 border border-slate-700 font-mono font-black text-center whitespace-nowrap text-[11px]">
                                    {diff === 0 ? (
                                      <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">0</span>
                                    ) : diff > 0 ? (
                                      <span className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold">+{fmtQty(diff)}</span>
                                    ) : (
                                      <span className="text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{fmtQty(diff)}</span>
                                    )}
                                  </td>
                                </>
                              )}
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
                              {showVarianceMatching && showCost && (
                                <td className={`py-1 px-1.5 border border-slate-700 text-center font-mono font-bold whitespace-nowrap text-[11px] ${diffCost === 0 ? 'text-slate-700' : diffCost > 0 ? 'text-blue-700 font-black' : 'text-rose-700 font-black'}`}>
                                  {fmtDiffMoney(diffCost)}
                                </td>
                              )}
                              {showVarianceMatching && showSellingPrice && (
                                <td className={`py-1 px-1.5 border border-slate-700 text-center font-mono font-bold whitespace-nowrap text-[11px] ${diffSelling === 0 ? 'text-slate-700' : diffSelling > 0 ? 'text-blue-700 font-black' : 'text-rose-700 font-black'}`}>
                                  {fmtDiffMoney(diffSelling)}
                                </td>
                              )}
                              <td className="py-1 px-1.5 border border-slate-700 text-center whitespace-nowrap no-print print:hidden">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditRecordModal(rec);
                                    }}
                                    className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold text-[10px] flex items-center gap-0.5 transition cursor-pointer"
                                    title="تعديل هذا العنصر"
                                  >
                                    <Pencil className="w-3 h-3 text-amber-800" />
                                    <span>تعديل</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteRecordFromSession(rec.id);
                                    }}
                                    className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-900 rounded font-bold text-[10px] flex items-center gap-0.5 transition cursor-pointer"
                                    title="حذف هذا العنصر"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-800" />
                                    <span>حذف</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                      {/* Unified Session Total Row and Totals Summary */}
                      {(() => {
                        const filteredRecords = selectedSession.records.filter((rec) => filterColumn === 'all' || (rec.columnNo || '1') === filterColumn);
                        const totalQtySum = filteredRecords.reduce((sum, r) => sum + r.auditedQty, 0);
                        const totalCostSum = filteredRecords.reduce((sum, r) => sum + (r.totalCostValue || r.auditedQty * r.initialCost), 0);
                        const totalSellingSum = filteredRecords.reduce((sum, r) => sum + (r.totalSellingValue || r.auditedQty * r.sellingPrice), 0);
                        const totalSysStockSum = filteredRecords.reduce((sum, r) => sum + getRecordSystemStock(r), 0);
                        const totalDiffSum = round2(totalQtySum - totalSysStockSum);
                        const totalDiffCostSum = filteredRecords.reduce((sum, r) => sum + (r.auditedQty - getRecordSystemStock(r)) * r.initialCost, 0);
                        const totalDiffSellingSum = filteredRecords.reduce((sum, r) => sum + (r.auditedQty - getRecordSystemStock(r)) * r.sellingPrice, 0);
                        const colSpanCount = 6 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0) + (showVarianceMatching ? 2 : 0) + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0) + (showVarianceMatching && showCost ? 1 : 0) + (showVarianceMatching && showSellingPrice ? 1 : 0);

                        return (
                          <>
                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-700 text-slate-900 break-inside-avoid print:break-inside-avoid">
                              <td colSpan={5 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0)} className="py-1 px-1.5 border border-slate-700 text-left font-black whitespace-nowrap text-[11px]">الإجمالي العام:</td>
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtQty(totalQtySum)}</td>
                              {showVarianceMatching && (
                                <>
                                  <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono text-amber-900 bg-amber-50 whitespace-nowrap text-[11px]">{fmtQty(totalSysStockSum)}</td>
                                  <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                    {totalDiffSum === 0 ? (
                                      <span className="text-emerald-700">0</span>
                                    ) : totalDiffSum > 0 ? (
                                      <span className="text-blue-700">+{fmtQty(totalDiffSum)}</span>
                                    ) : (
                                      <span className="text-rose-700">{fmtQty(totalDiffSum)}</span>
                                    )}
                                  </td>
                                </>
                              )}
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
                              {showVarianceMatching && showCost && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                  {fmtDiffMoney(totalDiffCostSum)}
                                </td>
                              )}
                              {showVarianceMatching && showSellingPrice && (
                                <td className="py-1 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                  {fmtDiffMoney(totalDiffSellingSum)}
                                </td>
                              )}
                            </tr>
                            {/* Totals Summary Box placed before bottom footer bar */}
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
                                  {showVarianceMatching && (
                                    <>
                                      <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                        <span>إجمالي المخزون المتوفر بالنظام :</span>
                                        <span className="font-mono font-black text-sm text-amber-900">{fmtQty(totalSysStockSum)}</span>
                                      </div>
                                      <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                        <span>إجمالي الفارق الجرد (كمية) :</span>
                                        <span className={`font-mono font-black text-sm ${totalDiffSum === 0 ? 'text-emerald-700' : totalDiffSum > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                          {fmtDiffQty(totalDiffSum)}
                                        </span>
                                      </div>
                                      {showCost && (
                                        <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                          <span>فارق التكلفة :</span>
                                          <span className={`font-mono font-black text-sm ${totalDiffCostSum === 0 ? 'text-emerald-700' : totalDiffCostSum > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                            {fmtDiffMoney(totalDiffCostSum)} ر.س
                                          </span>
                                        </div>
                                      )}
                                      {showSellingPrice && (
                                        <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                          <span>فارق البيع :</span>
                                          <span className={`font-mono font-black text-sm ${totalDiffSellingSum === 0 ? 'text-emerald-700' : totalDiffSellingSum > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                            {fmtDiffMoney(totalDiffSellingSum)} ر.س
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                    <TableReportFooter
                      colSpan={6 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0) + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0) + (showVarianceMatching ? 2 : 0)}
                      printedBy={selectedSession?.auditorName || currentUser?.username || 'مدير النظام'}
                      totalItemsCount={selectedSession?.records?.length || 0}
                    />
                  </table>
                </div>
              </div>
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 text-slate-600 font-bold text-xs hover:bg-slate-200 rounded-xl transition"
              >
                إغلاق
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف تقرير الجرد (${selectedSession.title})؟`)) {
                      onDeleteSession(selectedSession.id);
                      setSelectedSession(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs rounded-xl border border-red-200 transition"
                  title="حذف هذا التقرير نهائياً"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>حذف التقرير</span>
                </button>

                <button
                  onClick={() => exportAuditSessionToExcel(selectedSession)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-emerald-600" />
                  <span>تصدير لإكسل</span>
                </button>

                <button
                  onClick={async () => {
                    setIsGeneratingPdf(true);
                    await exportElementToPDF('printable-audit-report', `تقرير_جرد_${selectedSession.title}`);
                    setIsGeneratingPdf(false);
                  }}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shadow-xs"
                  title="تصدير وتحميل التقرير كملف PDF"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 text-rose-200 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 text-rose-200" />
                  )}
                  <span>{isGeneratingPdf ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                </button>

                <button
                  onClick={() => {
                    setViewMode('grouped');
                    setTimeout(() => window.print(), 150);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة مقسم بحسب العمود</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer"
                  title="فتح نافذة الطباعة أو الحفظ كـ PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة / حفظ PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Print By Column Modal */}
      {isPrintByColumnModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Columns className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">طباعة التقرير بحسب رقم العمود</h3>
                  <p className="text-xs text-slate-500">اختر عموداً محدداً للطباعة من التقرير المحفوظ</p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintByColumnModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
              <label className="block text-xs font-bold text-slate-800">
                اختر العمود المراد طباعته:
              </label>
              <select
                value={selectedColumnToPrint}
                onChange={(e) => setSelectedColumnToPrint(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 font-bold text-slate-900 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">-- طباعة جميع الأعمدة (مقسمة) --</option>
                {sessionColumns.map((col) => {
                  const count = sessionRecordsByColumn.get(col)?.length || 0;
                  return (
                    <option key={col} value={col}>
                      العمود رقم {col} (يحتوي على {count} صنف)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPrintByColumnModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
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
                  setViewMode('grouped');
                  setIsPrintByColumnModalOpen(false);
                  setTimeout(() => window.print(), 200);
                }}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Master Consolidated Audit Report Modal */}
      {isMasterReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible dir-rtl">
          <div id="printable-full-audit-report" className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-6xl w-full overflow-hidden my-4 sm:my-6 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:overflow-visible">
            
            {/* Modal Top Bar - Hidden on print */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">تقرير الجرد المخزني الشامل لكافة المجرودات</h3>
                  <p className="text-xs text-slate-400">
                    يتضمن جميع السجلات المجرودة • عدد الأصناف: {filteredMasterRecords.length} • إجمالي الكميات: {filteredMasterRecords.reduce((s, r) => s + r.record.auditedQty, 0)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMasterReportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto print:p-0 print:space-y-2 print:max-h-none print:overflow-visible">
              
              {/* Toolbar Controls - Hidden on print */}
              <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-2xl border border-slate-800 space-y-3 no-print print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-extrabold text-xs">خيارات الطباعة والفلترة للتقرير الشامل:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Checkboxes */}
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <input
                        type="checkbox"
                        checked={showBarcode}
                        onChange={(e) => setShowBarcode(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span className={showBarcode ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        الباركود
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <input
                        type="checkbox"
                        checked={showCreatedBy}
                        onChange={(e) => setShowCreatedBy(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span className={showCreatedBy ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        المدخل / الجلسة
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <input
                        type="checkbox"
                        checked={showColumnNo}
                        onChange={(e) => setShowColumnNo(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span className={showColumnNo ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        العمود/الرف
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <input
                        type="checkbox"
                        checked={showCost}
                        onChange={(e) => setShowCost(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span className={showCost ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        التكلفة
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <input
                        type="checkbox"
                        checked={showSellingPrice}
                        onChange={(e) => setShowSellingPrice(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span className={showSellingPrice ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                        سعر البيع
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold bg-amber-950/50 px-2.5 py-1 rounded-xl border border-amber-600/60">
                      <input
                        type="checkbox"
                        checked={showVarianceMatching}
                        onChange={(e) => setShowVarianceMatching(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-amber-500 cursor-pointer"
                      />
                      <span className={showVarianceMatching ? 'text-amber-300 font-black' : 'text-slate-300'}>
                        مطابقة العجز والفائض
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-800/80">
                  {/* Search Input */}
                  <div className="relative w-full sm:flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={masterSearchQuery}
                      onChange={(e) => setMasterSearchQuery(e.target.value)}
                      placeholder="تصفية السجلات بالرمز، الاسم، الباركود، أو الجلسة..."
                      className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Column Selector */}
                  {masterColumnsList.length > 0 && (
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 w-full sm:w-auto text-xs font-bold">
                      <Filter className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-400 whitespace-nowrap">العمود:</span>
                      <select
                        value={masterFilterColumn}
                        onChange={(e) => setMasterFilterColumn(e.target.value)}
                        className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                      >
                        <option value="all" className="bg-slate-900 text-white">كافة الأعمدة ({allAuditedRecordsCombined.length})</option>
                        {masterColumnsList.map((col) => (
                          <option key={col} value={col} className="bg-slate-900 text-white">
                            عمود رقم {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Comprehensive Data Table */}
              <div className="border-2 border-slate-700 rounded-xl overflow-x-auto print:overflow-visible shadow-none my-2 bg-white">
                <table className="w-full text-right text-xs border-collapse border border-slate-700">
                  <thead className="print:table-header-group">
                    {/* Top Report Header inside thead so it repeats on every printed page */}
                    <tr className="border-none bg-white">
                      <td colSpan={15} className="p-0 border-none pb-1 text-right bg-white font-normal">
                        <div className="bg-white space-y-1 my-1">
                          <ReportHeader
                            reportTitle="تقرير الجرد المخزني الشامل - كافة المجرودات"
                            reportDate={new Date().toLocaleDateString('ar-SA')}
                            onOpenSettings={() => setIsHeaderSettingsModalOpen(true)}
                            hideEditButton={true}
                          />

                          {/* Info Summary Block */}
                          <div className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs space-y-1 print:bg-white print:border-slate-400 my-1">
                            <div className="grid grid-cols-2 gap-1.5 text-slate-800">
                              <div className="bg-white py-1 px-2.5 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                <span className="text-slate-500 font-bold text-[11px] shrink-0">تاريخ التقرير:</span>
                                <span className="font-mono font-bold text-slate-900 text-xs">{new Date().toLocaleDateString('ar-SA')}</span>
                              </div>
                              <div className="bg-white py-1 px-2.5 rounded-md border border-slate-200 print:border-slate-300 flex items-center justify-between gap-1">
                                <span className="text-slate-500 font-bold text-[11px] shrink-0">نوع السند:</span>
                                <span className="font-bold text-emerald-900 text-xs">سند جرد شامل موحد</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    <tr className="bg-[#c2d7ed] text-slate-900 font-bold border-b-2 border-slate-700 print:bg-[#c2d7ed]">
                      <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">م</th>
                      {showColumnNo && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">العمود/الرف</th>
                      )}
                      <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">رقم الصنف</th>
                      <th className="py-1.5 px-1.5 border border-slate-700 text-right font-bold bg-[#c2d7ed] min-w-[140px] text-[11px]">اسم الصنف</th>
                      {showBarcode && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الباركود</th>
                      )}
                      <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">الوحدة</th>
                      <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">تاريخ الانتهاء</th>
                      {showCreatedBy && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">جلسة الجرد / المدخل</th>
                      )}
                      <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">ك. الجرد</th>
                      {showVarianceMatching && (
                        <>
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">ك. المتوفرة</th>
                          <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">ك. الفارق</th>
                        </>
                      )}
                      {showCost && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">التكلفة</th>
                      )}
                      {showSellingPrice && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">السعر</th>
                      )}
                      {showCost && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">إجمالي التكلفة</th>
                      )}
                      {showSellingPrice && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#c2d7ed] whitespace-nowrap text-[11px]">اجمالي السعر</th>
                      )}
                      {showVarianceMatching && showCost && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">فارق التكلفة</th>
                      )}
                      {showVarianceMatching && showSellingPrice && (
                        <th className="py-1.5 px-1.5 border border-slate-700 text-center font-bold bg-[#fef3c7] text-amber-950 whitespace-nowrap text-[11px]">فارق البيع</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white print:table-row-group">
                    {filteredMasterRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0) + (showVarianceMatching ? 2 : 0) + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0) + (showVarianceMatching && showCost ? 1 : 0) + (showVarianceMatching && showSellingPrice ? 1 : 0)} className="py-8 text-center text-slate-500 font-bold">
                          لا توجد أصناف مطابقة لخيارات الفلترة والبحث الحالية
                        </td>
                      </tr>
                    ) : (
                      filteredMasterRecords.map((item, idx) => {
                        const rec = item.record;
                        const totalCost = rec.totalCostValue || round2(rec.auditedQty * rec.initialCost);
                        const totalSelling = rec.totalSellingValue || round2(rec.auditedQty * rec.sellingPrice);
                        const sysStock = getRecordSystemStock(rec);
                        const diff = round2(rec.auditedQty - sysStock);
                        const diffCost = round2(diff * rec.initialCost);
                        const diffSelling = round2(diff * rec.sellingPrice);
                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedRecordDetail({
                              record: rec,
                              sessionTitle: item.sessionTitle,
                              sessionDate: item.sessionDate,
                              auditorName: item.auditorName
                            })}
                            className="hover:bg-emerald-50/60 transition cursor-pointer break-inside-avoid print:break-inside-avoid"
                            title="انقر للاستعراض التفصيلي للسجل"
                          >
                            <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-500 whitespace-nowrap text-[11px]">{idx + 1}</td>
                            {showColumnNo && (
                              <td className="py-1 px-1.5 border border-slate-700 font-mono font-black text-center text-indigo-900 bg-indigo-50/70 whitespace-nowrap text-[11px]">📌 {rec.columnNo || '1'}</td>
                            )}
                            <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.itemCode}</td>
                            <td className="py-1 px-1.5 border border-slate-700 font-bold text-right text-slate-900 whitespace-nowrap text-[11px]">{rec.itemName}</td>
                            {showBarcode && (
                              <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-600 whitespace-nowrap text-[11px]">{rec.barcode || '-'}</td>
                            )}
                            <td className="py-1 px-1.5 border border-slate-700 font-bold text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.unit}</td>
                            <td className="py-1 px-1.5 border border-slate-700 font-mono text-center text-slate-900 whitespace-nowrap text-[11px]">{rec.expiryDate || '-'}</td>
                            {showCreatedBy && (
                              <td className="py-1 px-1.5 border border-slate-700 text-center font-bold text-slate-800 text-[11px]">
                                <span className="block text-emerald-800 font-extrabold">{item.sessionTitle}</span>
                                <span className="text-[10px] text-slate-500 block">{rec.createdBy || item.auditorName}</span>
                              </td>
                            )}
                            <td className="py-1 px-1.5 border border-slate-700 text-center font-mono font-black text-slate-900 whitespace-nowrap text-[11px] bg-emerald-50/40">{fmtQty(rec.auditedQty)}</td>
                            {showVarianceMatching && (
                              <>
                                <td className="py-1 px-1.5 border border-slate-700 font-mono font-bold text-center text-slate-900 bg-amber-50/50 whitespace-nowrap text-[11px]">{fmtQty(sysStock)}</td>
                                <td className="py-1 px-1.5 border border-slate-700 font-mono font-black text-center whitespace-nowrap text-[11px]">
                                  {diff === 0 ? (
                                    <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">0</span>
                                  ) : diff > 0 ? (
                                    <span className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold">+{fmtQty(diff)}</span>
                                  ) : (
                                    <span className="text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{fmtQty(diff)}</span>
                                  )}
                                </td>
                              </>
                            )}
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
                            {showVarianceMatching && showCost && (
                              <td className={`py-1 px-1.5 border border-slate-700 text-center font-mono font-bold whitespace-nowrap text-[11px] ${diffCost === 0 ? 'text-slate-700' : diffCost > 0 ? 'text-blue-700 font-black' : 'text-rose-700 font-black'}`}>
                                {fmtDiffMoney(diffCost)}
                              </td>
                            )}
                            {showVarianceMatching && showSellingPrice && (
                              <td className={`py-1 px-1.5 border border-slate-700 text-center font-mono font-bold whitespace-nowrap text-[11px] ${diffSelling === 0 ? 'text-slate-700' : diffSelling > 0 ? 'text-blue-700 font-black' : 'text-rose-700 font-black'}`}>
                                {fmtDiffMoney(diffSelling)}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}

                    {/* Master Total Row inside tbody */}
                    {(() => {
                      const totalQtySum = filteredMasterRecords.reduce((sum, r) => sum + r.record.auditedQty, 0);
                      const totalCostSum = filteredMasterRecords.reduce((sum, r) => sum + (r.record.totalCostValue || r.record.auditedQty * r.record.initialCost), 0);
                      const totalSellingSum = filteredMasterRecords.reduce((sum, r) => sum + (r.record.totalSellingValue || r.record.auditedQty * r.record.sellingPrice), 0);
                      const totalSysStockSum = filteredMasterRecords.reduce((sum, r) => sum + getRecordSystemStock(r.record), 0);
                      const totalDiffSum = round2(totalQtySum - totalSysStockSum);
                      const totalDiffCostSum = filteredMasterRecords.reduce((sum, r) => sum + (r.record.auditedQty - getRecordSystemStock(r.record)) * r.record.initialCost, 0);
                      const totalDiffSellingSum = filteredMasterRecords.reduce((sum, r) => sum + (r.record.auditedQty - getRecordSystemStock(r.record)) * r.record.sellingPrice, 0);
                      const colSpanCount = 6 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0) + (showVarianceMatching ? 2 : 0) + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0) + (showVarianceMatching && showCost ? 1 : 0) + (showVarianceMatching && showSellingPrice ? 1 : 0);

                      return (
                        <>
                          <tr className="bg-slate-100 font-bold border-t-2 border-slate-700 text-slate-900 break-inside-avoid print:break-inside-avoid">
                            <td colSpan={5 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0)} className="py-1.5 px-2 border border-slate-700 text-left font-black whitespace-nowrap text-[11px]">الإجمالي الشامل العام لكل المجرودات:</td>
                            <td className="py-1.5 px-2 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[12px] bg-emerald-100">{fmtQty(totalQtySum)}</td>
                            {showVarianceMatching && (
                              <>
                                <td className="py-1.5 px-1.5 border border-slate-700 text-center font-black font-mono text-amber-900 bg-amber-50 whitespace-nowrap text-[11px]">{fmtQty(totalSysStockSum)}</td>
                                <td className="py-1.5 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                  {totalDiffSum === 0 ? (
                                    <span className="text-emerald-700">0</span>
                                  ) : totalDiffSum > 0 ? (
                                    <span className="text-blue-700">+{fmtQty(totalDiffSum)}</span>
                                  ) : (
                                    <span className="text-rose-700">{fmtQty(totalDiffSum)}</span>
                                  )}
                                </td>
                              </>
                            )}
                            {showCost && (
                              <td className="py-1.5 px-1.5 border border-slate-700 text-center font-mono text-slate-500 whitespace-nowrap text-[11px]">-</td>
                            )}
                            {showSellingPrice && (
                              <td className="py-1.5 px-1.5 border border-slate-700 text-center font-mono text-slate-500 whitespace-nowrap text-[11px]">-</td>
                            )}
                            {showCost && (
                              <td className="py-1.5 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtMoney(totalCostSum)} ر.س</td>
                            )}
                            {showSellingPrice && (
                              <td className="py-1.5 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">{fmtMoney(totalSellingSum)} ر.س</td>
                            )}
                            {showVarianceMatching && showCost && (
                              <td className="py-1.5 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                {fmtDiffMoney(totalDiffCostSum)} ر.س
                              </td>
                            )}
                            {showVarianceMatching && showSellingPrice && (
                              <td className="py-1.5 px-1.5 border border-slate-700 text-center font-black font-mono whitespace-nowrap text-[11px]">
                                {fmtDiffMoney(totalDiffSellingSum)} ر.س
                              </td>
                            )}
                          </tr>
                          {/* Totals Summary Box placed before bottom footer bar */}
                          <tr className="break-inside-avoid print:break-inside-avoid">
                            <td colSpan={colSpanCount} className="p-0 border-0 pt-2">
                              <div className="w-full border border-black bg-slate-50 p-2.5 text-xs space-y-1.5 my-1 text-black font-bold">
                                <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                  <span>عدد الاصناف :</span>
                                  <span className="font-mono font-black text-sm">{filteredMasterRecords.length}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                  <span>إجمالي الكمية المجرودة :</span>
                                  <span className="font-mono font-black text-sm text-indigo-900">{fmtQty(totalQtySum)}</span>
                                </div>
                                {showCost && (
                                  <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                    <span>إجمالي التكلفة حسب المخزن :</span>
                                    <span className="font-mono font-black text-sm">{fmtMoney(totalCostSum)} ر.س</span>
                                  </div>
                                )}
                                {showSellingPrice && (
                                  <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                    <span>إجمالي قيمة البيع :</span>
                                    <span className="font-mono font-black text-sm">{fmtMoney(totalSellingSum)} ر.س</span>
                                  </div>
                                )}
                                {showVarianceMatching && (
                                  <>
                                    <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                      <span>إجمالي المخزون المتوفر بالنظام :</span>
                                      <span className="font-mono font-black text-sm text-amber-900">{fmtQty(totalSysStockSum)}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                      <span>إجمالي الفارق الجرد (كمية) :</span>
                                      <span className={`font-mono font-black text-sm ${totalDiffSum === 0 ? 'text-emerald-700' : totalDiffSum > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                        {fmtDiffQty(totalDiffSum)}
                                      </span>
                                    </div>
                                    {showCost && (
                                      <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                        <span>فارق التكلفة :</span>
                                        <span className={`font-mono font-black text-sm ${totalDiffCostSum === 0 ? 'text-emerald-700' : totalDiffCostSum > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                          {fmtDiffMoney(totalDiffCostSum)} ر.س
                                        </span>
                                      </div>
                                    )}
                                    {showSellingPrice && (
                                      <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                                        <span>فارق البيع :</span>
                                        <span className={`font-mono font-black text-sm ${totalDiffSellingSum === 0 ? 'text-emerald-700' : totalDiffSellingSum > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                          {fmtDiffMoney(totalDiffSellingSum)} ر.س
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                  <TableReportFooter
                    colSpan={6 + (showColumnNo ? 1 : 0) + (showBarcode ? 1 : 0) + (showCreatedBy ? 1 : 0) + (showCost ? 2 : 0) + (showSellingPrice ? 2 : 0) + (showVarianceMatching ? 2 : 0)}
                    printedBy={currentUser?.username || 'مدير النظام'}
                    totalItemsCount={filteredMasterRecords.length}
                  />
                </table>
              </div>

            </div>

            {/* Modal Bottom Actions Footer - Hidden on print */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <button
                onClick={() => setIsMasterReportModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-bold text-xs hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportAllSessionsToExcel(sessions)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-emerald-600" />
                  <span>تصدير إكسل الشامل</span>
                </button>

                <button
                  onClick={async () => {
                    setIsGeneratingPdf(true);
                    await exportElementToPDF('printable-full-audit-report', `تقرير_الجرد_الشامل_لكافة_المجرودات_${new Date().toISOString().slice(0, 10)}`);
                    setIsGeneratingPdf(false);
                  }}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 text-rose-200 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 text-rose-200" />
                  )}
                  <span>{isGeneratingPdf ? 'جاري تصدير PDF...' : 'تصدير PDF كامل'}</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-white" />
                  <span>طباعة تقرير الجرد الكامل الآن</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Report Header & Logo Customization Settings Modal */}
      <ReportHeaderSettingsModal
        isOpen={isHeaderSettingsModalOpen}
        onClose={() => setIsHeaderSettingsModalOpen(false)}
        onSave={() => {}}
      />

      {/* Audit Record Detail Popup Modal */}
      {selectedRecordDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 dir-rtl">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                  <Columns className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                    <span>تفاصيل سجل الجرد الميداني</span>
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">
                      عمود {selectedRecordDetail.record.columnNo || 'غير محدد'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedRecordDetail.sessionTitle} • {selectedRecordDetail.sessionDate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecordDetail(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3.5 text-xs text-slate-800 overflow-y-auto max-h-[80vh]">
              {/* Item Card Banner */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-md">
                    كود الصنف: {selectedRecordDetail.record.itemCode}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    الباركود: {selectedRecordDetail.record.barcode || '-'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-slate-900 pt-0.5">
                  {selectedRecordDetail.record.itemName}
                </h4>
                {selectedRecordDetail.record.foreignName && (
                  <p className="text-[11px] text-slate-500 font-mono text-left dir-ltr">
                    {selectedRecordDetail.record.foreignName}
                  </p>
                )}
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-indigo-50/80 border border-indigo-200 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-indigo-700 block">رقم العمود / الرف المجرود</span>
                  <div className="text-base font-mono font-black text-indigo-950 flex items-center gap-1">
                    <Grid className="w-4 h-4 text-indigo-600" />
                    عمود {selectedRecordDetail.record.columnNo || 'غير محدد'}
                  </div>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-emerald-700 block">الكمية المجرودة</span>
                  <div className="text-base font-mono font-black text-emerald-950">
                    {fmtQty(selectedRecordDetail.record.auditedQty)} {selectedRecordDetail.record.unit}
                  </div>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-amber-800 block">تاريخ الانتهاء للصلاحية</span>
                  <div className="text-xs font-mono font-black text-amber-950">
                    {selectedRecordDetail.record.expiryDate || 'غير محدد'}
                  </div>
                </div>

                <div className="bg-sky-50/80 border border-sky-200 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-sky-800 block">المستخدم المدخل للسجل</span>
                  <div className="text-xs font-bold text-sky-950 truncate">
                    {selectedRecordDetail.record.createdBy || selectedRecordDetail.auditorName || 'مسؤول الجرد'}
                  </div>
                </div>
              </div>

              {/* Pricing & Value Details */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                <h5 className="font-black text-[11px] text-slate-600 uppercase tracking-wider">
                  القيم المالية والتكلفة
                </h5>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>التكلفة الأولية: <strong className="font-mono text-slate-900">{fmtMoney(selectedRecordDetail.record.initialCost)} ر.س</strong></div>
                  <div>سعر البيع: <strong className="font-mono text-slate-900">{fmtMoney(selectedRecordDetail.record.sellingPrice)} ر.س</strong></div>
                  <div>إجمالي التكلفة: <strong className="font-mono text-emerald-700">{fmtMoney(selectedRecordDetail.record.totalCostValue || (selectedRecordDetail.record.auditedQty * selectedRecordDetail.record.initialCost))} ر.س</strong></div>
                  <div>إجمالي البيع: <strong className="font-mono text-emerald-700">{fmtMoney(selectedRecordDetail.record.totalSellingValue || (selectedRecordDetail.record.auditedQty * selectedRecordDetail.record.sellingPrice))} ر.س</strong></div>
                </div>
              </div>

              {/* Notes */}
              {selectedRecordDetail.record.notes && (
                <div className="bg-amber-50/60 border border-amber-200/80 p-2.5 rounded-xl text-xs space-y-0.5">
                  <span className="font-bold text-amber-900 text-[11px]">الملاحظات الميدانية:</span>
                  <p className="text-slate-800 italic">{selectedRecordDetail.record.notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedRecordDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Header Modal */}
      {isEditingSessionHeader && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">تعديل معلومات الجلسة المحفوظة</h3>
              </div>
              <button
                onClick={() => setIsEditingSessionHeader(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم / عنوان الجلسة</label>
                <input
                  type="text"
                  value={editSessionTitle}
                  onChange={(e) => setEditSessionTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="مثال: جرد الرف الأول"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم القائم بالجرد</label>
                <input
                  type="text"
                  value={editAuditorName}
                  onChange={(e) => setEditAuditorName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="اسم الموظف / مسؤول الجرد"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الجرد</label>
                <input
                  type="text"
                  value={editSessionDate}
                  onChange={(e) => setEditSessionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="YYYY-MM-DD"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الجلسة</label>
                <textarea
                  value={editSessionNotes}
                  onChange={(e) => setEditSessionNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="ملاحظات إضافية حول عملية الجرد..."
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsEditingSessionHeader(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSessionHeader}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-amber-500 text-slate-950 p-4 flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-slate-950" />
                <div>
                  <h3 className="font-extrabold text-base">تعديل عنصر مجرود</h3>
                  <p className="text-xs text-slate-900 font-medium">{editingRecord.itemName} ({editingRecord.itemCode})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-900 hover:bg-amber-600/50 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المجرودة</label>
                  <input
                    type="number"
                    value={editRecordQty}
                    onChange={(e) => setEditRecordQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-black font-mono text-emerald-900 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم العمود / الرف</label>
                  <input
                    type="text"
                    value={editRecordColumnNo}
                    onChange={(e) => setEditRecordColumnNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="مثال: 1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                  <input
                    type="text"
                    value={editRecordUnit}
                    onChange={(e) => setEditRecordUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الانتهاء</label>
                  <input
                    type="text"
                    value={editRecordExpiryDate}
                    onChange={(e) => setEditRecordExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="YYYY-MM"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر التكلفة (ر.س)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editRecordInitialCost}
                    onChange={(e) => setEditRecordInitialCost(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع (ر.س)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editRecordSellingPrice}
                    onChange={(e) => setEditRecordSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات على الصنف</label>
                <input
                  type="text"
                  value={editRecordNotes}
                  onChange={(e) => setEditRecordNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="ملاحظات ميدانية..."
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEditedRecord}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item to Saved Session Modal */}
      {isAddingRecordModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-600 text-white p-4 flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-white" />
                <h3 className="font-extrabold text-base">إضافة صنف إلى الجرد المحفوظ</h3>
              </div>
              <button
                onClick={() => {
                  setIsAddingRecordModalOpen(false);
                  setSelectedItemForAdd(null);
                  setAddRecordSearchTerm('');
                }}
                className="text-white hover:bg-emerald-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!selectedItemForAdd ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ابحث عن صنف من الكتالوج (بالاسم / الكود / الباركود)</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={addRecordSearchTerm}
                      onChange={(e) => setAddRecordSearchTerm(e.target.value)}
                      className="w-full pr-9 pl-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="اكتب اسم الصنف أو كوده للبحث..."
                      autoFocus
                    />
                  </div>

                  {/* Search Results Dropdown */}
                  {filteredCatalogForAdd.length > 0 && (
                    <div className="mt-2 border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50">
                      {filteredCatalogForAdd.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItemForAdd(item);
                            setAddRecordUnit(item.unit || 'حبة');
                            setAddRecordExpiryDate(item.expiryDate || '');
                          }}
                          className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition"
                        >
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">كود: {item.code} {item.barcode ? `• باركود: ${item.barcode}` : ''}</span>
                          </div>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">اختر</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {addRecordSearchTerm.trim() !== '' && filteredCatalogForAdd.length === 0 && (
                    <p className="text-xs font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2">
                      لم يتم العثور على صنف مطابق بالكتالوج. يمكنك تغيير الكود أو الاسم والبحث مجدداً.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-emerald-700 font-bold block">الصنف المحدد:</span>
                      <h4 className="font-extrabold text-sm text-slate-900">{selectedItemForAdd.name}</h4>
                      <p className="text-xs font-mono text-slate-600">الكود: {selectedItemForAdd.code}</p>
                    </div>
                    <button
                      onClick={() => setSelectedItemForAdd(null)}
                      className="text-xs text-red-600 hover:bg-red-50 p-1.5 rounded-lg font-bold border border-red-200 cursor-pointer"
                    >
                      تغيير
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المجرودة</label>
                      <input
                        type="number"
                        min="1"
                        value={addRecordQty}
                        onChange={(e) => setAddRecordQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-black font-mono text-emerald-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رقم العمود / الرف</label>
                      <input
                        type="text"
                        value={addRecordColumnNo}
                        onChange={(e) => setAddRecordColumnNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                      <input
                        type="text"
                        value={addRecordUnit}
                        onChange={(e) => setAddRecordUnit(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الانتهاء</label>
                      <input
                        type="text"
                        value={addRecordExpiryDate}
                        onChange={(e) => setAddRecordExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="YYYY-MM"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAddingRecordModalOpen(false);
                  setSelectedItemForAdd(null);
                  setAddRecordSearchTerm('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
              {selectedItemForAdd && (
                <button
                  onClick={handleSaveNewRecordToSession}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة للجلسة</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

function totalCostCost(num: number) {
  return num.toFixed(2);
}
