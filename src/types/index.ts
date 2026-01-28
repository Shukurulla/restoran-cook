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
  doubleConfirmation?: boolean; // Ikki marta tasdiqlash kerakmi
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
  kitchenStatus?: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled'; // Backend status

  // Tayyorlash boshlandi - oshpaz "Boshlandi" bosgan
  isStarted?: boolean;
  startedAt?: string;
  startedBy?: string;
  startedByName?: string;

  // Tayyorlash davomiyligi (millisekundlarda)
  preparationDuration?: number;

  // Cancelled item fields
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  cancelledByName?: string;
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
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
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

// Shift (Smena) types
export interface Shift {
  _id: string;
  restaurantId: string;
  shiftNumber: number;
  status: 'active' | 'closed';
  openedAt: string;
  closedAt?: string;
  openedBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  closedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  openingCash: number;
  closingCash?: number;
  duration?: number;
  durationFormatted?: string;
}
