"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { PrinterAPI } from "@/services/printer";
import { FoodItem, Stats } from "@/types";
import { Header } from "./Header";
import { FoodItemsList } from "./FoodItemsList";
import { SettingsModal } from "./SettingsModal";
import { BiVolumeFull, BiVolumeMute, BiCheck, BiUndo } from "react-icons/bi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://server-v2.kepket.uz";

// Notification modal type
interface NotificationModal {
  show: boolean;
  type: 'ready' | 'revert';
  waiterName: string;
  foodName: string;
}

export function Dashboard() {
  const { user, restaurant } = useAuth();
  const [items, setItems] = useState<FoodItem[]>([]);

  // Debug - Dashboard render bo'lganini tekshirish
  console.log("=== DASHBOARD RENDERED ===");
  console.log("user from useAuth:", user);
  console.log("restaurant from useAuth:", restaurant);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    ready: 0,
    served: 0,
    cancelled: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Notification modal - buyurtma jo'natilganda/qaytarilganda ko'rsatiladi
  const [notification, setNotification] = useState<NotificationModal>({
    show: false,
    type: 'ready',
    waiterName: '',
    foodName: '',
  });

  // Animatsiya uchun - qaysi item o'chirilmoqda
  const [removingItem, setRemovingItem] = useState<string | null>(null);

  // Loading state - tugmalarni disable qilish uchun
  const [isLoading, setIsLoading] = useState(false);

  // Track printed orders to avoid duplicates
  const printedOrdersRef = useRef<Set<string>>(new Set());

  // Audio for notifications
  const [audio] = useState(() => {
    if (typeof window !== "undefined") {
      const a = new Audio();
      a.src = "https://server-v2.kepket.uz/mixkit-positive-notification-951.wav";
      return a;
    }
    return null;
  });

  // Auto-print function for new orders
  const autoPrintOrder = useCallback(async (order: FoodItem) => {
    // Check if auto-print is enabled
    const autoPrintEnabled = localStorage.getItem("autoPrint") !== "false";
    if (!autoPrintEnabled) return;

    // Check if order already printed (by order ID)
    const orderId = order._id;
    if (!orderId || printedOrdersRef.current.has(orderId)) {
      return;
    }

    // Mark as printed
    printedOrdersRef.current.add(orderId);

    // Get printer settings
    const selectedPrinter = localStorage.getItem("selectedPrinter") || undefined;
    const restaurantName = restaurant?.name || "Restoran";

    try {
      const result = await PrinterAPI.printOrder(order, restaurantName, selectedPrinter);
      if (result.success) {
        console.log(`Order ${orderId} printed successfully`);
      } else {
        console.error(`Failed to print order ${orderId}:`, result.error);
      }
    } catch (error) {
      console.error("Auto-print error:", error);
    }
  }, [restaurant?.name]);

  const calculateStats = useCallback((ordersList: FoodItem[]) => {
    let pending = 0;
    let ready = 0;
    let served = 0;
    let cancelled = 0;

    ordersList.forEach((order) => {
      // Served orderlar uchun alohida hisoblash
      if (order.status === 'served') {
        served += order.items.length;
      } else if (order.status === "cancelled") {
        cancelled++;
      } else {
        order.items.forEach((item) => {
          // Qisman tayyor bo'lgan itemlarni to'g'ri hisoblash
          const readyQty = item.readyQuantity || 0;
          const remaining = item.quantity - readyQty;
          if (remaining <= 0) {
            ready++;
          } else {
            pending++;
          }
        });
      }
    });

    setStats({ pending, ready, served, cancelled });
  }, []);

  const loadData = useCallback(async () => {
    try {
      if (!user?.restaurantId) return;
      // "all" status bilan - preparing va ready orderlarni ham olish
      const itemsData = await api.getAllItems(
        user.restaurantId,
        user.id || user._id,
      );
      setItems(itemsData);
      calculateStats(itemsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }, [calculateStats, user]);

  // Socket connection
  useEffect(() => {
    const token = api.getToken();

    console.log("=== SOCKET CHECK ===");
    console.log("token:", token ? "exists" : "NULL");
    console.log("user:", user);
    console.log("user?.restaurantId:", user?.restaurantId);

    if (!token || !user?.restaurantId) {
      console.log("=== SOCKET SKIPPED - missing token or restaurantId ===");
      return;
    }

    const cookId = user.id || user._id;

    console.log("=== SOCKET CONNECTING ===");
    console.log("API_URL:", API_URL);
    console.log("token:", token ? "exists" : "null");
    console.log("restaurantId:", user.restaurantId);
    console.log("cookId:", cookId);

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("=== SOCKET CONNECTED ===");
      setIsConnected(true);
      // Join cook room with cookId for filtered orders
      newSocket.emit("cook_connect", {
        restaurantId: user.restaurantId,
        cookId,
      });
    });

    newSocket.on("connect_error", (error) => {
      console.error("=== SOCKET CONNECT ERROR ===", error.message);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("=== SOCKET DISCONNECTED ===", reason);
      setIsConnected(false);
    });

    // Listen for new kitchen orders (filtered by cook's categories)
    newSocket.on(
      "new_kitchen_order",
      async (data: {
        order: FoodItem | null;
        allOrders: FoodItem[];
        isNewOrder: boolean;
        newItems?: Array<Record<string, unknown>>;
      }) => {
        console.log("=== NEW KITCHEN ORDER EVENT ===");
        console.log("isNewOrder:", data.isNewOrder);
        console.log("order:", data.order);
        console.log("allOrders count:", data.allOrders?.length);
        console.log("newItems:", data.newItems);

        // Defensive check: ensure allOrders is an array
        if (data.allOrders && Array.isArray(data.allOrders)) {
          setItems(data.allOrders);
          calculateStats(data.allOrders);
        }

        // Play sound if newItems exists (new items added)
        if (soundEnabled && data.newItems && data.newItems.length > 0) {
          audio?.play().catch(() => {});
        }

        // Auto-print - yangi buyurtmalar uchun chek chiqarish
        const autoPrintEnabled = localStorage.getItem("autoPrint") !== "false";
        if (autoPrintEnabled && data.newItems && data.newItems.length > 0) {
          const selectedPrinter = localStorage.getItem("selectedPrinter") || undefined;
          const orderInfo = data.order || (data.allOrders && data.allOrders.length > 0 ? data.allOrders[data.allOrders.length - 1] : null);
          const tableName = orderInfo?.tableName || "Noma'lum stol";
          const waiterName = orderInfo?.waiterName || "";

          // /print/order endpoint ga to'g'ridan-to'g'ri yuborish
          PrinterAPI.printOrderDirect(
            tableName,
            waiterName,
            data.newItems as Array<{ foodName?: string; name?: string; quantity?: number }>,
            selectedPrinter
          ).then((result: { success: boolean; error?: string }) => {
            if (result.success) {
              console.log('Order printed successfully');
            } else {
              console.error('Print failed:', result.error);
            }
          }).catch((err: Error) => {
            console.error('Print error:', err);
          });
        }
      },
    );

    // Listen for kitchen orders updated
    newSocket.on("kitchen_orders_updated", (orders: FoodItem[]) => {
      // Defensive check: ensure orders is an array
      if (Array.isArray(orders)) {
        setItems(orders);
        calculateStats(orders);
      } else {
        console.error('kitchen_orders_updated received non-array:', orders);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [
    user?.restaurantId,
    user?.id,
    user?._id,
    audio,
    soundEnabled,
    calculateStats,
    autoPrintOrder,
    restaurant?.name,
  ]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkReady = async (order: FoodItem, itemIndex: number, readyCount?: number) => {
    // Agar allaqachon loading bo'lsa, hech narsa qilmaymiz
    if (isLoading) return;

    try {
      setIsLoading(true);
      const cookId = user?.id || user?._id;
      const item = order.items[itemIndex];
      const foodName = item?.foodName || 'Taom';
      const waiterName = order.waiterName || 'Ofitsiant';

      // Animatsiyani boshlash
      const itemKey = `${order._id}-${itemIndex}`;
      setRemovingItem(itemKey);

      if (readyCount !== undefined) {
        // Qisman tayyor qilish - API orqali
        const { data: allOrders } = await api.markItemPartialReady(order._id, itemIndex, readyCount, cookId);

        // Modal ko'rsatish
        setNotification({
          show: true,
          type: 'ready',
          waiterName,
          foodName,
        });

        // 1 sekunddan keyin modalni yopish va state'ni yangilash
        setTimeout(() => {
          setNotification(prev => ({ ...prev, show: false }));
          setRemovingItem(null);
          setItems(allOrders);
          calculateStats(allOrders);
          setIsLoading(false);
        }, 1000);
      } else {
        // Eski usul - to'liq tayyor/tayyor emas qilish
        const { data: allOrders } = await api.markItemReady(order._id, itemIndex);
        setItems(allOrders);
        calculateStats(allOrders);
        setRemovingItem(null);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to mark ready:", error);
      setRemovingItem(null);
      setIsLoading(false);
      alert("Xatolik yuz berdi");
    }
  };

  const handleRevertReady = async (order: FoodItem, itemIndex: number, revertCount: number) => {
    // Agar allaqachon loading bo'lsa, hech narsa qilmaymiz
    if (isLoading) return;

    try {
      setIsLoading(true);
      const cookId = user?.id || user?._id;
      const item = order.items[itemIndex];
      const foodName = item?.foodName || 'Taom';

      // Revert uchun animatsiya kerak emas - darhol yangilash
      const { data: allOrders } = await api.revertItemReady(order._id, itemIndex, revertCount, cookId);

      // Darhol ma'lumotlarni yangilash (animatsiyasiz)
      setItems(allOrders);
      calculateStats(allOrders);

      // Modal ko'rsatish
      setNotification({
        show: true,
        type: 'revert',
        waiterName: '',
        foodName,
      });

      // 1 sekunddan keyin modalni yopish
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to revert ready:", error);
      setIsLoading(false);
      alert("Xatolik yuz berdi");
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto">
      <Header
        stats={stats}
        isConnected={isConnected}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <FoodItemsList items={items} onMarkReady={handleMarkReady} onRevertReady={handleRevertReady} removingItem={removingItem} isLoading={isLoading} />

      {/* Sound Toggle */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors
          ${
            soundEnabled
              ? "bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e]"
              : "bg-secondary border border-border text-muted-foreground"
          }`}
      >
        {soundEnabled ? (
          <BiVolumeFull className="text-lg" />
        ) : (
          <BiVolumeMute className="text-lg" />
        )}
        <span>{soundEnabled ? "Ovoz yoqilgan" : "Ovoz o'chirilgan"}</span>
      </button>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Notification Modal - buyurtma jo'natilganda/qaytarilganda */}
      {notification.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`px-8 py-6 rounded-2xl shadow-2xl transform transition-all duration-300 animate-in zoom-in-95 fade-in
            ${notification.type === 'ready'
              ? 'bg-[#22c55e] text-white'
              : 'bg-[#f97316] text-white'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              {notification.type === 'ready' ? (
                <BiCheck className="text-5xl" />
              ) : (
                <BiUndo className="text-5xl" />
              )}
              <div className="text-center">
                <p className="text-xl font-bold mb-1">
                  {notification.type === 'ready'
                    ? `${notification.foodName} tayyor!`
                    : `${notification.foodName} qaytarildi`
                  }
                </p>
                {notification.type === 'ready' && notification.waiterName && (
                  <p className="text-white/90">
                    {notification.waiterName} ga jo&apos;natildi
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
