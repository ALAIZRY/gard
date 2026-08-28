import * as XLSX from 'xlsx';
import { Item, AuditSession } from '../types';
import { formatRawBarcode } from './unitUtils';

const formatExcelDate = (val: any): string => {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj) {
        const y = dateObj.y;
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // fallback
    }
  }
  return String(val).trim();
};

// Map various possible Arabic/English header names to Item keys
export const parseExcelFile = (file: File): Promise<Item[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON (array of objects)
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          resolve([]);
          return;
        }

        const items: Item[] = jsonData.map((row, index) => {
          // Normalize key names: remove non-alphanumeric/spaces or simplify
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach((key) => {
            // Replace backslashes or slashes or extra spaces in keys
            const cleanKey = key.replace(/[\\/]/g, '').trim().toLowerCase();
            normalizedRow[cleanKey] = row[key];
            // Also keep original trimmed lower key
            normalizedRow[key.trim().toLowerCase()] = row[key];
          });

          // Helper to find value by possible header variants
          const getValue = (...keys: string[]): any => {
            for (const k of keys) {
              const target = k.toLowerCase().replace(/[\\/]/g, '');
              const matchedKey = Object.keys(normalizedRow).find(
                (rk) => rk.includes(target) || rk === target || rk === k.toLowerCase()
              );
              if (matchedKey && normalizedRow[matchedKey] !== undefined && normalizedRow[matchedKey] !== '') {
                return normalizedRow[matchedKey];
              }
            }
            return '';
          };

          const rawCode = getValue('رقم الصنف', 'كود الصنف', 'الكود', 'رقم', 'code', 'item code', 'item_code');
          const code = rawCode ? formatRawBarcode(rawCode) : `ITEM-${1000 + index}`;
          
          const name = String(getValue('اسم الصنف', 'الاصناف', 'البيان', 'الاسم', 'اسم_الصنف', 'name', 'item name', 'description') || `صنف ${index + 1}`);
          const foreignName = String(getValue('الاسم الأجنبي', 'الاسم الاجني', 'foreign name', 'foreign') || '');
          const englishName = String(getValue('الاسم الانجليزي', 'الاسم الإنجليزي', 'english name', 'english') || '') || foreignName;
          const scientificName = String(getValue('الاسم العلمي', 'اسم علمي', 'scientific name', 'scientific') || '');
          const specs = String(getValue('المواصفات', 'مواصفات', 'specs', 'specifications') || '');
          const description = String(getValue('الوصف', 'شرح الصنف', 'description', 'details') || '');

          // Handles "الوح\ة" or "الوحدة" or "الوحدات"
          const unitRaw = String(
            getValue('الوح\\ة', 'الوح/ة', 'الوحـة', 'الوحدة', 'الوحدات', 'وحدة', 'unit', 'units') || 'حبة'
          );

          // Parse multiple units if comma or slash or pipe separated
          const parsedUnits = unitRaw
            .split(/[,/،\-+|]/)
            .map((u) => u.trim())
            .filter(Boolean);
          const primaryUnit = parsedUnits[0] || 'حبة';

          const rawBarcode = getValue(
            'رقم الباركود',
            'الباركود',
            'باركود',
            'barcode',
            'ean',
            'upc',
            'gtin',
            'رمز الباركود',
            'كود الباركود',
            'رمز المنتج',
            'الرمز'
          );
          const barcode = formatRawBarcode(rawBarcode);

          const rawBarcode1 = getValue('بار كود 1', 'باركود 1', 'باركود1', 'باركود بديل', 'الباركود البديل', 'barcode1', 'barcode_1', 'alt_barcode');
          const barcode1 = rawBarcode1 ? formatRawBarcode(rawBarcode1) : undefined;

          const rawBarcode2 = getValue('بار كود 2', 'باركود 2', 'باركود2', 'barcode2', 'barcode_2');
          const barcode2 = rawBarcode2 ? formatRawBarcode(rawBarcode2) : undefined;

          const rawBarcode3 = getValue('بار كود 3', 'باركود 3', 'باركود3', 'barcode3', 'barcode_3');
          const barcode3 = rawBarcode3 ? formatRawBarcode(rawBarcode3) : undefined;

          const pack = String(getValue('العبوه', 'العبوة', 'pack', 'packaging') || '1');

          const parseNum = (val: any): number => {
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            if (!val) return 0;
            const cleaned = String(val).replace(/[^0-9.-]+/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
          };

          // Pricing & Stock fields
          const initialCost = parseNum(
            getValue('التكلفة', 'التكلفة الأولية', 'التكلفة الاولية', 'التكلفة الأولي', 'initial cost', 'cost initial', 'cost')
          );
          const price = parseNum(getValue('السعر', 'سعر التكلفة', 'cost', 'price')) || initialCost;
          const sellingPrice = parseNum(getValue('سعر البيع', 'البيع', 'selling price', 'retail price')) || price * 1.2;

          const maxSellingPrice = parseNum(
            getValue('اعلى سعر بيع', 'أعلى سعر بيع', 'اعلى سعر', 'أعلى سعر', 'max selling price', 'max_price')
          );
          const minSellingPrice = parseNum(
            getValue('اقل سعر بيع', 'أقل سعر بيع', 'اقل سعر', 'أقل سعر', 'min selling price', 'min_price')
          );

          const qtyNum = parseNum(getValue('الكمية', 'كمية', 'المخزون', 'الرصيد', 'quantity', 'qty', 'stock'));

          const batchNo = String(getValue('التشغيلة', 'رقم التشغيلة', 'تشغيلة', 'batch', 'batch_no', 'lot') || '');
          const rawExp = getValue('تاريخ الانتهاء', 'تاريخ انقضاء', 'تاريخ الصلاحية', 'تاريخ_الانتهاء', 'expiry', 'exp_date');
          const expiryDate = formatExcelDate(rawExp);

          return {
            id: `item-${Date.now()}-${index}`,
            code,
            name,
            foreignName,
            englishName: englishName || undefined,
            scientificName: scientificName || undefined,
            specs: specs || undefined,
            description: description || undefined,
            unit: primaryUnit,
            units: parsedUnits.length > 0 ? parsedUnits : [primaryUnit],
            barcode,
            barcode1: barcode1 || undefined,
            barcode2: barcode2 || undefined,
            barcode3: barcode3 || undefined,
            pack,
            initialCost: Number(initialCost.toFixed(2)),
            price: Number(price.toFixed(2)),
            sellingPrice: Number(sellingPrice.toFixed(2)),
            currentStock: qtyNum,
            quantity: qtyNum,
            batchNo: batchNo || undefined,
            expiryDate: expiryDate || undefined,
            maxSellingPrice: maxSellingPrice > 0 ? Number(maxSellingPrice.toFixed(2)) : undefined,
            minSellingPrice: minSellingPrice > 0 ? Number(minSellingPrice.toFixed(2)) : undefined,
            lastUpdated: new Date().toISOString()
          };
        });

        resolve(items);
      } catch (err) {
        console.error('Error parsing excel:', err);
        reject(new Error('فشل في قراءة ملف الإكسل. يرجى التأكد من أن الملف صيغته صحيحة (.xlsx, .xls, .csv)'));
      }
    };

    reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة الملف.'));
    reader.readAsArrayBuffer(file);
  });
};

