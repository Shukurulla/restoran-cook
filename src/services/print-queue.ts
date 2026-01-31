/**
 * Print Queue Service - Markazlashtirilgan print navbati
 *
 * Bu service quyidagi muammolarni hal qiladi:
 * 1. Dublikat printlarni oldini olish (atomic deduplication)
 * 2. Race condition - mutex lock bilan
 * 3. Parallel printlarni navbatga qo'yish
 * 4. Retry mexanizmi
 * 5. Idempotency key bilan takroriy so'rovlarni bloklash
 */

import { PrinterAPI, PrintResult } from './printer';
import { api } from './api';

// ==================== TYPES ====================

export interface PrintJob {
  id: string;                    // Unique job ID (idempotency key)
  tableName: string;
  waiterName: string;
  items: Array<{ foodName: string; quantity: number }>;
  itemIds: string[];             // Backend itemIds - print success da status yangilash uchun
  createdAt: number;             // Timestamp
  retryCount: number;
  status: 'pending' | 'printing' | 'completed' | 'failed';
}

export interface QueueStats {
  pending: number;
  completed: number;
  failed: number;
  totalProcessed: number;
}

// ==================== PRINT QUEUE CLASS ====================

class PrintQueueService {
  private queue: PrintJob[] = [];
  private printedIds: Set<string> = new Set();
  private isProcessing: boolean = false;
  private stats: QueueStats = { pending: 0, completed: 0, failed: 0, totalProcessed: 0 };

  // Configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly DEDUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 daqiqa (60 sek emas)
  private readonly PROCESS_INTERVAL_MS = 100; // Queue ni tekshirish oralig'i

  constructor() {
    // Queue processor ni ishga tushirish
    this.startQueueProcessor();
    console.log('🖨️ PrintQueue initialized');
  }

