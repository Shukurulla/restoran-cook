"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { PrinterAPI } from "@/services/printer";
import { printQueue } from "@/services/print-queue";
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

  // Track printed orders to avoid duplicates (legacy - printQueue handles this now)
  const printedOrdersRef = useRef<Set<string>>(new Set());

  // 🔑 INITIAL LOAD FLAG - sahifa yangilanganida eski orderlar chop etilmasligi uchun
  // Bu ref faqat birinchi data yuklangandan keyin true bo'ladi
  // Shundan keyingina yangi orderlar chop etiladi
  const initialLoadCompleteRef = useRef<boolean>(false);

  // 📦 PREVIOUS ORDERS REF - yangi itemlarni aniqlash uchun
  // kitchen_orders_updated da fallback print uchun ishlatiladi
  const prevOrdersRef = useRef<Map<string, Set<string>>>(new Map());

  // 🔒 PRINT LOCK - new_kitchen_order print qilganda, kitchen_orders_updated skip qilish uchun
  // Bu ikki event bir vaqtda kelganda dublikat printni oldini oladi
  const printLockRef = useRef<boolean>(false);
  const printLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // ============================================
    // 🖨️ PRINTER LOGGING HELPER
    // ============================================
    const logPrinterData = (eventType: string, printData: Record<string, unknown>, willPrint: boolean) => {
      console.log("\n");
      console.log("╔══════════════════════════════════════════════════════════════╗");
      console.log(`║ 🖨️ PRINTER LOG - ${eventType.padEnd(43)}║`);
      console.log("╠══════════════════════════════════════════════════════════════╣");
      console.log("║ 📅 Vaqt:", new Date().toLocaleString("uz-UZ").padEnd(51) + "║");
      console.log("║ 📋 Event:", eventType.padEnd(51) + "║");
      console.log("║ 🖨️ Printer:", (localStorage.getItem("selectedPrinter") || "TANLANMAGAN").padEnd(48) + "║");
      console.log("║ ⚙️ Auto-print:", (localStorage.getItem("autoPrint") !== "false" ? "YOQILGAN ✅" : "O'CHIRILGAN ❌").padEnd(46) + "║");
      console.log("║ ⚙️ Print cancelled:", (localStorage.getItem("printCancelled") === "true" ? "YOQILGAN ✅" : "O'CHIRILGAN ❌").padEnd(41) + "║");
      console.log("║ 📤 Chop etiladi:", (willPrint ? "HA ✅" : "YO'Q ❌").padEnd(44) + "║");
      console.log("╠══════════════════════════════════════════════════════════════╣");
      console.log("║ 📦 PRINTERGA YUBORILADIGAN MA'LUMOT:                         ║");
      console.log("╚══════════════════════════════════════════════════════════════╝");
      console.log(JSON.stringify(printData, null, 2));
      console.log("════════════════════════════════════════════════════════════════\n");
    };

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
        console.log("\n🍽️🍽️🍽️ SOCKET EVENT: new_kitchen_order 🍽️🍽️🍽️");
        console.log("isNewOrder:", data.isNewOrder);
        console.log("itemsAddedToExisting:", data.itemsAddedToExisting);
        console.log("newItems count:", data.newItems?.length || 0);
        setSocketDebug("ORDER RECEIVED!");

        // Defensive check: ensure allOrders is an array
        if (data.allOrders && Array.isArray(data.allOrders)) {
          setItems(data.allOrders);
          calculateStats(data.allOrders);
        }

        // Play sound for ANY new_kitchen_order event
        const shouldPlaySound =
          (data.newItems && data.newItems.length > 0) ||
          data.isNewOrder ||
          data.itemsAddedToExisting;

        if (shouldPlaySound) {
          const orderInfo = data.order || (data.allOrders && data.allOrders.length > 0 ? data.allOrders[data.allOrders.length - 1] : null);
          const tableName = orderInfo?.tableName || "Yangi buyurtma";
          console.log("🔔 PLAYING SOUND - tableName:", tableName);
          playNotificationSound();

          if (data.newItems && data.newItems.length > 0) {
            notificationService.showNewOrderNotification(
              tableName,
              data.newItems.length,
              data.newItems as Array<{ foodName?: string; name?: string; quantity?: number }>
            );
          }
        }

        // Auto-print - yangi buyurtmalar uchun chek chiqarish
        const autoPrintEnabled = localStorage.getItem("autoPrint") !== "false";

        // 🔑 new_kitchen_order kelganda initialLoadCompleteRef ni true qilamiz
        // Bu kitchen_orders_updated da qayta ro'yxatdan o'tkazishni oldini oladi
        if (!initialLoadCompleteRef.current) {
          console.log("🔑 Setting initialLoadComplete = true (from new_kitchen_order)");
          initialLoadCompleteRef.current = true;
        }

        // 🖨️ Yangi itemlar bo'lsa va autoPrint yoqilgan bo'lsa, print qilish
        if (data.newItems && data.newItems.length > 0 && autoPrintEnabled) {
          // 🔒 LOCK - kitchen_orders_updated fallback ni bloklash
          printLockRef.current = true;
          if (printLockTimeoutRef.current) {
            clearTimeout(printLockTimeoutRef.current);
          }
          printLockTimeoutRef.current = setTimeout(() => {
            printLockRef.current = false;
            console.log("🔓 Print lock released");
          }, 2000); // 2 soniyadan keyin lock ochiladi

          const orderInfo = data.order || (data.allOrders && data.allOrders.length > 0 ? data.allOrders[data.allOrders.length - 1] : null);
          const orderId = orderInfo?._id || '';
          const tableName = orderInfo?.tableName || "Noma'lum stol";
          const waiterName = orderInfo?.waiterName || "";

          // PrintQueue ga itemlarni qo'shish (deduplication avtomatik)
          const itemsForQueue = data.newItems.map((item: Record<string, unknown>) => ({
            itemId: (item._id || '') as string,
            foodName: (item.foodName || item.name || "Noma'lum") as string,
            quantity: (item.quantity || 1) as number
          }));

          console.log("🔒 Print lock SET - blocking fallback for 2 seconds");
          const { added, skipped } = printQueue.addItems(orderId, tableName, waiterName, itemsForQueue);

          if (added > 0) {
            const printData = {
              type: "YANGI_BUYURTMA",
              tableName,
              waiterName,
              itemsAdded: added,
              itemsSkipped: skipped,
              timestamp: new Date().toISOString()
            };

            // 🖨️ LOG TO CONSOLE
            logPrinterData("YANGI BUYURTMA / ITEM QO'SHILDI", printData, autoPrintEnabled);
            console.log(`🖨️ [QUEUE] Added ${added} items, skipped ${skipped} duplicates`);
          } else {
            console.log("🖨️ ALL ITEMS ALREADY IN QUEUE - skipping");
          }
        } else if ((data.isNewOrder || data.itemsAddedToExisting) && autoPrintEnabled) {
          // 🔒 newItems yo'q, lekin yangi order/item bor - lock qo'yish
          // Bu kitchen_orders_updated ga print qilish imkonini beradi, lekin faqat bitta marta
          printLockRef.current = true;
          if (printLockTimeoutRef.current) {
            clearTimeout(printLockTimeoutRef.current);
          }
          printLockTimeoutRef.current = setTimeout(() => {
            printLockRef.current = false;
            console.log("🔓 Print lock released (no newItems case)");
          }, 500); // 0.5 soniya - fallback ishlashi uchun
          console.log("🔒 Print lock SET (no newItems) - fallback will handle");
        }
      },
    );

    // Listen for kitchen orders updated
    // 🖨️ FALLBACK PRINT - new_kitchen_order kelmasa, bu handler yangi itemlarni aniqlaydi va print qiladi
    newSocket.on("kitchen_orders_updated", (orders: FoodItem[]) => {
      console.log("\n📋📋📋 SOCKET EVENT: kitchen_orders_updated 📋📋📋");
      console.log("Orders count:", orders?.length);
      console.log("Initial load complete:", initialLoadCompleteRef.current);

      // Defensive check: ensure orders is an array
      if (Array.isArray(orders)) {
        // 🔑 INITIAL LOAD - birinchi data kelganda flag ni true qilamiz
        if (!initialLoadCompleteRef.current) {
          console.log("🔑 INITIAL LOAD COMPLETE - keyingi yangi orderlar chop etiladi");
          initialLoadCompleteRef.current = true;

          // PrintQueue ga mavjud itemlarni ro'yxatdan o'tkazish
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ordersForQueue = orders.map(order => ({
            _id: order._id,
            items: (order.items || []).map((item: any, idx: number) => ({
              _id: item._id || `idx-${idx}`,
              foodName: item.foodName,
              quantity: item.quantity,
              kitchenStatus: item.kitchenStatus
            }))
          }));

          const registeredCount = printQueue.registerExistingItems(ordersForQueue);
          console.log("🔑 Registered", registeredCount, "existing items to prevent re-printing");

          // 📦 prevOrdersRef ni yangilash (har bir order uchun item ID lar)
          const newPrevOrders = new Map<string, Set<string>>();
          orders.forEach(order => {
            const itemIds = new Set<string>();
            (order.items || []).forEach((item: { _id?: string; foodName?: string }, idx: number) => {
              // Unique key: itemId + foodName
              const itemKey = `${item._id || `idx-${idx}`}-${item.foodName || ''}`;
              itemIds.add(itemKey);
            });
            newPrevOrders.set(order._id, itemIds);
          });
          prevOrdersRef.current = newPrevOrders;

          setItems(orders);
          calculateStats(orders);
          return; // Early return - birinchi yuklashda chop etmaymiz
        }

        // ======================================================
        // 🖨️ FALLBACK PRINT LOGIC - yangi itemlarni aniqlash
        // new_kitchen_order kelmasa ham, bu yerda yangi itemlarni topamiz
        // ======================================================
        const autoPrintEnabled = localStorage.getItem("autoPrint") !== "false";

        // 🔒 LOCK CHECK - agar new_kitchen_order allaqachon print qilgan bo'lsa, skip
        if (printLockRef.current) {
          console.log("🔒 FALLBACK BLOCKED - new_kitchen_order already handled print");
          // State yangilash, lekin print qilmaslik
          setItems(orders);
          calculateStats(orders);

          // prevOrdersRef ni yangilash
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
          return;
        }

        if (autoPrintEnabled) {
          // Yangi itemlarni aniqlash
          const newItemsToPrint: Array<{
            orderId: string;
            tableName: string;
            waiterName: string;
            items: Array<{ itemId: string; foodName: string; quantity: number }>;
          }> = [];

          orders.forEach(order => {
            const prevItemIds = prevOrdersRef.current.get(order._id) || new Set<string>();
            const newItems: Array<{ itemId: string; foodName: string; quantity: number }> = [];

            (order.items || []).forEach((item: { _id?: string; foodName?: string; quantity?: number; kitchenStatus?: string }, idx: number) => {
              const itemKey = `${item._id || `idx-${idx}`}-${item.foodName || ''}`;

              // Yangi itemlarni olish - faqat tayyor/bekor qilinganlarni CHIQARIB TASHLASH
              // kitchenStatus undefined, 'pending', yoki 'preparing' bo'lsa - print qilish
              const isCompletedOrCancelled =
                item.kitchenStatus === 'ready' ||
                item.kitchenStatus === 'served' ||
                item.kitchenStatus === 'cancelled';

              if (!prevItemIds.has(itemKey) && !isCompletedOrCancelled) {
                newItems.push({
                  itemId: item._id || `idx-${idx}`,
                  foodName: item.foodName || "Noma'lum",
                  quantity: item.quantity || 1
                });
              }
            });

            if (newItems.length > 0) {
              newItemsToPrint.push({
                orderId: order._id,
                tableName: order.tableName,
                waiterName: order.waiterName || '',
                items: newItems
              });
            }
          });

          // Agar yangi itemlar bo'lsa - print qilish va ovoz chiqarish
          if (newItemsToPrint.length > 0) {
            console.log("🖨️ FALLBACK: Yangi itemlar aniqlandi!", newItemsToPrint);

            // 🔔 Ovoz chiqarish
            playNotificationSound();

            // 🖨️ Har bir order uchun print qilish
            newItemsToPrint.forEach(orderToPrint => {
              const { added, skipped } = printQueue.addItems(
                orderToPrint.orderId,
                orderToPrint.tableName,
                orderToPrint.waiterName,
                orderToPrint.items
              );

              if (added > 0) {
                console.log(`🖨️ [FALLBACK] Added ${added} items to queue, skipped ${skipped} duplicates`);

                // Browser notification
                notificationService.showNewOrderNotification(
                  orderToPrint.tableName,
                  added,
                  orderToPrint.items.map(i => ({ foodName: i.foodName, quantity: i.quantity }))
                );

                // Console log
                logPrinterData("FALLBACK - YANGI BUYURTMA", {
                  type: "FALLBACK_PRINT",
                  tableName: orderToPrint.tableName,
                  waiterName: orderToPrint.waiterName,
                  itemsAdded: added,
                  itemsSkipped: skipped,
                  items: orderToPrint.items,
                  timestamp: new Date().toISOString()
                }, true);
              }
            });
          }
        }

        // 📦 prevOrdersRef ni yangilash (keyingi compare uchun)
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

        // State yangilash
        setItems(orders);
        calculateStats(orders);

        console.log("📋 State updated with fallback print check");
      } else {
        console.error('kitchen_orders_updated received non-array:', orders);
      }
    });

    // Shift events (smena)
    newSocket.on("shift:opened", (data: { shift: Shift }) => {
      console.log("Smena ochildi:", data);
      setActiveShift(data.shift);

      // 🔑 Yangi smena - print cache ni tozalash va initial load flag ni reset qilish
      printQueue.clearCache();
      initialLoadCompleteRef.current = false;
      console.log("🔑 Print cache cleared for new shift");

      // Yangi smena ID si bilan ma'lumotlarni yuklash - 0 dan boshlaydi
      loadData(data.shift?._id);
    });

    newSocket.on("shift:closed", () => {
      console.log("Smena yopildi");
      setActiveShift(null);

      // 🔑 Smena yopilganda cache tozalash
      printQueue.clearCache();
      initialLoadCompleteRef.current = false;
      console.log("🔑 Print cache cleared - shift closed");

      // Smena yopilganda ma'lumotlarni tozalash
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

    // Order bekor qilinganda (admin panel tomonidan)
    // 🔑 Faqat bu cook ning kategoriyalariga tegishli itemlarni print qilish
    newSocket.on("order_cancelled", (data: { order?: FoodItem; orderId?: string; tableName?: string; items?: Array<{ foodName?: string; name?: string; quantity?: number; category?: string }> }) => {
      console.log("\n❌❌❌ SOCKET EVENT: order_cancelled ❌❌❌");

      const printCancelledEnabled = localStorage.getItem("printCancelled") === "true";
      const tableName = data.order?.tableName || data.tableName || "Noma'lum";
      const allCancelledItems = data.order?.items || data.items || [];

      // 🔑 Faqat bu cook ning kategoriyalariga tegishli itemlarni filtrlash
      const userCategories = user?.assignedCategories || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cancelledItems = allCancelledItems.filter((item: any) => {
        // Agar user ning kategoriyalari bo'lmasa, hech narsa print qilmaymiz
        if (userCategories.length === 0) return false;
        // Item kategoriyasi user ning kategoriyalarida bormi
        const itemCategory = item.category || item.categoryId;
        return itemCategory && userCategories.includes(itemCategory);
      });

      console.log(`🔑 User categories: ${userCategories.join(', ')}`);
      console.log(`🔑 Filtered cancelled items: ${cancelledItems.length} / ${allCancelledItems.length}`);

      // Agar bu cook uchun tegishli item bo'lmasa, print qilmaymiz
      if (cancelledItems.length === 0) {
        console.log("🔑 No items for this cook's categories - skipping print");
        loadData();
        return;
      }

      const printData = {
        type: "ORDER_BEKOR_QILINDI",
        tableName,
        orderId: data.order?._id || data.orderId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: cancelledItems.map((item: any) => ({
          foodName: item.foodName || item.name || "Noma'lum",
          quantity: item.quantity || 1
        })),
        timestamp: new Date().toISOString()
      };

      // 🖨️ LOG TO CONSOLE
      logPrinterData("ORDER BEKOR QILINDI", printData, printCancelledEnabled);

      if (printCancelledEnabled) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cancelledItems.forEach((item: any) => {
          PrinterAPI.printCancelled({
            tableName,
            foodName: item.foodName || item.name || "Noma'lum",
            quantity: item.quantity || 1
          }).then((result: { success: boolean; error?: string }) => {
            console.log("🖨️ CANCELLED PRINT:", result.success ? "✅" : "❌", result.error || "");
          });
        });
      }

      loadData();
    });

    // Order o'chirilganda
    newSocket.on("order_deleted", (data: { orderId?: string; tableName?: string }) => {
      console.log("\n🗑️🗑️🗑️ SOCKET EVENT: order_deleted 🗑️🗑️🗑️");

      const printData = {
        type: "ORDER_O'CHIRILDI",
        orderId: data.orderId,
        tableName: data.tableName,
        timestamp: new Date().toISOString()
      };

      // 🖨️ LOG TO CONSOLE (deleted orders usually don't print)
      logPrinterData("ORDER O'CHIRILDI", printData, false);

      loadData();
    });

    // Order yangilanganda (item cancel, update, va boshqalar)
    newSocket.on("order_updated", (data: { order?: FoodItem; action?: string; updatedItems?: Array<{ foodName?: string; name?: string; quantity?: number }> }) => {
      console.log("\n🔄🔄🔄 SOCKET EVENT: order_updated 🔄🔄🔄");
      console.log("Action:", data.action);

      const printData = {
        type: "ORDER_YANGILANDI",
        action: data.action,
        tableName: data.order?.tableName,
        orderId: data.order?._id,
        updatedItems: data.updatedItems,
        timestamp: new Date().toISOString()
      };

      // 🖨️ LOG TO CONSOLE
      logPrinterData("ORDER YANGILANDI", printData, false);

      loadData();
    });

    // Item bekor qilinganda (alohida event)
    // 🔑 Faqat bu cook ning kategoriyalariga tegishli itemlarni print qilish
    newSocket.on("order_item_cancelled", (data: {
      order?: FoodItem;
      orderId?: string;
      tableName?: string;
      cancelledItem?: { foodName?: string; name?: string; quantity?: number; reason?: string; categoryId?: string; categoryName?: string };
      action?: string
    }) => {
      console.log("\n🚫🚫🚫 SOCKET EVENT: order_item_cancelled 🚫🚫🚫");

      const printCancelledEnabled = localStorage.getItem("printCancelled") === "true";
      const tableName = data.order?.tableName || data.tableName || "Noma'lum";
      const cancelledItem = data.cancelledItem;

      // 🔑 Kategoriya tekshiruvi - bu cook uchun tegishlimi?
      const userCategories = user?.assignedCategories || [];
      const itemCategory = cancelledItem?.categoryId;
      const isForThisCook = userCategories.length > 0 && itemCategory && userCategories.includes(itemCategory);

      console.log(`🔑 User categories: ${userCategories.join(', ')}`);
      console.log(`🔑 Cancelled item category: ${itemCategory}`);
      console.log(`🔑 Is for this cook: ${isForThisCook}`);

      // Agar bu cook uchun tegishli bo'lmasa, print qilmaymiz
      if (!isForThisCook) {
        console.log("🔑 Item not for this cook's categories - skipping print");
        loadData();
        return;
      }

      const printData = {
        type: "ITEM_BEKOR_QILINDI",
        tableName,
        orderId: data.order?._id || data.orderId,
        cancelledItem: cancelledItem ? {
          foodName: cancelledItem.foodName || cancelledItem.name || "Noma'lum",
          quantity: cancelledItem.quantity || 1,
          reason: cancelledItem.reason || "Sabab ko'rsatilmagan"
        } : null,
        timestamp: new Date().toISOString()
      };

      // 🖨️ LOG TO CONSOLE
      logPrinterData("ITEM BEKOR QILINDI", printData, printCancelledEnabled && !!cancelledItem);

      if (printCancelledEnabled && cancelledItem) {
        PrinterAPI.printCancelled({
          tableName,
          foodName: cancelledItem.foodName || cancelledItem.name || "Noma'lum",
          quantity: cancelledItem.quantity || 1
        }).then((result: { success: boolean; error?: string }) => {
          console.log("🖨️ CANCELLED ITEM PRINT:", result.success ? "✅" : "❌", result.error || "");
        });
      }

      loadData();
    });

    // Order to'langanda - tugatilganlar tabida qolishi uchun
    newSocket.on("order_paid", (data: { order?: FoodItem; orderId?: string; tableName?: string }) => {
      console.log("\n💰💰💰 SOCKET EVENT: order_paid 💰💰💰");

      const printData = {
        type: "ORDER_TO'LANDI",
        tableName: data.order?.tableName || data.tableName,
        orderId: data.order?._id || data.orderId,
        timestamp: new Date().toISOString()
      };

      // 🖨️ LOG TO CONSOLE (paid orders don't need kitchen print)
      logPrinterData("ORDER TO'LANDI", printData, false);

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
