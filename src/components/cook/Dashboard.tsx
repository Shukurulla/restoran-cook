"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { PrinterAPI } from "@/services/printer";
import { notificationService } from "@/services/notification";
import { FoodItem, Stats, Shift } from "@/types";
import { Header } from "./Header";
import { FoodItemsList } from "./FoodItemsList";
import { SettingsModal } from "./SettingsModal";
import { BiVolumeFull, BiVolumeMute, BiCheck, BiUndo, BiBell, BiBellOff } from "react-icons/bi";

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
  console.log("=== DASHBOARD RENDERED ===", new Date().toISOString());
  console.log("user:", user ? { id: user.id, restaurantId: user.restaurantId } : "NULL");
  console.log("token in localStorage:", typeof window !== 'undefined' ? (localStorage.getItem('token') ? 'EXISTS' : 'NULL') : 'SSR');
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    ready: 0,
    served: 0,
    cancelled: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Push notification permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

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

  // Track previous items count to detect new items
  const prevItemsCountRef = useRef<number>(0);

  // Audio ref - professional approach
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  // Initialize audio on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio("/mixkit-positive-notification-951.wav");
      audioRef.current.preload = "auto";
      console.log("🔊 Audio initialized");
    }
  }, []);

  // Function to play notification sound
  const playNotificationSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !soundEnabled) {
      console.log("🔊 Sound skipped - audio:", !!audio, "enabled:", soundEnabled);
      return;
    }

    console.log("🔊 Attempting to play sound...");
    audio.currentTime = 0;
    audio.volume = 1;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("🔊 ✅ Sound played successfully!");
          audioUnlockedRef.current = true;
        })
        .catch((error) => {
          console.log("🔊 ❌ Sound play failed:", error.message);
          // If blocked by autoplay policy, we need user interaction
          if (error.name === "NotAllowedError") {
            console.log("🔊 Audio blocked - need user interaction first");
          }
        });
    }
  }, [soundEnabled]);

  // Simple debug useEffect - bu ishlayaptimi?
  useEffect(() => {
    // alert("useEffect ishladi! restaurantId: " + user?.restaurantId);
    console.warn(">>> TEST USEEFFECT <<<");
    console.warn(">>> user?.restaurantId:", user?.restaurantId);
    console.warn(">>> api.getToken():", api.getToken() ? "EXISTS" : "NULL");

    // Socket test
    if (user?.restaurantId && api.getToken()) {
      console.warn(">>> SOCKET SHOULD CONNECT NOW <<<");
    }
  }, [user?.restaurantId]);

  // Request notification permission on page load
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (notificationService.isSupported()) {
        const permission = await notificationService.requestPermission();
        setNotificationPermission(permission);
        console.log("Notification permission:", permission);
      }
    };
    requestNotificationPermission();
  }, []);

  // Handle sound toggle with permission request
  const handleSoundToggle = async () => {
    const newSoundEnabled = !soundEnabled;

    // Request notification permission when enabling sound
    if (newSoundEnabled && notificationService.getPermission() === "default") {
      const permission = await notificationService.requestPermission();
      setNotificationPermission(permission);
    }

    setSoundEnabled(newSoundEnabled);
    notificationService.setSoundEnabled(newSoundEnabled);

    // Play test sound when enabling to unlock audio and confirm it works
    if (newSoundEnabled) {
      playNotificationSound();
    }
  };

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
      const [itemsData, shiftData] = await Promise.all([
        api.getAllItems(user.restaurantId, user.id || user._id),
        api.getActiveShift(),
      ]);
      setItems(itemsData);
      calculateStats(itemsData);
      setActiveShift(shiftData);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }, [calculateStats, user]);

  // Debug state for socket
  const [socketDebug, setSocketDebug] = useState<string>("initializing...");

  // Socket connection
  useEffect(() => {
    console.log("🔌 SOCKET EFFECT STARTED");
    console.log("user?.restaurantId:", user?.restaurantId);
    setSocketDebug("effect started");

    const token = api.getToken();
    console.log("token:", token ? "EXISTS" : "NULL");

    if (!token || !user?.restaurantId) {
      console.log("SOCKET: SKIPPED (no token or restaurantId)");
      setSocketDebug("skipped: no token/restaurantId");
      return;
    }

    console.log("SOCKET: CONNECTING...");
    setSocketDebug("connecting...");

    const cookId = user.id || user._id;

    console.log("=== SOCKET CONNECTING ===");
    console.log("API_URL:", API_URL);
    console.log("restaurantId:", user.restaurantId);
    console.log("cookId:", cookId);

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("✅ SOCKET: CONNECTED!");
      console.log("SOCKET: Emitting cook_connect with restaurantId:", user.restaurantId, "cookId:", cookId);
      setSocketDebug("CONNECTED!");
      setIsConnected(true);
      // Join cook room with cookId for filtered orders
      newSocket.emit("cook_connect", {
        restaurantId: user.restaurantId,
        cookId,
      });
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌❌❌ SOCKET: CONNECTION ERROR:", error.message);
      setSocketDebug("ERROR: " + error.message);
    });

    newSocket.on("disconnect", (reason) => {
      console.warn("⚠️ SOCKET: DISCONNECTED:", reason);
      setSocketDebug("disconnected: " + reason);
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
        itemsAddedToExisting?: boolean;
      }) => {
        console.log("🍽️🍽️🍽️ NEW_KITCHEN_ORDER EVENT RECEIVED 🍽️🍽️🍽️");
        console.log("Full data:", data);
        console.log("isNewOrder:", data.isNewOrder);
        console.log("itemsAddedToExisting:", data.itemsAddedToExisting);
        console.log("newItems:", data.newItems);
        console.log("newItems length:", data.newItems?.length);
        setSocketDebug("ORDER RECEIVED!");

        // Defensive check: ensure allOrders is an array
        if (data.allOrders && Array.isArray(data.allOrders)) {
          setItems(data.allOrders);
          calculateStats(data.allOrders);
        }

        // Play sound for ANY new_kitchen_order event (new order or items added)
        // Either newItems exists OR isNewOrder is true OR itemsAddedToExisting is true
        const shouldPlaySound =
          (data.newItems && data.newItems.length > 0) ||
          data.isNewOrder ||
          data.itemsAddedToExisting;

        console.log("🔔 Should play sound?", shouldPlaySound);

        if (shouldPlaySound) {
          const orderInfo = data.order || (data.allOrders && data.allOrders.length > 0 ? data.allOrders[data.allOrders.length - 1] : null);
          const tableName = orderInfo?.tableName || "Yangi buyurtma";

          console.log("🔔🔔🔔 PLAYING SOUND NOW! 🔔🔔🔔");

          // Play notification sound
          playNotificationSound();

          // Show push notification
          if (soundEnabled && data.newItems && data.newItems.length > 0) {
            notificationService.showNewOrderNotification(
              tableName,
              data.newItems.length,
              data.newItems as Array<{ foodName?: string; name?: string; quantity?: number }>
            );
          }
        }

        // Auto-print - yangi buyurtmalar uchun chek chiqarish
        const autoPrintEnabled = localStorage.getItem("autoPrint") !== "false";
        console.log("🖨️ AUTO-PRINT enabled:", autoPrintEnabled);

        // newItems mavjud bo'lsa printerga yuborish
        if (autoPrintEnabled && data.newItems && data.newItems.length > 0) {
          const orderInfo = data.order || (data.allOrders && data.allOrders.length > 0 ? data.allOrders[data.allOrders.length - 1] : null);
          const tableName = orderInfo?.tableName || "Noma'lum stol";
          const waiterName = orderInfo?.waiterName || "";

          console.log("🖨️ SENDING TO PRINTER");
          console.log("Table:", tableName, "Waiter:", waiterName);

          // Print server ga yuborish (printer server o'zi tanlangan printerni ishlatadi)
          PrinterAPI.printOrderDirect(
            tableName,
            waiterName,
            data.newItems as Array<{ foodName?: string; name?: string; quantity?: number }>
          ).then((result: { success: boolean; error?: string }) => {
            console.log("🖨️ PRINT RESULT:", result.success ? "✅ SUCCESS" : "❌ FAILED", result.error || "");
            setSocketDebug("PRINT: " + (result.success ? "SUCCESS" : "FAILED"));
          }).catch((err: Error) => {
            console.error("🖨️ PRINT ERROR:", err.message);
            setSocketDebug("PRINT ERROR: " + err.message);
          });
        } else {
          console.log("🖨️ PRINT SKIPPED:", !autoPrintEnabled ? "disabled" : "no newItems");
        }
      },
    );

    // Listen for kitchen orders updated
    newSocket.on("kitchen_orders_updated", (orders: FoodItem[]) => {
      console.log("📋 KITCHEN_ORDERS_UPDATED received, count:", orders?.length);
      // Defensive check: ensure orders is an array
      if (Array.isArray(orders)) {
        // Count total pending items
        const newPendingCount = orders.reduce((sum, order) => {
          return sum + (order.items?.filter(i => i.kitchenStatus === 'pending').length || 0);
        }, 0);

        const prevCount = prevItemsCountRef.current;
        console.log("📋 Pending items: prev=", prevCount, "new=", newPendingCount);

        // If new pending items appeared, play sound
        if (newPendingCount > prevCount && prevCount > 0) {
          console.log("🔔🔔🔔 NEW ITEMS DETECTED via kitchen_orders_updated! 🔔🔔🔔");
          playNotificationSound();
        }

        prevItemsCountRef.current = newPendingCount;
        setItems(orders);
        calculateStats(orders);
      } else {
        console.error('kitchen_orders_updated received non-array:', orders);
      }
    });

    // Shift events (smena)
    newSocket.on("shift:opened", (data: { shift: Shift }) => {
      console.log("Smena ochildi:", data);
      setActiveShift(data.shift);
    });

    newSocket.on("shift:closed", () => {
      console.log("Smena yopildi");
      setActiveShift(null);
    });

    newSocket.on("shift:updated", (data: { shift: Shift }) => {
      console.log("Smena yangilandi:", data);
      if (data.shift) {
        setActiveShift(data.shift);
      }
    });

    // Order bekor qilinganda (admin panel tomonidan)
    newSocket.on("order_cancelled", () => {
      console.log("Order cancelled event received");
      loadData();
    });

    // Order o'chirilganda
    newSocket.on("order_deleted", () => {
      console.log("Order deleted event received");
      loadData();
    });

    // Order yangilanganda (item cancel, update, va boshqalar)
    newSocket.on("order_updated", (data: { order?: FoodItem; action?: string }) => {
      console.log("Order updated event received:", data.action);
      loadData();
    });

    // Item bekor qilinganda (alohida event)
    newSocket.on("order_item_cancelled", (data: { order?: FoodItem; action?: string }) => {
      console.log("Order item cancelled event received:", data);
      loadData();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [
    user?.restaurantId,
    user?.id,
    user?._id,
    playNotificationSound,
    soundEnabled,
    calculateStats,
    autoPrintOrder,
    restaurant?.name,
    loadData,
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
        activeShift={activeShift}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <FoodItemsList
        items={items}
        onMarkReady={handleMarkReady}
        onRevertReady={handleRevertReady}
        removingItem={removingItem}
        isLoading={isLoading}
        requireDoubleConfirmation={user?.doubleConfirmation}
      />

      {/* Debug Info - Socket Status */}
      <div className="fixed top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded z-50 font-mono">
        Socket: {socketDebug}
      </div>

      {/* Sound & Notification Toggle */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        {/* Notification Permission Status */}
        {notificationPermission !== "granted" && (
          <button
            onClick={async () => {
              const permission = await notificationService.requestPermission();
              setNotificationPermission(permission);
            }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316]"
          >
            <BiBell className="text-lg" />
            <span>Bildirishnomaga ruxsat bering</span>
          </button>
        )}

        {/* Sound Toggle */}
        <button
          onClick={handleSoundToggle}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors
            ${
              soundEnabled
                ? "bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e]"
                : "bg-secondary border border-border text-muted-foreground"
            }`}
        >
          {soundEnabled ? (
            <>
              <BiVolumeFull className="text-lg" />
              <BiBell className="text-lg" />
            </>
          ) : (
            <>
              <BiVolumeMute className="text-lg" />
              <BiBellOff className="text-lg" />
            </>
          )}
          <span>{soundEnabled ? "Ovoz yoqilgan" : "Ovoz o'chirilgan"}</span>
        </button>

        {/* Test sound button */}
        <button
          onClick={() => {
            console.log("🔊 TEST BUTTON CLICKED");
            const testAudio = new Audio("/mixkit-positive-notification-951.wav");
            testAudio.volume = 1;
            testAudio.play()
              .then(() => console.log("🔊 TEST: Audio played!"))
              .catch(e => console.error("🔊 TEST ERROR:", e));
          }}
          className="px-4 py-3 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600"
        >
          🔊 Test Ovoz
        </button>
      </div>

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
