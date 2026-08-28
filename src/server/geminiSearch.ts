import { GoogleGenAI, Type } from '@google/genai';

export interface ImageSearchResult {
  itemName: string;            // الاسم التجاري للصنف/الدواء (مثل ADOL)
  genericName?: string;        // الاسم العلمي / المادة الفعالة (مثل Paracetamol)
  dosageForm?: string;         // الشكل الصيدلاني (مثل SUPP / تحاميل / TAB / SYRUP)
  strength?: string;           // التركيز / الجرعة (مثل 125 MG / 500 MG)
  packSize?: string;           // العبوة / الكمية (مثل 10 / 20 / 100ML)
  formattedPharmacyName?: string; // الصيغة القياسية للتعريف: [اسم الصنف التجاري] [التركيز] [العبوة] [الشكل]
  manufacturer?: string;       // اسم الشركة المصنعة إن وجد
  barcode?: string;            // رقم الباركود إن وجد
  keywords: string[];          // كلمات البحث المفتاحية
  confidence: 'high' | 'medium' | 'low';
  matchedCatalogItem?: string; // اسم الصنف المطابق من قاعدة البيانات إن وجد
  details?: string;            // ملخص وملاحظات توضيحية للصنف
}

const MODELS_TO_TRY = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function recognizeItemFromImage(
  imageBase64: string,
  catalogList?: string[]
): Promise<ImageSearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح GEMINI_API_KEY غير متوفر في البيئة.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Clean base64 string
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: cleanBase64,
    },
  };

  const catalogContext = catalogList && catalogList.length > 0
    ? `\n\nقائمة الأصناف المتاحة في قاعدة بيانات النظام:\n[${catalogList.slice(0, 100).join(' - ')}]\nإذا كانت العبوة تطابق أحد هذه الأصناف، حدد الاسم المطابق تماماً في البند matchedCatalogItem.`
    : '';

  const textPart = {
    text: `قم بتحليل صورة عبوة المنتج أو الدواء بدقة عالية واستخراج مكونات التعريف الرئيسية بالترتيب القياسي المطلوب للتعريف في الصيدليات:
1. اسم الصنف التجاري (Trade Name) مثل: ADOL
2. التركيز (Strength) مثل: 125 MG
3. العبوة (Pack Size) مثل: 10
4. الشكل الصيدلاني (Dosage Form) مثل: SUPP أو TAB أو SYRUP أو CAP

ملاحظة هامة: ليس بالضرورة أن تتضمن جميع الأصناف المكونات الأربعة كاملة (بعض الأصناف تحتوي فقط على الاسم والعبوة أو الاسم والشكل). استخرج المكونات المتوفرة فقط.${catalogContext}

أرجع نتيجة JSON بالبنود التالية:
- itemName: الاسم التجاري البارز فقط (مثال: ADOL أو PANADOL)
- genericName: الاسم العلمي أو المادة الفعالة (مثال: Paracetamol)
- dosageForm: الشكل الصيدلاني واختصاره الصيدلاني (مثل: SUPP / تحاميل، TAB / أقراص، SYRUP / شراب، CAP / كبسولات)
- strength: التركيز إن وجد (مثل: 125 MG أو 500 MG)
- packSize: العبوة أو العدد إن وجد (مثل: 10 أو 20 أو 100 ML)
- formattedPharmacyName: تركيبة الاسم بالنظام بالترتيب: [اسم الصنف التجاري] [التركيز] [العبوة] [الشكل] (مثال: ADOL 125 MG 10 SUPP)
- manufacturer: اسم الشركة المصنعة إن وجد (مثال: Julphar)
- barcode: رقم الباركود إن وجد
- keywords: قائمة تحتوي على الأجزاء الأربعة بشكل منفصل لسهولة البحث
- matchedCatalogItem: الاسم المطابق تماماً من قائمة الأصناف المرفقة أعلاه إن وجد، أو اتركه فارغاً
- confidence: مستوى الثقة ('high' | 'medium' | 'low')
- details: ملخص توضيحي قصير في جملة واحدة
`,
  };

  let lastError: any = null;

  // Try across available models and retry transient errors (503 / 429)
  for (const modelName of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                itemName: { type: Type.STRING, description: "الاسم التجاري للصنف أو الدواء" },
                genericName: { type: Type.STRING, description: "الاسم العلمي أو المادة الفعالة" },
                dosageForm: { type: Type.STRING, description: "الشكل الصيدلاني واختصاره (SUPP, TAB, SYRUP...)" },
                strength: { type: Type.STRING, description: "التركيز أو الجرعة (مثل 125 MG)" },
                packSize: { type: Type.STRING, description: "حجم العبوة أو كميتها (مثل 10)" },
                formattedPharmacyName: { type: Type.STRING, description: "الصيغة المركبة: [اسم الصنف التجاري] [التركيز] [العبوة] [الشكل]" },
                manufacturer: { type: Type.STRING, description: "اسم الشركة المصنعة" },
                barcode: { type: Type.STRING, description: "الباركود المستخرج" },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "كلمات البحث والجرعة والشكل الصيدلاني"
                },
                matchedCatalogItem: { type: Type.STRING, description: "اسم الصنف المطابق من قاعدة البيانات إن وجد" },
                confidence: { type: Type.STRING, description: "مستوى الثقة high or medium or low" },
                details: { type: Type.STRING, description: "وصف موجز للمنتج" }
              },
              required: ["itemName", "keywords", "confidence"]
            }
          }
        });

        let rawText = response.text || '';
        // Clean any codeblock backticks if present
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

        if (rawText) {
          const result: ImageSearchResult = JSON.parse(rawText);
          if (result.itemName || result.matchedCatalogItem) {
            // Build formatted pharmacy name if not returned
            if (!result.formattedPharmacyName) {
              const parts = [
                result.itemName,
                result.strength,
                result.packSize,
                result.dosageForm
              ].filter(Boolean);
              result.formattedPharmacyName = parts.join(' ');
            }
            return result;
          }
        }
      } catch (err: any) {
        lastError = err;
        const errString = JSON.stringify(err) || err?.message || '';
        const isNotFound =
          errString.includes('404') ||
          errString.includes('NOT_FOUND') ||
          errString.includes('no longer available');

        if (isNotFound) {
          // Model no longer available, skip to next model
          break;
        }

        const isTransient =
          errString.includes('503') ||
          errString.includes('UNAVAILABLE') ||
          errString.includes('high demand') ||
          errString.includes('429') ||
          errString.includes('RESOURCE_EXHAUSTED');

        if (isTransient && attempt < 2) {
          // Wait briefly before retry
          await sleep(attempt * 800);
          continue;
        }
        // Move to next model if this model failed with 503/429
        if (isTransient) {
          break;
        }
      }
    }
  }

  const errMessage = lastError?.message || JSON.stringify(lastError) || '';
  if (errMessage.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('Quota exceeded')) {
    throw new Error('تم الوصول للحد الأقصى لطلبات الذكاء الاصطناعي المجانية المؤقتة (Rate Limit). يرجى الانتظار بضع ثوانٍ ثم الضغط على "إعادة محاولة التحليل" أو كتابة اسم الصنف يدوياً.');
  }

  if (errMessage.includes('503') || errMessage.includes('high demand') || errMessage.includes('UNAVAILABLE')) {
    throw new Error('الخدمة تشهد ضغطاً مؤقتاً في السيرفرات. يرجى الضغط على زر "إعادة محاولة التحليل" للمحاولة مجدداً.');
  }

  throw new Error(lastError?.message || 'تعذر تحليل الصورة والتعرف على الصنف. يرجى التأكد من إضاءة الصورة وتأطير الاسم جيداً.');
}
