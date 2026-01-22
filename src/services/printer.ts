import { PrinterInfo, FoodItem, OrderItem } from '@/types';

const PRINT_SERVER_URL = 'http://localhost:3847';

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
      const res = await fetch(`${PRINT_SERVER_URL}/print/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: order.items.map(item => ({
            name: item.foodName,
            quantity: item.quantity,
            category: item.category,
          })),
          tableName: order.tableName,
          tableNumber: order.tableNumber,
          waiterName: order.waiterName,
          restaurantName,
          date: new Date().toLocaleString('uz-UZ'),
          printerName
        })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print order:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  async printCancelled(item: OrderItem, tableName: string, reason: string, restaurantName: string, printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${PRINT_SERVER_URL}/print/cancelled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: item.foodName,
          quantity: item.quantity,
          tableName,
          reason,
          restaurantName,
          date: new Date().toLocaleString('uz-UZ'),
          printerName
        })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print cancelled:', error);
      return { success: false, error: 'Printer server bilan bog\'lanib bo\'lmadi' };
    }
  },

  async printTest(printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${PRINT_SERVER_URL}/print/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerName })
      });
      return await res.json();
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
        const category = (item.category || item.categoryName || '') as string;

        console.log('Mapping item:', { original: item, mapped: { foodName, quantity, category } });

        return { foodName, quantity, category };
      });

      console.log('Sending to printer:', { items: mappedItems, tableName, tableNumber });

      const res = await fetch(`${PRINT_SERVER_URL}/print/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: mappedItems,
          tableName,
          tableNumber,
          waiterName,
          restaurantName,
          date: new Date().toLocaleString('uz-UZ'),
          printerName
        })
      });
      return await res.json();
    } catch (error) {
      console.error('Failed to print new items:', error);
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
