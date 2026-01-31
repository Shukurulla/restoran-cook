"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { notificationService } from "@/services/notification";
import { FoodItem, Stats, Shift } from "@/types";
import { Header } from "./Header";
import { FoodItemsList } from "./FoodItemsList";
import { SettingsModal } from "./SettingsModal";
import { BiVolumeFull } from "react-icons/bi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://server-v2.kepket.uz";


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
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);


  // Animatsiya uchun - qaysi item o'chirilmoqda
  const [removingItem, setRemovingItem] = useState<string | null>(null);

  // Loading state - tugmalarni disable qilish uchun
  const [isLoading, setIsLoading] = useState(false);

  // 🔑 INITIAL LOAD FLAG - sahifa yangilanganida
  const initialLoadCompleteRef = useRef<boolean>(false);

  // 📦 PREVIOUS ORDERS REF - yangi itemlarni aniqlash uchun
  const prevOrdersRef = useRef<Map<string, Set<string>>>(new Map());

  // Audio ref - professional approach
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  // Initialize audio on mount - tanlangan ringtoneni ishlatish
  useEffect(() => {
    if (typeof window !== "undefined") {
      const selectedRingtone = localStorage.getItem("selectedRingtone") || "/mixkit-positive-notification-951.wav";
      audioRef.current = new Audio(selectedRingtone);
      audioRef.current.preload = "auto";
      console.log("🔊 Audio initialized with:", selectedRingtone);
    }
  }, []);

  // Function to play notification sound (ovoz doim yoqilgan)
  const playNotificationSound = useCallback(() => {
    // Tanlangan ringtoneni olish
    const selectedRingtone = localStorage.getItem("selectedRingtone") || "/mixkit-positive-notification-951.wav";

    // Agar ringtone o'zgargan bo'lsa, yangi audio yaratish
    if (audioRef.current?.src !== window.location.origin + selectedRingtone) {
      audioRef.current = new Audio(selectedRingtone);
    }

    const audio = audioRef.current;
    if (!audio) {
      console.log("🔊 Sound skipped - no audio element");
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
          if (error.name === "NotAllowedError") {
            console.log("🔊 Audio blocked - need user interaction first");
          }
        });
    }
  }, []);

  // Simple debug useEffect
  useEffect(() => {
    console.warn(">>> TEST USEEFFECT <<<");
    console.warn(">>> user?.restaurantId:", user?.restaurantId);
    console.warn(">>> api.getToken():", api.getToken() ? "EXISTS" : "NULL");

    if (user?.restaurantId && api.getToken()) {
      console.warn(">>> SOCKET SHOULD CONNECT NOW <<<");
    }
  }, [user?.restaurantId]);

  // Request notification permission on page load
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (notificationService.isSupported()) {
        const permission = await notificationService.requestPermission();
        console.log("Notification permission:", permission);
      }
    };
    requestNotificationPermission();
  }, []);

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

  const loadData = useCallback(async (shiftId?: string) => {
    try {
      if (!user?.restaurantId) return;

      // Agar shiftId berilmagan bo'lsa, avval aktiv smenani olamiz
      let currentShiftId = shiftId;
      let shiftData: Shift | null = null;

      if (!currentShiftId) {
        shiftData = await api.getActiveShift();
        currentShiftId = shiftData?._id;
        setActiveShift(shiftData);
      }

      // ShiftId bo'yicha orderlarni olish
      const itemsData = await api.getAllItems(
        user.restaurantId,
        user.id || user._id,
        currentShiftId
      );
      setItems(itemsData);
      calculateStats(itemsData);
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

    newSocket.on("connect", async () => {
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
      (data: {
        order: FoodItem | null;
        allOrders: FoodItem[];
        isNewOrder: boolean;
        newItems?: Array<Record<string, unknown>>;
        itemsAddedToExisting?: boolean;
      }) => {
        console.log("🍽️ SOCKET: new_kitchen_order");
        setSocketDebug("ORDER RECEIVED!");

        // Update state
        if (data.allOrders && Array.isArray(data.allOrders)) {
          setItems(data.allOrders);
          calculateStats(data.allOrders);
        }

        // Play sound for new orders
        const shouldPlaySound =
          (data.newItems && data.newItems.length > 0) ||
          data.isNewOrder ||
          data.itemsAddedToExisting;

        if (shouldPlaySound) {
          const orderInfo = data.order || (data.allOrders && data.allOrders.length > 0 ? data.allOrders[data.allOrders.length - 1] : null);
          const tableName = orderInfo?.tableName || "Yangi buyurtma";
          playNotificationSound();

          if (data.newItems && data.newItems.length > 0) {
            notificationService.showNewOrderNotification(
              tableName,
              data.newItems.length,
              data.newItems as Array<{ foodName?: string; name?: string; quantity?: number }>
            );
          }
        }

        if (!initialLoadCompleteRef.current) {
          initialLoadCompleteRef.current = true;
        }
      },
    );

    // Listen for kitchen orders updated
    newSocket.on("kitchen_orders_updated", (orders: FoodItem[]) => {
      console.log("📋 SOCKET: kitchen_orders_updated, count:", orders?.length);

      if (Array.isArray(orders)) {
        if (!initialLoadCompleteRef.current) {
          initialLoadCompleteRef.current = true;
        }

        // Update prevOrdersRef for tracking
        const newPrevOrders = new Map<string, Set<string>>();
        orders.forEach(order => {
          const itemIds = new Set<string>();
          (order.items || []).forEach((item: { _id?: string; foodName?: string }, idx: number) => {
            const itemKey = `${item._id || `idx-${idx}`}-${item.foodName || ''}`;
            itemIds.add(itemKey);
          });
          newPrevOrders.set(order._id, itemIds);
        });
        prevOrdersRef.current = newPrevOrders;

        setItems(orders);
        calculateStats(orders);
      }
    });

    // Shift events (smena)
    newSocket.on("shift:opened", (data: { shift: Shift }) => {
      console.log("Smena ochildi:", data);
      setActiveShift(data.shift);
      initialLoadCompleteRef.current = false;
      loadData(data.shift?._id);
    });

    newSocket.on("shift:closed", () => {
      console.log("Smena yopildi");
      setActiveShift(null);
      initialLoadCompleteRef.current = false;
      setItems([]);
      setStats({
        pending: 0,
        ready: 0,
        served: 0,
        cancelled: 0,
      });
    });

    newSocket.on("shift:updated", (data: { shift: Shift }) => {
      console.log("Smena yangilandi:", data);
      if (data.shift) {
        setActiveShift(data.shift);
      }
    });

    // Order bekor qilinganda
    newSocket.on("order_cancelled", () => {
      console.log("❌ SOCKET: order_cancelled");
      loadData();
    });

    // Order o'chirilganda
    newSocket.on("order_deleted", () => {
      console.log("🗑️ SOCKET: order_deleted");
      loadData();
    });

    // Order yangilanganda
    newSocket.on("order_updated", () => {
      console.log("🔄 SOCKET: order_updated");
      loadData();
    });

    // Item bekor qilinganda
    newSocket.on("order_item_cancelled", () => {
      console.log("🚫 SOCKET: order_item_cancelled");
      loadData();
    });

    // Order to'langanda
    newSocket.on("order_paid", () => {
      console.log("💰 SOCKET: order_paid");
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
    calculateStats,
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

      if (readyCount !== undefined) {
        // Qisman tayyor qilish - API orqali (kutmasdan)
        api.markItemPartialReady(order._id, itemIndex, readyCount, cookId)
          .then(({ data: allOrders }) => {
            setItems(allOrders);
            calculateStats(allOrders);
          })
          .catch(err => console.error("Mark ready error:", err));
      } else {
        // Eski usul - to'liq tayyor/tayyor emas qilish
        api.markItemReady(order._id, itemIndex)
          .then(({ data: allOrders }) => {
            setItems(allOrders);
            calculateStats(allOrders);
          })
          .catch(err => console.error("Mark ready error:", err));
      }

      // Darhol loading ni to'xtatish - foydalanuvchi kutmaydi
      setRemovingItem(null);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to mark ready:", error);
      setRemovingItem(null);
      setIsLoading(false);
    }
  };

  const handleRevertReady = async (order: FoodItem, itemIndex: number, revertCount: number) => {
    // Agar allaqachon loading bo'lsa, hech narsa qilmaymiz
    if (isLoading) return;

    try {
      setIsLoading(true);
      const cookId = user?.id || user?._id;

      // Revert - kutmasdan background da bajarish
      api.revertItemReady(order._id, itemIndex, revertCount, cookId)
        .then(({ data: allOrders }) => {
          setItems(allOrders);
          calculateStats(allOrders);
        })
        .catch(err => console.error("Revert ready error:", err));

      // Darhol loading ni to'xtatish - foydalanuvchi kutmaydi
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to revert ready:", error);
      setIsLoading(false);
    }
  };

  // Tayyorlashni boshlash - "Boshlandi" tugmasi bosilganda
  const handleStartItem = async (order: FoodItem, itemIndex: number) => {
    try {
      const { data: allOrders } = await api.startItem(order._id, itemIndex);
      setItems(allOrders);
      calculateStats(allOrders);
    } catch (error) {
      console.error("Failed to start item:", error);
      alert("Xatolik yuz berdi");
    }
  };

  // Barcha itemlarni tayyor qilish - "Barchasi tayyor" tugmasi
  const handleMarkAllReady = async (order: FoodItem) => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      // Tayyor bo'lmagan itemlarni yig'ish
      const promises: Promise<unknown>[] = [];

      for (const item of order.items) {
        // Bekor qilingan itemlarni o'tkazib yuborish
        if (item.isCancelled || item.kitchenStatus === 'cancelled') continue;

        const alreadyReady = item.readyQuantity || 0;
        const remainingQuantity = item.quantity - alreadyReady;

        // Faqat tayyor bo'lmagan itemlarni
        if (remainingQuantity > 0) {
          const actualIndex = item.originalIndex !== undefined ? item.originalIndex : order.items.indexOf(item);
          // Promise'ni to'plamga qo'shish (await qilmasdan)
          promises.push(api.markItemPartialReady(order._id, actualIndex, remainingQuantity, user?.id || user?._id));
        }
      }

      // Barcha so'rovlarni parallel yuborish
      await Promise.all(promises);

      // Oxirgi holatni olish
      const restaurant = api.getStoredRestaurant();
      const allOrders = await api.getAllItems(restaurant?.id || restaurant?._id || '');
      setItems(allOrders);
      calculateStats(allOrders);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to mark all ready:", error);
      setIsLoading(false);
      alert("Xatolik yuz berdi");
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto bg-[#000]">
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
        onStartItem={handleStartItem}
        onMarkAllReady={handleMarkAllReady}
        removingItem={removingItem}
        isLoading={isLoading}
        requireDoubleConfirmation={user?.doubleConfirmation}
      />

      {/* Debug Info - Socket Status */}
      <div className="fixed top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded z-50 font-mono">
        Socket: {socketDebug}
      </div>

      {/* Test Sound Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => {
            console.log("🔊 TEST BUTTON CLICKED");
            // Tanlangan ringtoneni ishlatish
            const selectedRingtone = localStorage.getItem("selectedRingtone") || "/mixkit-positive-notification-951.wav";
            const testAudio = new Audio(selectedRingtone);
            testAudio.volume = 1;
            testAudio.play()
              .then(() => console.log("🔊 TEST: Audio played!"))
              .catch(e => console.error("🔊 TEST ERROR:", e));
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          <BiVolumeFull className="text-lg" />
          Test ovoz
        </button>
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

    </div>
  );
}
