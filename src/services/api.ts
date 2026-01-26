import { User, Restaurant, FoodItem, OrderItem } from "@/types";

// Yangi backend v2 URL
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://server-v2.kepket.uz";

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("token");
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("restaurant");
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: "Xatolik yuz berdi" }));
      throw new Error(error.message || "Xatolik yuz berdi");
    }

    return res.json();
  }

  // ========== AUTH (yangi endpoint: /api/auth/login) ==========
  async login(
    phone: string,
    password: string,
  ): Promise<{ user: User; token: string; restaurant: Restaurant }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });

    const responseData = data.data || data;
    this.setToken(responseData.token);

    const staff = responseData.staff;
    const user: User = {
      id: staff._id,
      _id: staff._id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      name: `${staff.firstName} ${staff.lastName}`,
      phone: staff.phone,
      role: staff.role,
      restaurantId: staff.restaurantId,
      assignedCategories: staff.assignedCategories || [],
      doubleConfirmation: staff.doubleConfirmation || false, // Ikki marta tasdiqlash
    };

    const restaurant: Restaurant = {
      id: responseData.restaurant?._id || '',
      _id: responseData.restaurant?._id || '',
      name: responseData.restaurant?.name || '',
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("restaurant", JSON.stringify(restaurant));
    }

    return { user, token: responseData.token, restaurant };
  }

  // ========== KITCHEN ORDERS (yangi endpoint: /api/kitchen/orders) ==========
  async getFoodItems(
    restaurantId: string,
    cookId?: string,
    status?: "preparing" | "ready" | "all",
  ): Promise<FoodItem[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') {
      params.append("status", status);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(
      `/api/kitchen/orders${params.toString() ? '?' + params.toString() : ''}`,
    );

    const orders = data.data || [];

    // Transform to FoodItem format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return orders.map((order: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: OrderItem[] = (order.items || []).map((item: any, idx: number) => ({
        foodId: item.foodId?._id || item.foodId || '',
        foodName: item.foodId?.name || item.name || 'Noma\'lum',
        category: item.foodId?.categoryId || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        isReady: item.kitchenStatus === 'ready' || item.kitchenStatus === 'served',
        readyQuantity: item.readyQuantity ?? (item.kitchenStatus === 'ready' ? item.quantity : 0),
        readyAt: item.readyAt,
        addedAt: item.addedAt || order.createdAt,
        // Backend dan kelgan originalIndex ni ishlatish, aks holda local index
        originalIndex: item.originalIndex !== undefined ? item.originalIndex : idx,
        kitchenStatus: item.kitchenStatus || 'pending',
      }));

      return {
        _id: order._id,
        orderId: order._id,
        restaurantId: order.restaurantId || restaurantId,
        tableId: order.tableId?._id || order.tableId || '',
        tableName: order.tableId?.number ? `Stol ${order.tableId.number}` : (order.tableName || ''),
        tableNumber: order.tableId?.number || order.tableNumber || 0,
        waiterId: order.waiterId?._id || order.waiterId || '',
        waiterName: order.waiterId?.firstName
          ? `${order.waiterId.firstName} ${order.waiterId.lastName}`
          : '',
        items,
        status: order.status || 'pending',
        allItemsReady: items.every((item: OrderItem) => item.isReady),
        notifiedWaiter: false,
        createdAt: order.createdAt,
        waiterApproved: true,
      } as FoodItem;
    });
  }

  // Tayyorlanmoqda (pending + preparing) itemlarni olish
  async getPreparingItems(
    restaurantId: string,
    cookId?: string,
  ): Promise<FoodItem[]> {
    return this.getFoodItems(restaurantId, cookId, "preparing");
  }

  // Tayyor (ready) itemlarni olish
  async getReadyItems(
    restaurantId: string,
    cookId?: string,
  ): Promise<FoodItem[]> {
    return this.getFoodItems(restaurantId, cookId, "ready");
  }

  // Barcha itemlarni olish (preparing + ready)
  async getAllItems(
    restaurantId: string,
    cookId?: string,
  ): Promise<FoodItem[]> {
    return this.getFoodItems(restaurantId, cookId, "all");
  }

  // ========== KITCHEN ITEM STATUS ==========
  async markItemReady(
    orderId: string,
    itemIndex: number,
  ): Promise<{ data: FoodItem[]; updatedOrder: FoodItem }> {
    // Yangi backend: /api/kitchen/orders/:orderId/items/:itemId/status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.request<any>(
      `/api/kitchen/orders/${orderId}/items/${itemIndex}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ready" }),
      },
    );

    const restaurant = this.getStoredRestaurant();
    const allItems = await this.getFoodItems(restaurant?.id || restaurant?._id || '');
    const updatedOrder = allItems.find(item => item._id === orderId) || allItems[0];

    return { data: allItems, updatedOrder };
  }

  // Qisman tayyor qilish (partial ready)
  async markItemPartialReady(
    orderId: string,
    itemIndex: number,
    readyCount: number,
    cookId?: string,
  ): Promise<{ data: FoodItem[]; updatedOrder: FoodItem }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.request<any>(
      `/api/kitchen/orders/${orderId}/items/${itemIndex}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ready", readyCount, cookId }),
      },
    );

    const restaurant = this.getStoredRestaurant();
    const allItems = await this.getFoodItems(restaurant?.id || restaurant?._id || '');
    const updatedOrder = allItems.find(item => item._id === orderId) || allItems[0];

    return { data: allItems, updatedOrder };
  }

  // Ortga qaytarish (revert ready)
  async revertItemReady(
    orderId: string,
    itemIndex: number,
    revertCount: number,
    cookId?: string,
  ): Promise<{ data: FoodItem[]; updatedOrder: FoodItem }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.request<any>(
      `/api/kitchen/orders/${orderId}/items/${itemIndex}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "preparing", revertCount, cookId }),
      },
    );

    const restaurant = this.getStoredRestaurant();
    const allItems = await this.getFoodItems(restaurant?.id || restaurant?._id || '');
    const updatedOrder = allItems.find(item => item._id === orderId) || allItems[0];

    return { data: allItems, updatedOrder };
  }

  // Waiter ga xabar berish
  async notifyWaiter(orderId: string): Promise<FoodItem> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.request<any>(
      `/api/kitchen/call-waiter`,
      {
        method: "POST",
        body: JSON.stringify({ orderId }),
      },
    );

    const restaurant = this.getStoredRestaurant();
    const allItems = await this.getFoodItems(restaurant?.id || restaurant?._id || '');
    return allItems.find(item => item._id === orderId) || allItems[0];
  }

  // Start preparing order
  async startOrder(orderId: string): Promise<FoodItem> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.request<any>(
      `/api/kitchen/orders/${orderId}/start`,
      { method: "POST" },
    );

    const restaurant = this.getStoredRestaurant();
    const allItems = await this.getFoodItems(restaurant?.id || restaurant?._id || '');
    return allItems.find(item => item._id === orderId) || allItems[0];
  }

  // Complete order
  async completeOrder(orderId: string): Promise<FoodItem> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.request<any>(
      `/api/kitchen/orders/${orderId}/complete`,
      { method: "POST" },
    );

    const restaurant = this.getStoredRestaurant();
    const allItems = await this.getFoodItems(restaurant?.id || restaurant?._id || '');
    return allItems.find(item => item._id === orderId) || allItems[0];
  }

  getStoredUser(): User | null {
    if (typeof window === "undefined") return null;
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  getStoredRestaurant(): Restaurant | null {
    if (typeof window === "undefined") return null;
    const restaurantStr = localStorage.getItem("restaurant");
    return restaurantStr ? JSON.parse(restaurantStr) : null;
  }
}

export const api = new ApiService();
