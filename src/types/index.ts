export interface User {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  name?: string;
  phone: string;
  role: string;
  restaurantId: string;
  assignedCategories?: string[];
}

export interface Restaurant {
  id: string;
  _id?: string;
  name: string;
  slug?: string;
  logo?: string;
}

export interface OrderItem {
  foodId: string;
  foodName: string;
  category?: string;
  quantity: number;
  price: number;
  isReady: boolean;
  readyQuantity?: number; // Qisman tayyor - nechta tayyor bo'lgani
  readyAt?: string;
  addedAt?: string; // Item qo'shilgan vaqt
  originalIndex?: number;
  requireDoubleConfirmation?: boolean; // Ikki marta tasdiqlash kerak
}

export interface FoodItem {
  _id: string;
  orderId: string;
  restaurantId: string;
  tableId: string;
  tableName: string;
  tableNumber: number;
  waiterId?: string;
  waiterName?: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  allItemsReady: boolean;
  notifiedWaiter?: boolean;
  notifiedAt?: string;
  createdAt: string;
  waiterApproved?: boolean;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export type TabType = 'new' | 'ready' | 'served' | 'cancelled';

export interface Stats {
  pending: number;
  ready: number;
  served: number;
  cancelled: number;
}
