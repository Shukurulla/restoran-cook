import { User, Restaurant, FoodItem } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://server.kepket.uz";

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

  async login(
    phone: string,
    password: string,
  ): Promise<{ user: User; token: string; restaurant: Restaurant }> {
    const data = await this.request<{
      staff: User;
      token: string;
      restaurant: Restaurant;
    }>("/api/staff/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });

    this.setToken(data.token);

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(data.staff));
      localStorage.setItem("restaurant", JSON.stringify(data.restaurant));
    }

    return { user: data.staff, token: data.token, restaurant: data.restaurant };
  }

  async getFoodItems(
    restaurantId: string,
    cookId?: string,
  ): Promise<FoodItem[]> {
    const params = new URLSearchParams({ restaurantId });
    if (cookId) {
      params.append("cookId", cookId);
    }
    const data = await this.request<{ data: FoodItem[] }>(
      `/api/kitchen-orders?${params.toString()}`,
    );
    return data.data;
  }

  async markItemReady(
    orderId: string,
    itemIndex: number,
  ): Promise<{ data: FoodItem[]; updatedOrder: FoodItem }> {
    const data = await this.request<{
      data: FoodItem[];
      updatedOrder: FoodItem;
    }>(`/api/kitchen-orders/${orderId}/items/${itemIndex}/ready`, {
      method: "PATCH",
    });
    return data;
  }

  async notifyWaiter(orderId: string): Promise<FoodItem> {
    const data = await this.request<{ data: FoodItem }>(
      `/api/kitchen-orders/${orderId}/notify-waiter`,
      {
        method: "PATCH",
      },
    );
    return data.data;
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