  /**
   * Yangi print jobni qo'shish
   * @returns true agar job qo'shilgan bo'lsa, false agar dublikat bo'lsa
   */
  addJob(
    tableName: string,
    waiterName: string,
    items: Array<{ foodName: string; quantity: number }>,
    orderId?: string,
    itemIds?: string[]
  ): boolean {
    // Unique ID yaratish (idempotency key)
    const jobId = this.generateJobId(orderId || '', tableName, items);

    // Dublikat tekshirish - ATOMIC
    if (this.printedIds.has(jobId)) {
      console.log(`🖨️ [QUEUE] SKIPPED - already printed: ${jobId}`);
      return false;
    }

    // Darhol printed ids ga qo'shish (race condition oldini olish)
    this.printedIds.add(jobId);

    // Timeout dan keyin tozalash
    setTimeout(() => {
      this.printedIds.delete(jobId);
      console.log(`🖨️ [QUEUE] Cleared from dedup cache: ${jobId}`);
    }, this.DEDUP_TIMEOUT_MS);

    // Job yaratish
    const job: PrintJob = {
      id: jobId,
      tableName,
      waiterName,
      items: [...items], // Copy to prevent mutation
      itemIds: itemIds || [], // Backend item IDs
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    // Queue ga qo'shish
    this.queue.push(job);
    this.stats.pending++;

    console.log(`🖨️ [QUEUE] Job added: ${jobId} (${items.length} items, queue size: ${this.queue.length})`);

    return true;
  }

  /**
   * Bir nechta itemlarni bitta job sifatida qo'shish
   * Grouping: bir xil orderId va tableName uchun
   */
  addItems(
    orderId: string,
    tableName: string,
    waiterName: string,
    items: Array<{ foodName: string; quantity: number; itemId?: string }>
  ): { added: number; skipped: number } {
    let added = 0;
    let skipped = 0;

    // Har bir itemni alohida tekshirish
    const newItems: Array<{ foodName: string; quantity: number }> = [];
    const newItemIds: string[] = []; // Backend itemIds

    for (const item of items) {
      const itemKey = `${orderId}-${item.itemId || ''}-${item.foodName}-${item.quantity}`;

      if (!this.printedIds.has(itemKey)) {
        this.printedIds.add(itemKey);
        newItems.push({ foodName: item.foodName, quantity: item.quantity });
        if (item.itemId) {
          newItemIds.push(item.itemId);
        }
        added++;

        // Timeout
        setTimeout(() => {
          this.printedIds.delete(itemKey);
        }, this.DEDUP_TIMEOUT_MS);
      } else {
        skipped++;
        console.log(`🖨️ [QUEUE] Item skipped (duplicate): ${itemKey}`);
      }
    }

    // Agar yangi itemlar bo'lsa, job yaratish
    if (newItems.length > 0) {
      const jobId = `job-${orderId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const job: PrintJob = {
        id: jobId,
        tableName,
        waiterName,
        items: newItems,
        itemIds: newItemIds, // Backend item IDs - print success da status yangilash uchun
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending'
      };

      this.queue.push(job);
      this.stats.pending++;

      console.log(`🖨️ [QUEUE] Job created: ${jobId} with ${newItems.length} new items, ${newItemIds.length} itemIds`);
    }

    return { added, skipped };
  }

  /**
   * Queue processor - background da ishlaydi
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, this.PROCESS_INTERVAL_MS);
  }

  /**
   * Queue ni qayta ishlash
   */
  private async processQueue(): Promise<void> {
    // Agar allaqachon ishlamoqda bo'lsa yoki queue bo'sh bo'lsa - chiqish
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    // Lock olish
    this.isProcessing = true;

    try {
      // Birinchi pending jobni olish
      const job = this.queue.find(j => j.status === 'pending');

      if (!job) {
        this.isProcessing = false;
        return;
      }

      // Statusni yangilash
      job.status = 'printing';

      console.log(`🖨️ [QUEUE] Processing job: ${job.id}`);

      // Print qilish
      const result = await this.executePrint(job);

      if (result.success) {
        job.status = 'completed';
        this.stats.completed++;
        this.stats.pending--;
        this.stats.totalProcessed++;

        // Queue dan olib tashlash
        const idx = this.queue.indexOf(job);
        if (idx > -1) this.queue.splice(idx, 1);

        console.log(`🖨️ [QUEUE] Job completed: ${job.id}`);

        // 🖨️ Backend da status ni 'printed' ga yangilash
        if (job.itemIds && job.itemIds.length > 0) {
          try {
            await api.bulkUpdatePrinterStatus(job.itemIds, 'printed');
            console.log(`🖨️ [QUEUE] Updated ${job.itemIds.length} items to 'printed' status`);
          } catch (err) {
            console.error('🖨️ [QUEUE] Failed to update printer status:', err);
            // Print muvaffaqiyatli bo'ldi, status yangilanmasa ham davom etamiz
          }
        }
      } else {
        // Retry
        job.retryCount++;

        if (job.retryCount >= this.MAX_RETRIES) {
          job.status = 'failed';
          this.stats.failed++;
          this.stats.pending--;

          // Queue dan olib tashlash
          const idx = this.queue.indexOf(job);
          if (idx > -1) this.queue.splice(idx, 1);

          console.error(`🖨️ [QUEUE] Job FAILED after ${this.MAX_RETRIES} retries: ${job.id}`, result.error);
        } else {
          // Retry uchun pending ga qaytarish
          job.status = 'pending';
          console.warn(`🖨️ [QUEUE] Job retry ${job.retryCount}/${this.MAX_RETRIES}: ${job.id}`, result.error);

          // Retry delay
          await this.delay(this.RETRY_DELAY_MS);
        }
      }
    } catch (error) {
      console.error('🖨️ [QUEUE] Process error:', error);
    } finally {
      // Lock bo'shatish
      this.isProcessing = false;
    }
  }

  /**
   * Haqiqiy print operatsiyasi
   * Job ID ni idempotency key sifatida yuboradi
   */
  private async executePrint(job: PrintJob): Promise<PrintResult> {
    try {
      return await PrinterAPI.printOrderDirect(
        job.tableName,
        job.waiterName,
        job.items,
        undefined, // printerName - localStorage dan olinadi
        job.id     // idempotency key - dublikat printni oldini olish uchun
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unique job ID generatsiya qilish
   */
  private generateJobId(orderId: string, tableName: string, items: Array<{ foodName: string; quantity: number }>): string {
    const itemsHash = items
      .map(i => `${i.foodName}:${i.quantity}`)
      .sort()
      .join('|');

    return `${orderId}-${tableName}-${itemsHash}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Item allaqachon printed mi tekshirish
   */
  isItemPrinted(orderId: string, itemId: string, foodName: string, quantity: number): boolean {
    const key = `${orderId}-${itemId}-${foodName}-${quantity}`;
    return this.printedIds.has(key);
  }

  /**
   * Itemni printed sifatida belgilash (socket eventlardan)
   */
  markItemAsPrinted(orderId: string, itemId: string, foodName: string, quantity: number): void {
    const key = `${orderId}-${itemId}-${foodName}-${quantity}`;

    if (!this.printedIds.has(key)) {
      this.printedIds.add(key);

      setTimeout(() => {
        this.printedIds.delete(key);
      }, this.DEDUP_TIMEOUT_MS);
    }
  }

  /**
   * Statistikalarni olish
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Queue holatini olish
   */
  getQueueStatus(): { queueSize: number; isProcessing: boolean; printedCount: number } {
    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      printedCount: this.printedIds.size
    };
  }

  /**
   * Cache ni tozalash (yangi smena uchun)
   */
  clearCache(): void {
    this.printedIds.clear();
    this.queue = [];
    this.stats = { pending: 0, completed: 0, failed: 0, totalProcessed: 0 };
    console.log('🖨️ [QUEUE] Cache cleared');
  }

  /**
   * Mavjud itemlarni cache ga qo'shish (initial load uchun)
   */
  registerExistingItems(orders: Array<{ _id: string; items: Array<{ _id?: string; foodName: string; quantity: number; kitchenStatus?: string }> }>): number {
    let count = 0;

    orders.forEach(order => {
      const pendingItems = order.items?.filter(i => i.kitchenStatus === 'pending') || [];

      pendingItems.forEach((item, idx) => {
        const itemId = item._id || `idx-${idx}`;
        const key = `${order._id}-${itemId}-${item.foodName}-${item.quantity}`;

        if (!this.printedIds.has(key)) {
          this.printedIds.add(key);
          count++;

          // Timeout
          setTimeout(() => {
            this.printedIds.delete(key);
          }, this.DEDUP_TIMEOUT_MS);
        }
      });
    });

    console.log(`🖨️ [QUEUE] Registered ${count} existing items`);
    return count;
  }
}

// Singleton instance
export const printQueue = new PrintQueueService();

// Default export
export default printQueue;
