// @ts-ignore
import html2pdf from 'html2pdf.js';

export interface PDFExportOptions {
  filename?: string;
  margin?: number | [number, number, number, number];
  imageQuality?: number;
  scale?: number;
}

// Canvas context helper for converting modern CSS colors (oklch, oklab, lch, lab) to RGB/rgba
const tempCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (tempCanvas) {
  tempCanvas.width = 1;
  tempCanvas.height = 1;
}
const tempCtx = tempCanvas ? tempCanvas.getContext('2d', { willReadFrequently: true }) : null;

const parseAndConvertColor = (colorStr: string): string => {
  if (!colorStr || typeof colorStr !== 'string') return colorStr;
  if (!/(oklch|oklab|lch|lab)/i.test(colorStr)) return colorStr;

  if (tempCtx) {
    try {
      tempCtx.clearRect(0, 0, 1, 1);
      tempCtx.fillStyle = '#000000';
      tempCtx.fillStyle = colorStr;
      const converted = tempCtx.fillStyle;
      if (converted && converted !== '#000000' && !/(oklch|oklab|lch|lab)/i.test(converted)) {
        return converted;
      }

      tempCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = tempCtx.getImageData(0, 0, 1, 1).data;
      const alpha = (a / 255).toFixed(2);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
      // ignore
    }
  }

  // Fallback for oklch or unsupported colors
  return colorStr.replace(/(oklch|oklab|lch|lab)\([^)]+\)/gi, 'rgb(100, 116, 139)');
};

/**
 * Exports a specific HTML element to a PDF file using html2pdf.js
 * Falls back to window.print() if rendering fails.
 */
export const exportElementToPDF = async (
  elementId: string,
  filename: string = 'التقرير.pdf',
  options?: PDFExportOptions
): Promise<boolean> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with ID "${elementId}" not found for PDF export.`);
    window.print();
    return false;
  }

  // Ensure file extension is .pdf
  const pdfFileName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  const opt = {
    margin: options?.margin ?? ([10, 10, 10, 10] as [number, number, number, number]),
    filename: pdfFileName,
    image: { type: 'jpeg' as const, quality: options?.imageQuality ?? 0.98 },
    html2canvas: {
      scale: options?.scale ?? 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200,
      onclone: (clonedDoc: Document) => {
        try {
          const win = clonedDoc.defaultView || window;

          // 1. Process all elements in cloned document and sanitize computed styles into inline styles
          const colorProps = [
            'color',
            'backgroundColor',
            'borderColor',
            'borderTopColor',
            'borderRightColor',
            'borderBottomColor',
            'borderLeftColor',
            'outlineColor',
            'fill',
            'stroke'
          ] as const;

          // Unconstrain target element
          const targetEl = clonedDoc.getElementById(elementId);
          if (targetEl) {
            targetEl.style.maxHeight = 'none';
            targetEl.style.overflow = 'visible';
            targetEl.style.height = 'auto';
            targetEl.style.width = '100%';
            targetEl.style.position = 'relative';
            targetEl.style.margin = '0';
            targetEl.style.boxShadow = 'none';
            targetEl.style.border = 'none';
            targetEl.style.backgroundColor = '#ffffff';
          }

          // Hide action buttons & print-hidden elements in cloned PDF DOM
          const hiddenEls = clonedDoc.querySelectorAll<HTMLElement>('.print\\:hidden, .no-print, button');
          hiddenEls.forEach((el) => {
            el.style.display = 'none';
          });

          // Unconstrain scrollable containers & fixed modal overlays in cloned DOM
          const scrollables = clonedDoc.querySelectorAll<HTMLElement>('.overflow-y-auto, .overflow-auto, [class*="max-h-"]');
          scrollables.forEach((el) => {
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
            el.style.height = 'auto';
          });

          const fixedContainers = clonedDoc.querySelectorAll<HTMLElement>('.fixed.inset-0');
          fixedContainers.forEach((el) => {
            el.style.position = 'static';
            el.style.padding = '0';
            el.style.backgroundColor = 'transparent';
          });

          const allElements = clonedDoc.querySelectorAll<HTMLElement>('*');
          allElements.forEach((el) => {
            try {
              const computed = win.getComputedStyle(el);
              colorProps.forEach((prop) => {
                const val = computed.getPropertyValue(prop) || (computed as any)[prop];
                if (val && /(oklch|oklab|lch|lab)/i.test(val)) {
                  const converted = parseAndConvertColor(val);
                  const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
                  el.style.setProperty(cssProp, converted, 'important');
                }
              });
            } catch {
              // skip detached or restricted elements
            }
          });

          // 2. Process all <style> tags in cloned document
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach((styleTag) => {
            if (styleTag.textContent && /(oklch|oklab|lch|lab)/i.test(styleTag.textContent)) {
              styleTag.textContent = styleTag.textContent.replace(/(oklch|oklab|lch|lab)\([^)]+\)/gi, (match) => {
                return parseAndConvertColor(match);
              });
            }
          });

          // 3. Wrap win.getComputedStyle to intercept any remaining dynamic property queries
          if (win && win.getComputedStyle) {
            const origGetComputedStyle = win.getComputedStyle.bind(win);
            win.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
              const style = origGetComputedStyle(elt, pseudoElt);
              return new Proxy(style, {
                get(target, prop, receiver) {
                  const raw = Reflect.get(target, prop, receiver);
                  if (typeof raw === 'string' && /(oklch|oklab|lch|lab)/i.test(raw)) {
                    return parseAndConvertColor(raw);
                  }
                  if (typeof raw === 'function') {
                    if (prop === 'getPropertyValue') {
                      return (propertyName: string) => {
                        const val = target.getPropertyValue(propertyName);
                        if (typeof val === 'string' && /(oklch|oklab|lch|lab)/i.test(val)) {
                          return parseAndConvertColor(val);
                        }
                        return val;
                      };
                    }
                    return raw.bind(target);
                  }
                  return raw;
                }
              });
            };
          }
        } catch (err) {
          console.warn('Error during cloned document color conversion in pdfUtils:', err);
        }
      }
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'landscape' as const
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (error) {
    console.error('Error generating PDF with html2pdf, falling back to window.print()', error);
    window.print();
    return false;
  }
};

/**
 * Standard trigger for native print dialog (which also supports Save as PDF in all browsers)
 */
export const triggerPrintDialog = () => {
  window.print();
};

