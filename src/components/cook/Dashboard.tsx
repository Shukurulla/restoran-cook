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
import { BiVolumeFull, BiVolumeMute } from "react-icons/bi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://server.kepket.uz";

export function Dashboard() {
  const { user, restaurant } = useAuth();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    ready: 0,
    cancelled: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Track printed orders to avoid duplicates
  const printedOrdersRef = useRef<Set<string>>(new Set());

  // Audio for notifications
  const [audio] = useState(() => {
    if (typeof window !== "undefined") {
      const a = new Audio();
      a.src = "https://server.kepket.uz/mixkit-positive-notification-951.wav";
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
    let cancelled = 0;

    ordersList.forEach((order) => {
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
      if (order.status === "cancelled") {
        cancelled++;
      }
    });

    setStats({ pending, ready, cancelled });
  }, []);

  const loadData = useCallback(async () => {
    try {
      if (!user?.restaurantId) return;
      const itemsData = await api.getFoodItems(
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
    if (!token || !user?.restaurantId) return;

    const cookId = user.id || user._id;

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
      // Join cook room with cookId for filtered orders
      newSocket.emit("cook_connect", {
        restaurantId: user.restaurantId,
        cookId,
      });
    });

    newSocket.on("disconnect", () => {
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

        if (data.allOrders) {
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
          ).then(result => {
            if (result.success) {
              console.log('Order printed successfully');
            } else {
              console.error('Print failed:', result.error);
            }
          }).catch(err => {
            console.error('Print error:', err);
          });
        }
      },
    );

    // Listen for kitchen orders updated
    newSocket.on("kitchen_orders_updated", (orders: FoodItem[]) => {
      setItems(orders);
      calculateStats(orders);
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
    try {
      if (readyCount !== undefined) {
        // Qisman tayyor qilish - API orqali (waiter'ga notification ham API yuboradi)
        const { data: allOrders } = await api.markItemPartialReady(order._id, itemIndex, readyCount);
        setItems(allOrders);
        calculateStats(allOrders);
      } else {
        // Eski usul - to'liq tayyor/tayyor emas qilish
        const { data: allOrders } = await api.markItemReady(order._id, itemIndex);
        setItems(allOrders);
        calculateStats(allOrders);
      }
    } catch (error) {
      console.error("Failed to mark ready:", error);
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

      <FoodItemsList items={items} onMarkReady={handleMarkReady} />

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
    </div>
  );
}
