// Printer API - Local server bilan ishlash uchun
const PRINTER_API_URL = "http://localhost:3456";

export interface Printer {
  name: string;
  displayName: string;
  status: string;
  isDefault: boolean;
}

export interface PrinterResponse {
  success: boolean;
  printers?: Printer[];
  error?: string;
}

export interface PrintResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface StatusResponse {
  success: boolean;
  status: string;
  platform: string;
  hostname: string;
}

// Printerlar ro'yxatini olish
export async function getPrinters(): Promise<Printer[]> {
  try {
    const response = await fetch(`${PRINTER_API_URL}/api/printers`);
    const data: PrinterResponse = await response.json();

    if (data.success && data.printers) {
      return data.printers;
    }

    console.error("Printerlarni olishda xato:", data.error);
    return [];
  } catch (error) {
    console.error("Printer API ga ulanishda xato:", error);
    return [];
  }
}

// Print qilish
export async function printContent(
  printerName: string | null,
  content: string,
  options?: Record<string, unknown>
): Promise<PrintResponse> {
  try {
    const response = await fetch(`${PRINTER_API_URL}/api/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        printerName,
        content,
        options,
      }),
    });

    const data: PrintResponse = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Print qilishda xato",
    };
  }
}

// Default printerni olish
export async function getDefaultPrinter(): Promise<Printer | null> {
  const printers = await getPrinters();
  return printers.find((p) => p.isDefault) || printers[0] || null;
}

// Server statusini tekshirish
export async function checkServerStatus(): Promise<StatusResponse | null> {
  try {
    const response = await fetch(`${PRINTER_API_URL}/api/status`);
    const data: StatusResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Server status tekshirishda xato:", error);
    return null;
  }
}

// Server ishlab turganini tekshirish
export async function isServerRunning(): Promise<boolean> {
  const status = await checkServerStatus();
  return status?.success === true;
}
