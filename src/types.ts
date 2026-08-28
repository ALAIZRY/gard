export interface ItemUnitDetail {
  unit: string;           // اسم الوحدة (مثل: حبة، كرتون، علبة)
  sellingPrice: number;   // سعر البيع المخصص لهذه الوحدة
  initialCost: number;    // التكلفة المخصصة لهذه الوحدة
  barcode?: string;       // الباركود المخصص لهذه الوحدة
  barcode1?: string;      // باركود بديل 1 للوحدة
  barcode2?: string;      // باركود بديل 2 للوحدة
  barcodes?: string[] | string; // باركودات إضافية للوحدة
  pack?: string;          // سعة العبوة لهذه الوحدة
}

export interface Item {
  id: string;
  code: string;           // رقم الصنف (فريد وواحد فقط لكل صنف)
  name: string;           // اسم الصنف العربي الرئيسي
  foreignName: string;    // الاسم الأجنبي الرئيسي
  englishName?: string;   // الاسم الإنجليزي
  foreignNames?: string[] | string; // أسماء أجنبية إضافية للصنف
  scientificName?: string;// الاسم العلمي للصنف
  specs?: string;         // المواصفات
  description?: string;   // الوصف
  unit: string;           // الوحدة الأساسية
  units?: string[];       // الوحدات المربوطة بالصنف (أسماء)
  unitDetails?: ItemUnitDetail[]; // تفاصيل كل وحدة (اسم الوحدة + سعر البيع + التكلفة + باركود)
  barcode: string;        // الباركود الرئيسي
  barcode1?: string;      // الباركود البديل الأول
  barcode2?: string;      // الباركود البديل الثاني
  barcode3?: string;      // الباركود البديل الثالث
  barcodes?: string[] | string; // أرقام الباركود الإضافية للصنف
  pack: string;           // العبوه
  initialCost: number;    // التكلفة الأولية الأساسية
  price: number;          // السعر
  sellingPrice: number;   // سعر البيع الأساسي
  currentStock?: number;  // كمية المخزون الدفترية / الكمية
  quantity?: number;      // الكمية
  batchNo?: string;       // التشغيلة / رقم التشغيلة
  expiryDate?: string;    // تاريخ الانتهاء
  maxSellingPrice?: number; // أعلى سعر بيع
  minSellingPrice?: number; // أقل سعر بيع
  category?: string;      // التصنيف
  lastUpdated?: string;   // تاريخ آخر تحديث
}

export interface AuditRecord {
  id: string;
  auditSessionId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  foreignName?: string;
  barcode: string;
  unit: string;           // الوحدة المختارة
  pack?: string;
  columnNo?: string;      // رقم العمود / الرف
  expiryDate: string;     // تاريخ الانتهاء
  auditedQty: number;     // كمية الجرد
  initialCost: number;    // التكلفة الأولية
  sellingPrice: number;   // سعر البيع
  totalCostValue: number; // إجمالي قيمة التكلفة = auditedQty * initialCost
  totalSellingValue: number; // إجمالي قيمة البيع = auditedQty * sellingPrice
  notes?: string;
  timestamp: string;
  createdBy?: string;      // اسم المستخدم الذي أدخل السجل
}

export interface AuditSession {
  id: string;
  title: string;
  date: string;
  status: 'active' | 'completed';
  auditorName: string;
  records: AuditRecord[];
  notes?: string;
}

export interface ColumnMapping {
  code: string;
  name: string;
  foreignName: string;
  unit: string;
  barcode: string;
  pack: string;
  initialCost: string;
  price: string;
  sellingPrice: string;
}

export interface PriceChangeRecord {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  oldInitialCost: number;
  newInitialCost: number;
  oldSellingPrice: number;
  newSellingPrice: number;
  changedBy: string;
  changeType: 'manual_edit' | 'batch_percentage' | 'excel_import' | 'inline_edit';
  reason?: string;
  timestamp: string;
}