export const exportItemsToExcel = (items: Item[], fileName = 'قائمة_الأصناف.xlsx') => {
  const exportData = items.map((item) => ({
    'رقم الصنف': item.code,
    'اسم الصنف': item.name,
    'الاسم الأجنبي': item.foreignName || '',
    'الوحدة': item.unit,
    'رقم الباركود': item.barcode,
    'التشغيلة': item.batchNo || '',
    'تاريخ الانتهاء': item.expiryDate || '',
    'الكمية': item.currentStock ?? item.quantity ?? 0,
    'اعلى سعر بيع': item.maxSellingPrice || '',
    'اقل سعر بيع': item.minSellingPrice || '',
    'التكلفة': item.initialCost,
    'سعر البيع': item.sellingPrice
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الأصناف');
  XLSX.writeFile(workbook, fileName);
};

export const exportAuditSessionToExcel = (session: AuditSession, fileName?: string) => {
  const name = fileName || `جرد_${session.title}_${session.date}.xlsx`;

  const exportData = session.records.map((rec, index) => ({
    'م': index + 1,
    'رقم الصنف': rec.itemCode,
    'اسم الصنف': rec.itemName,
    'الاسم الأجنبي': rec.foreignName || '-',
    'رقم الباركود': rec.barcode,
    'الوحدة': rec.unit,
    'رقم العمود / الرف': rec.columnNo || '1',
    'تاريخ الانتهاء': rec.expiryDate || 'غير محدد',
    'كمية الجرد': rec.auditedQty,
    'التكلفة الأولية (للوحدة)': rec.initialCost,
    'سعر البيع (للوحدة)': rec.sellingPrice,
    'إجمالي التكلفة': rec.totalCostValue,
    'إجمالي سعر البيع': rec.totalSellingValue,
    'ملاحظات': rec.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'تفاصيل الجرد');
  XLSX.writeFile(workbook, name);
};

export const exportAllSessionsToExcel = (sessions: AuditSession[], fileName?: string) => {
  const name = fileName || `تقرير_الجرد_الشامل_جميع_المجرودات_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const allRecords: any[] = [];
  let index = 1;

  sessions.forEach((session) => {
    session.records.forEach((rec) => {
      allRecords.push({
        'م': index++,
        'جلسة الجرد': session.title,
        'تاريخ الجلسة': session.date,
        'القائم بالجرد': session.auditorName,
        'رقم الصنف': rec.itemCode,
        'اسم الصنف': rec.itemName,
        'الاسم الأجنبي': rec.foreignName || '-',
        'رقم الباركود': rec.barcode,
        'الوحدة': rec.unit,
        'رقم العمود / الرف': rec.columnNo || '1',
        'تاريخ الانتهاء': rec.expiryDate || 'غير محدد',
        'كمية الجرد': rec.auditedQty,
        'التكلفة الأولية (للوحدة)': rec.initialCost,
        'سعر البيع (للوحدة)': rec.sellingPrice,
        'إجمالي التكلفة': rec.totalCostValue,
        'إجمالي سعر البيع': rec.totalSellingValue,
        'المستخدم المدخل': rec.createdBy || session.auditorName,
        'ملاحظات': rec.notes || ''
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(allRecords);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'جميع المجرودات');
  XLSX.writeFile(workbook, name);
};

export const downloadSampleTemplate = (formatType: 'standard' | 'batch_db' = 'batch_db') => {
  if (formatType === 'batch_db') {
    const sampleRows = [
      {
        'رقم الصنف': '1001',
        'اسم الصنف': 'بنادول إكسترا 24 قرص',
        'الوح\\ة': 'علبة',
        'سعر البيع': 15.50,
        'التكلفة': 11.00,
        'اقل سعر بيع': 14.00,
        'اعلى سعر بيع': 16.50,
        'الكمية': 150,
        'تاريخ الانتهاء': '2027-12-31',
        'التشغيلة': 'BN-99201'
      },
      {
        'رقم الصنف': '1002',
        'اسم الصنف': 'فيتامين سي 1000 ملجم',
        'الوح\\ة': 'حبة',
        'سعر البيع': 28.00,
        'التكلفة': 20.00,
        'اقل سعر بيع': 25.00,
        'اعلى سعر بيع': 30.00,
        'الكمية': 80,
        'تاريخ الانتهاء': '2026-10-15',
        'التشغيلة': 'LOT-44109'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قاعدة_بيانات_الأصناف');
    XLSX.writeFile(workbook, 'نموذج_قاعدة_البيانات_التشغيلة_والانتهاء.xlsx');
  } else {
    const sampleRows = [
      {
        'رقم الصنف': '1011',
        'اسم الصنف': 'عصير برتقال فلوريدا 1 ليتر',
        'الاسم الأجنبي': 'Florida Orange Juice 1L',
        'الوحدة': 'حبة',
        'رقم الباركود': '6281099887766',
        'العبوه': '1',
        'التكلفة الأولية': 7.50,
        'السعر': 8.50,
        'سعر البيع': 10.00
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج الأصناف');
    XLSX.writeFile(workbook, 'نموذج_إستيراد_الأصناف.xlsx');
  }
};
