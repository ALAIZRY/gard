import React, { useState, useEffect } from 'react';
import { Item } from '../types';
import { DollarSign, Percent, Save, X, AlertCircle } from 'lucide-react';

interface PriceUpdateModalProps {
  item?: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSingle: (updatedItem: Item) => void;
  onBatchUpdate?: (percentageChange: number, priceType: 'initialCost' | 'price' | 'sellingPrice') => void;
}

export const PriceUpdateModal: React.FC<PriceUpdateModalProps> = ({
  item,
  isOpen,
  onClose,
  onSaveSingle,
  onBatchUpdate
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>(item ? 'single' : 'batch');
  
  // Single mode state
  const [initialCost, setInitialCost] = useState<number>(item ? item.initialCost : 0);
  const [price, setPrice] = useState<number>(item ? item.price : 0);
  const [sellingPrice, setSellingPrice] = useState<number>(item ? item.sellingPrice : 0);

  // Batch mode state
  const [percent, setPercent] = useState<number>(5);
  const [priceType, setPriceType] = useState<'initialCost' | 'price' | 'sellingPrice'>('sellingPrice');

  useEffect(() => {
    if (isOpen) {
      setMode(item ? 'single' : 'batch');
      if (item) {
        setInitialCost(item.initialCost || 0);
        setPrice(item.price || 0);
        setSellingPrice(item.sellingPrice || 0);
      }
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSingleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    onSaveSingle({
      ...item,
      initialCost: Number(initialCost),
      price: Number(price),
      sellingPrice: Number(sellingPrice),
      lastUpdated: new Date().toISOString()
    });
    onClose();
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onBatchUpdate) {
      onBatchUpdate(percent, priceType);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">تحديث الأسعار والتكلفة</h3>
              <p className="text-xs text-slate-400">
                {item ? `الصنف: ${item.name} (${item.code})` : 'تعديل أسعار المجموعة بالكامل'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-2 bg-slate-100 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setMode('single')}
            disabled={!item}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
              mode === 'single'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 disabled:opacity-40'
            }`}
          >
            تعديل صنف محدد
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
              mode === 'batch'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            تعديل بنسبة مئوية (للكل)
          </button>
        </div>

        {/* Body Form */}
        {mode === 'single' && item ? (
          <form onSubmit={handleSingleSave} className="p-6 space-y-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p><span className="font-bold">رقم الباركود:</span> {item.barcode || 'لا يوجد'}</p>
              <p><span className="font-bold">الوحدة والعبوة:</span> {item.unit} ({item.pack})</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التكلفة الأولية (ريال)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={initialCost}
                onChange={(e) => setInitialCost(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                السعر الأساسي / التكلفة المحسوبة (ريال)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سعر البيع للجمهور (ريال)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-600"
                required
              />
            </div>

            {/* Profit margin calculation */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900">
              <span>هامش الربح المتوقع:</span>
              <span>
                {initialCost > 0
                  ? (((sellingPrice - initialCost) / initialCost) * 100).toFixed(1) + '%'
                  : '0%'}
                {' '}
                ({(sellingPrice - initialCost).toFixed(2)} ريال/وحدة)
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 font-bold text-sm rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBatchSubmit} className="p-6 space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                سيتم إجـراء تعديل جماعي للأسعار على كافة الأصناف المسجلة بنسبة مئوية محددة.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نوع السعر المراد تعديله
              </label>
              <select
                value={priceType}
                onChange={(e: any) => setPriceType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
              >
                <option value="sellingPrice">سعر البيع (Selling Price)</option>
                <option value="initialCost">التكلفة الأولية (Initial Cost)</option>
                <option value="price">السعر الأساسي (Price)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نسبة التغيير المئوية (%) (موجبة للزيادة + أو سالبة للخصم -)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={percent}
                  onChange={(e) => setPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
                  required
                />
                <Percent className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 font-bold text-sm rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition"
              >
                <Save className="w-4 h-4" />
                <span>تطبيق التعديل الجماعي</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
