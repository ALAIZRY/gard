import React, { useState, useEffect, useMemo } from 'react';
import { X, History, DollarSign, Search, User, Calendar, Tag, ArrowUpRight, ArrowDownRight, RefreshCw, Trash2, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { PriceChangeRecord, Item } from '../types';
import { loadPriceHistoryAsync, clearPriceHistory } from '../utils/priceHistory';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem?: Item | null;
  currentUser?: { username: string; role: string; permissions?: string[] } | null;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
  selectedItem,
  currentUser
}) => {
  const [historyRecords, setHistoryRecords] = useState<PriceChangeRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'item'

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      if (selectedItem) {
        setFilterType('item');
      } else {
        setFilterType('all');
      }
    }
  }, [isOpen, selectedItem]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const logs = await loadPriceHistoryAsync();
      setHistoryRecords(logs);
    } catch (err) {
      console.error('Error fetching price history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllHistory = async () => {
    if (confirm('هل أنت تأكد من إخلاء وحذف سجل تغييرات الأسعار نهائياً؟')) {
      await clearPriceHistory();
      setHistoryRecords([]);
    }
  };

  const filteredRecords = useMemo(() => {
    let list = historyRecords;

    if (filterType === 'item' && selectedItem) {
      list = list.filter((r) => r.itemId === selectedItem.id || r.itemCode === selectedItem.code);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.itemName.toLowerCase().includes(q) ||
          r.itemCode.toLowerCase().includes(q) ||
          r.changedBy.toLowerCase().includes(q) ||
          (r.reason && r.reason.toLowerCase().includes(q))
      );
    }

    return list;
  }, [historyRecords, filterType, selectedItem, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-right">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <History className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                سجل تاريخ تغيير الأسعار والتكاليف
              </h3>
              <p className="text-xs text-slate-400">
                {selectedItem
                  ? `عرض سجل الأسعار للصنف: ${selectedItem.name} (${selectedItem.code})`
                  : 'تتبع كافة التعديلات والتغييرات السعرية برقم الصنف والمستخدم'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* View Filter tabs */}
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setFilterType('all')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                السجل العام لكافة الأصناف ({historyRecords.length})
              </button>
              {selectedItem && (
                <button
                  onClick={() => setFilterType('item')}
                  className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterType === 'item'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  صنف محدد: {selectedItem.code}
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم، الكود، المستخدم..."
                className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Clear Log Button */}
            {historyRecords.length > 0 && (
              <button
                onClick={handleClearAllHistory}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>مسح السجل</span>
              </button>
            )}

          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
              <p className="text-xs font-semibold">جاري تحميل سجل تغيير الأسعار...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <History className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">لا يوجد أي سجل لتغيير الأسعار حتى الآن</p>
              <p className="text-xs text-slate-500">
                أي تعديل مستقبلي بأسعار البيع أو التكلفة سيتم توثيقه وحفظه هنا تلقائياً مع اسم المستخدم والتاريخ.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRecords.map((rec) => {
                const costDiff = rec.newInitialCost - rec.oldInitialCost;
                const sellingDiff = rec.newSellingPrice - rec.oldSellingPrice;

                const costPerc = rec.oldInitialCost > 0
                  ? ((costDiff / rec.oldInitialCost) * 100).toFixed(1)
                  : '0';
                const sellingPerc = rec.oldSellingPrice > 0
                  ? ((sellingDiff / rec.oldSellingPrice) * 100).toFixed(1)
                  : '0';

                const formattedDate = new Date(rec.timestamp).toLocaleString('ar-SA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                const getChangeTypeLabel = (type: string) => {
                  switch (type) {
                    case 'batch_percentage':
                      return { text: 'تعديل نسب مئوية جماعية', color: 'bg-purple-100 text-purple-800 border-purple-200' };
                    case 'excel_import':
                      return { text: 'استيراد من إكسل', color: 'bg-blue-100 text-blue-800 border-blue-200' };
                    case 'inline_edit':
                      return { text: 'تعديل سريع في الجدول', color: 'bg-amber-100 text-amber-800 border-amber-200' };
                    default:
                      return { text: 'تعديل بطاقة الصنف', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
                  }
                };

                const typeInfo = getChangeTypeLabel(rec.changeType);

                return (
                  <div
                    key={rec.id}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3.5 shadow-2xs space-y-2.5 transition"
                  >
                    {/* Header info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-900 text-amber-400 px-2 py-0.5 rounded-lg border border-slate-800">
                          {rec.itemCode}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900">{rec.itemName}</h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${typeInfo.color}`}>
                          {typeInfo.text}
                        </span>
                        <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formattedDate}</span>
                        </span>
                      </div>
                    </div>

                    {/* Price Comparison Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      
                      {/* Cost comparison */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-500">التكلفة الأولية:</span>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-slate-400 line-through font-mono">
                              {rec.oldInitialCost.toFixed(2)}
                            </span>
                            <span className="text-slate-400">←</span>
                            <span className="text-slate-900 font-mono text-sm">
                              {rec.newInitialCost.toFixed(2)} ر.س
                            </span>
                          </div>
                        </div>

                        {costDiff !== 0 && (
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                              costDiff > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {costDiff > 0 ? (
                              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{costDiff > 0 ? `+${costPerc}%` : `${costPerc}%`}</span>
                          </span>
                        )}
                      </div>

                      {/* Selling Price comparison */}
                      <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200/60 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-emerald-800">سعر البيع الأساسي:</span>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-slate-400 line-through font-mono">
                              {rec.oldSellingPrice.toFixed(2)}
                            </span>
                            <span className="text-emerald-500">←</span>
                            <span className="text-emerald-700 font-mono text-sm">
                              {rec.newSellingPrice.toFixed(2)} ر.س
                            </span>
                          </div>
                        </div>

                        {sellingDiff !== 0 && (
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                              sellingDiff > 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {sellingDiff > 0 ? (
                              <ArrowUpRight className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 text-rose-700" />
                            )}
                            <span>{sellingDiff > 0 ? `+${sellingPerc}%` : `${sellingPerc}%`}</span>
                          </span>
                        )}
                      </div>

                    </div>

                    {/* Footer User Info */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 font-semibold">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-600" />
                        <span>قام بالتغيير: <strong className="text-slate-800">{rec.changedBy}</strong></span>
                      </div>
                      {rec.reason && (
                        <div className="italic text-slate-400 text-[10px]">
                          سبب التعديل: {rec.reason}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-bold">
            عدد السجلات المعروضة: {filteredRecords.length}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
