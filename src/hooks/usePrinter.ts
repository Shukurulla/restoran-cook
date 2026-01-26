import { useState, useEffect, useCallback } from "react";
import {
  getPrinters,
  printContent,
  isServerRunning,
  getDefaultPrinter,
  Printer,
} from "@/services/printer-api";

interface UsePrinterReturn {
  printers: Printer[];
  defaultPrinter: Printer | null;
  selectedPrinter: Printer | null;
  isLoading: boolean;
  isServerAvailable: boolean;
  error: string | null;
  selectPrinter: (printer: Printer) => void;
  print: (content: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function usePrinter(): UsePrinterReturn {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<Printer | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isServerAvailable, setIsServerAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const serverRunning = await isServerRunning();
      setIsServerAvailable(serverRunning);

      if (!serverRunning) {
        setError("Printer server ishlamayapti");
        setIsLoading(false);
        return;
      }

      const printerList = await getPrinters();
      setPrinters(printerList);

      const defaultP = await getDefaultPrinter();
      setDefaultPrinter(defaultP);

      if (!selectedPrinter && defaultP) {
        setSelectedPrinter(defaultP);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setIsLoading(false);
    }
  }, [selectedPrinter]);

  useEffect(() => {
    refresh();
  }, []);

  const selectPrinter = useCallback((printer: Printer) => {
    setSelectedPrinter(printer);
  }, []);

  const print = useCallback(
    async (content: string): Promise<boolean> => {
      if (!selectedPrinter && !defaultPrinter) {
        setError("Printer tanlanmagan");
        return false;
      }

      const printerName = selectedPrinter?.name || defaultPrinter?.name || null;

      try {
        const result = await printContent(printerName, content);
        if (!result.success) {
          setError(result.error || "Print qilishda xato");
          return false;
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Print qilishda xato");
        return false;
      }
    },
    [selectedPrinter, defaultPrinter]
  );

  return {
    printers,
    defaultPrinter,
    selectedPrinter,
    isLoading,
    isServerAvailable,
    error,
    selectPrinter,
    print,
    refresh,
  };
}
