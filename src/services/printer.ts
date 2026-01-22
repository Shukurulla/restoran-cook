import { PrinterInfo, FoodItem, OrderItem } from '@/types';
import {
  generateTestReceiptHTML,
  generateOrderReceiptHTML,
  generateCancelledReceiptHTML,
} from '@/utils/receipt-generator';

const PRINT_SERVER_URL = 'http://localhost:3829';

export const PrinterAPI = {
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

  async printOrder(order: FoodItem, restaurantName: string, printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Frontendda HTML generatsiya qilish
      const html = generateOrderReceiptHTML({
        items: order.items.map(item => ({
          foodName: item.foodName,
          quantity: item.quantity,
        })),
        tableName: order.tableName,
        waiterName: order.waiterName,
        restaurantName,
        createdAt: new Date(),
      });

      return await this.printHTML(html, printerName);
    } catch (error) {
      console.error('Failed to print order:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  async printCancelled(item: OrderItem, tableName: string, reason: string, restaurantName: string, printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Frontendda HTML generatsiya qilish
      const html = generateCancelledReceiptHTML({
        foodName: item.foodName,
        quantity: item.quantity,
        tableName,
        restaurantName,
        price: item.price,
      });

      return await this.printHTML(html, printerName);
    } catch (error) {
      console.error('Failed to print cancelled:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  async printTest(printerName?: string, restaurantName: string = 'KEPKET'): Promise<{ success: boolean; error?: string }> {
    try {
      // Frontendda HTML generatsiya qilish
      const html = generateTestReceiptHTML(restaurantName);
      return await this.printHTML(html, printerName);
    } catch (error) {
      console.error('Failed to print test:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  // Print directly from newItems (when order object is not available)
  async printNewItems(
    items: Array<Record<string, unknown>>,
    tableName: string,
    tableNumber: number,
    waiterName: string,
    restaurantName: string,
    printerName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Item nomini turli key'lardan olish (foodName, name, title)
      const mappedItems = items.map(item => {
        const foodName = (item.foodName || item.name || item.title || 'Noma\'lum') as string;
        const quantity = (item.quantity || item.count || 1) as number;
        return { foodName, quantity };
      });

      // Frontendda HTML generatsiya qilish
      const html = generateOrderReceiptHTML({
        items: mappedItems,
        tableName,
        waiterName,
        restaurantName,
        createdAt: new Date(),
      });

      return await this.printHTML(html, printerName);
    } catch (error) {
      console.error('Failed to print new items:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  // HTML to'g'ridan-to'g'ri chop etish
  async printHTML(html: string, printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${PRINT_SERVER_URL}/print/html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, printerName })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print HTML:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${PRINT_SERVER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }
};
