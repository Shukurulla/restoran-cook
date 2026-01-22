/**
 * Receipt Generator - Plain Text format
 * Thermal printer uchun oddiy text
 * 32 belgili kenglik (58mm printer)
 */

interface OrderItem {
  foodName?: string;
  name?: string;
  quantity: number;
}

interface OrderData {
  items: OrderItem[];
  tableName: string;
  waiterName?: string;
  restaurantName: string;
  orderNumber?: string | number;
  createdAt?: Date | string;
}

interface CancelledData {
  foodName: string;
  quantity: number;
  tableName: string;
  restaurantName: string;
  price?: number;
}

const WIDTH = 32; // 58mm printer uchun (2 inch = ~32 belgi)
const SEP = "-".repeat(WIDTH);

// Sana: 22.01.2026
function formatDate(date: Date | string = new Date()): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Vaqt: 18:04
function formatTime(date: Date | string = new Date()): string {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Narx: 1,000
function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US").format(price || 0);
}

// Markazga joylashtirish
function center(text: string): string {
  const pad = Math.max(0, Math.floor((WIDTH - text.length) / 2));
  return " ".repeat(pad) + text;
}

// Chap va o'ng tomonga joylashtirish (bir qatorda)
function leftRight(left: string, right: string): string {
  const space = WIDTH - left.length - right.length;
  if (space < 1) {
    // Sig'masa, 2 qatorga bo'lamiz
    return left + "\n" + " ".repeat(WIDTH - right.length) + right;
  }
  return left + " ".repeat(space) + right;
}

// ==================== PUBLIC FUNCTIONS ====================

/**
 * Test page
 */
export function generateTestReceiptHTML(
  restaurantName: string = "KEPKET",
): string {
  const lines = [
    center("ЗАКАЗ TEST"),
    "",
    leftRight("ИСПОЛНИТЕЛЬ:", restaurantName),
    leftRight("МЕСТО:", "TEST"),
    SEP,
    leftRight("ОФИЦИАНТ:", "TEST"),
    leftRight("ДАТА:", `${formatDate()} ${formatTime()}`),
    SEP,
    leftRight("TEST PRINT", "1"),
    SEP,
    center("*** KEPKET ***"),
  ];

  return lines.join("\n");
}

/**
 * Order cheki
 */
export function generateOrderReceiptHTML(data: OrderData): string {
  const items = data.items || [];
  const orderNum =
    data.orderNumber || Math.floor(Math.random() * 900000 + 100000);

  const lines = [
    center(`ЗАКАЗ №${orderNum}`),
    "",
    leftRight("ИСПОЛНИТЕЛЬ:", (data.restaurantName || "OSHXONA").toUpperCase()),
    leftRight("МЕСТО:", (data.tableName || "STOL").toUpperCase()),
    SEP,
    leftRight("ОФИЦИАНТ:", (data.waiterName || "-").toUpperCase()),
    leftRight(
      "ДАТА:",
      `${formatDate(data.createdAt)} ${formatTime(data.createdAt)}`,
    ),
    SEP,
  ];

  // Taomlar
  for (const item of items) {
    const name = (item.foodName || item.name || "Noma'lum").toUpperCase();
    const qty = String(item.quantity || 1);
    lines.push(leftRight(name, qty));
  }

  lines.push(SEP);
  lines.push(center("*** OSHXONA UCHUN ***"));

  return lines.join("\n");
}

/**
 * Atkaz cheki
 */
export function generateCancelledReceiptHTML(data: CancelledData): string {
  const name = (data.foodName || "").toUpperCase();
  const qty = data.quantity || 1;

  const lines = [
    center("*** BEKOR QILINDI ***"),
    "",
    leftRight("МЕСТО:", (data.tableName || "STOL").toUpperCase()),
    SEP,
    leftRight("ДАТА:", `${formatDate()} ${formatTime()}`),
    SEP,
    leftRight(name, qty > 1 ? `x${qty}` : "1"),
  ];

  if (data.price) {
    lines.push(leftRight("", formatPrice(data.price)));
  }

  lines.push(SEP);
  lines.push(center("*** ATKAZ ***"));

  return lines.join("\n");
}

// Export types
export type { OrderData, CancelledData, OrderItem };
