/**
 * Cook Web - Printer API Service
 * Port: 4000 (cook-electron backend)
 * 
 * Bu service cook-electron PrintService bilan bog'lanadi
 * va TSPL/ESC-POS orqali professional cheklar chiqaradi
 */

const PRINT_SERVER_URL = 'http://localhost:4000';

// ==================== TYPES ====================

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface OrderItem {
  foodName: string;
  quantity: number;
  price?: number;
}

export interface OrderData {
  tableName: string;
  waiterName?: string;
  items: OrderItem[];
  restaurantName?: string;
  createdAt?: string;
}

export interface CancelledData {
  tableName: string;
  foodName: string;
  quantity: number;
  price?: number;
  restaurantName?: string;
}

export interface PrintResult {
  success: boolean;
  error?: string;
  message?: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * O'zbekiston vaqtini olish (UTC+5)
 * Tizim timezone'idan qat'i nazar, har doim O'zbekiston vaqtini qaytaradi
 *
 * MUHIM: Tayyor formatlangan string qaytaramiz!
 * cook-electron bu stringni parse qilmaydi, to'g'ridan-to'g'ri ko'rsatadi.
 * Format: "DD.MM.YYYY HH:mm:ss"
 */
function getUzbekistanTime(): string {
  const now = new Date();
  // O'zbekiston UTC+5
  const uzbekistanOffset = 5 * 60; // minutes
  const localOffset = now.getTimezoneOffset(); // local offset in minutes (negative for east)
  const totalOffsetMs = (uzbekistanOffset + localOffset) * 60 * 1000;
  const uzbekistanDate = new Date(now.getTime() + totalOffsetMs);

  // Tayyor formatlangan string - cook-electron buni to'g'ridan-to'g'ri ko'rsatadi
  // Format: "DD.MM.YYYY HH:mm:ss" (O'zbekiston standarti)
  const day = String(uzbekistanDate.getUTCDate()).padStart(2, '0');
  const month = String(uzbekistanDate.getUTCMonth() + 1).padStart(2, '0');
  const year = uzbekistanDate.getUTCFullYear();
  const hours = String(uzbekistanDate.getUTCHours()).padStart(2, '0');
  const minutes = String(uzbekistanDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(uzbekistanDate.getUTCSeconds()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * LocalStorage dan tanlangan printerni olish
 */
function getSelectedPrinter(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('selectedPrinter');
  }
  return null;
}

/**
 * LocalStorage dan restoran nomini olish
 */
function getRestaurantName(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('restaurantName');
    if (stored) return stored;
  }
  return 'OSHXONA';
}

// ==================== PRINTER API ====================

export const PrinterAPI = {
  /**
   * Mavjud printerlar ro'yxatini olish
   */
  async getPrinters(): Promise<PrinterInfo[]> {
    try {
      const res = await fetch(`${PRINT_SERVER_URL}/printers`);
      const data = await res.json();
      return data.printers || [];
    } catch (error) {
      console.error('Failed to get printers:', error);
      return [];
    }
  },

  /**
   * Test cheki chop etish
   */
  async printTest(printerName?: string, restaurantName?: string): Promise<PrintResult> {
    try {
      const selectedPrinter = printerName || getSelectedPrinter();
      
      if (!selectedPrinter) {
        return { success: false, error: 'Printer tanlanmagan. Sozlamalardan printer tanlang.' };
      }

      const res = await fetch(`${PRINT_SERVER_URL}/print/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: selectedPrinter,
          restaurantName: restaurantName || getRestaurantName()
        })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print test:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  /**
   * Buyurtma cheki chop etish (Oshxona uchun)
   */
  async printOrder(orderData: OrderData, restaurantName?: string, printerName?: string): Promise<PrintResult> {
    try {
      const selectedPrinter = printerName || getSelectedPrinter();
      
      if (!selectedPrinter) {
        return { success: false, error: 'Printer tanlanmagan. Sozlamalardan printer tanlang.' };
      }

      const res = await fetch(`${PRINT_SERVER_URL}/print/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: selectedPrinter,
          restaurantName: restaurantName || orderData.restaurantName || getRestaurantName(),
          tableName: orderData.tableName,
          waiterName: orderData.waiterName || '',
          items: orderData.items.map(item => ({
            foodName: item.foodName,
            quantity: item.quantity
          })),
          createdAt: orderData.createdAt || getUzbekistanTime()
        })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print order:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  /**
   * Bekor qilish cheki chop etish
   */
  async printCancelled(data: CancelledData, printerName?: string): Promise<PrintResult> {
    try {
      const selectedPrinter = printerName || getSelectedPrinter();
      
      if (!selectedPrinter) {
        return { success: false, error: 'Printer tanlanmagan. Sozlamalardan printer tanlang.' };
      }

      const res = await fetch(`${PRINT_SERVER_URL}/print/cancelled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: selectedPrinter,
          restaurantName: data.restaurantName || getRestaurantName(),
          tableName: data.tableName,
          foodName: data.foodName,
          quantity: data.quantity,
          price: data.price || 0
        })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print cancelled:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  /**
   * Raw text chop etish
   */
  async printRaw(text: string, printerName?: string): Promise<PrintResult> {
    try {
      const selectedPrinter = printerName || getSelectedPrinter();
      
      if (!selectedPrinter) {
        return { success: false, error: 'Printer tanlanmagan' };
      }

      const res = await fetch(`${PRINT_SERVER_URL}/print/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: selectedPrinter,
          text: text
        })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print raw:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  /**
   * Printer tanlash va saqlash
   */
  selectPrinter(printerName: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedPrinter', printerName);
    }
  },

  /**
   * Tanlangan printerni olish
   */
  getSelectedPrinter(): string | null {
    return getSelectedPrinter();
  },

  /**
   * Restoran nomini saqlash
   */
  setRestaurantName(name: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('restaurantName', name);
    }
  },

  /**
   * Printer server bilan aloqani tekshirish
   */
  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${PRINT_SERVER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Server status olish
   */
  async getStatus(): Promise<{ connected: boolean; csharpService: string; printers: number }> {
    try {
      const res = await fetch(`${PRINT_SERVER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      const data = await res.json();
      return {
        connected: true,
        csharpService: data.csharpService || 'unknown',
        printers: data.printersCount || 0
      };
    } catch {
      return {
        connected: false,
        csharpService: 'offline',
        printers: 0
      };
    }
  },

  /**
   * Buyurtma chekini to'g'ridan-to'g'ri chop etish (Dashboard auto-print uchun)
   * Har doim localStorage dan tanlangan printerni yuboradi
   *
   * @param tableName - Stol nomi
   * @param waiterName - Ofitsiant ismi
   * @param items - Taomlar ro'yxati
   * @param printerName - Printer nomi (ixtiyoriy)
   * @param idempotencyKey - Dublikat printlarni oldini olish uchun kalit (ixtiyoriy)
   */
  async printOrderDirect(
    tableName: string,
    waiterName: string,
    items: Array<{ foodName?: string; name?: string; quantity?: number }>,
    printerName?: string,
    idempotencyKey?: string
  ): Promise<PrintResult> {
    console.log("=== PrinterAPI.printOrderDirect CALLED ===");
    console.log("Input params:", { tableName, waiterName, itemsCount: items?.length, printerName, idempotencyKey });

    try {
      // Printer name - har doim client localStorage dan olish
      const selectedPrinter = printerName || getSelectedPrinter();
      console.log("Selected printer from client:", selectedPrinter);

      if (!selectedPrinter) {
        console.warn("No printer selected! Check settings.");
        return { success: false, error: 'Printer tanlanmagan. Sozlamalardan printer tanlang.' };
      }

      const requestBody: Record<string, unknown> = {
        // Har doim printerName yuborish
        printerName: selectedPrinter,
        restaurantName: getRestaurantName(),
        tableName: tableName,
        waiterName: waiterName || '',
        items: items.map(item => ({
          foodName: item.foodName || item.name || 'Noma\'lum',
          quantity: item.quantity || 1
        })),
        createdAt: getUzbekistanTime()
      };

      // Idempotency key qo'shish (agar berilgan bo'lsa)
      if (idempotencyKey) {
        requestBody.idempotencyKey = idempotencyKey;
      }

      console.log("=== SENDING TO PRINTER SERVER ===");
      console.log("URL:", `${PRINT_SERVER_URL}/print/order`);
      console.log("Request body:", JSON.stringify(requestBody, null, 2));

      const res = await fetch(`${PRINT_SERVER_URL}/print/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const result = await res.json();
      console.log("=== PRINTER SERVER RESPONSE ===");
      console.log("Response:", result);

      return result;
    } catch (error) {
      console.error('=== PRINT ORDER DIRECT ERROR ===');
      console.error('Failed to print order direct:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  }
};

// Default export
export default PrinterAPI;
