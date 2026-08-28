if (typeof window !== 'undefined') {
  const originalPrint = window.print;
  window.print = function() {
    if (window.AndroidPrintHandler && typeof window.AndroidPrintHandler.printPage === 'function') {
      window.AndroidPrintHandler.printPage();
    } else {
      originalPrint();
    }
  };
}
