'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { FoodItem, Stats } from '@/types';
import { Header } from './Header';
import { FoodItemsList } from './FoodItemsList';
import { SettingsModal } from './SettingsModal';
import { BiVolumeFull, BiVolumeMute } from 'react-icons/bi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://kepket.kerek.uz';

export function Dashboard() {
  const { user, restaurant } = useAuth();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, ready: 0, cancelled: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Audio for notifications
  const [audio] = useState(() => {
    if (typeof window !== 'undefined') {
      const a = new Audio();
      a.src = 'https://kepket.kerek.uz/mixkit-positive-notification-951.wav';
      return a;
    }
    return null;
  });

  const calculateStats = useCallback((ordersList: FoodItem[]) => {
    let pending = 0;
    let ready = 0;
    let cancelled = 0;

    ordersList.forEach(order => {
      order.items.forEach(item => {
        if (item.isReady) {
          ready++;
        } else {
          pending++;
        }
      });
      if (order.status === 'cancelled') {
        cancelled++;
      }
    });

    setStats({ pending, ready, cancelled });
  }, []);

  const loadData = useCallback(async () => {
    try {
      if (!user?.restaurantId) return;
      const itemsData = await api.getFoodItems(user.restaurantId, user.id || user._id);
      setItems(itemsData);
      calculateStats(itemsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [calculateStats, user]);

  // Socket connection
  useEffect(() => {
    const token = api.getToken();
    if (!token || !user?.restaurantId) return;

    const cookId = user.id || user._id;

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      // Join cook room with cookId for filtered orders
      newSocket.emit('cook_connect', { restaurantId: user.restaurantId, cookId });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for new kitchen orders (filtered by cook's categories)
    newSocket.on('new_kitchen_order', async (data: { order: FoodItem; allOrders: FoodItem[]; isNewOrder: boolean }) => {
      if (data.allOrders) {
        setItems(data.allOrders);
        calculateStats(data.allOrders);
      }

      if (soundEnabled && data.isNewOrder) {
        audio?.play().catch(() => {});
      }
    });

    // Listen for kitchen orders updated
    newSocket.on('kitchen_orders_updated', (orders: FoodItem[]) => {
      setItems(orders);
      calculateStats(orders);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.restaurantId, user?.id, user?._id, audio, soundEnabled, calculateStats]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkReady = async (order: FoodItem, itemIndex: number) => {
    try {
      const { data: allOrders } = await api.markItemReady(order._id, itemIndex);
      setItems(allOrders);
      calculateStats(allOrders);
    } catch (error) {
      console.error('Failed to mark ready:', error);
      alert('Xatolik yuz berdi');
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto">
      <Header
        stats={stats}
        isConnected={isConnected}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <FoodItemsList
        items={items}
        onMarkReady={handleMarkReady}
      />

      {/* Sound Toggle */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors
          ${soundEnabled
            ? 'bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e]'
            : 'bg-secondary border border-border text-muted-foreground'
          }`}
      >
        {soundEnabled ? <BiVolumeFull className="text-lg" /> : <BiVolumeMute className="text-lg" />}
        <span>{soundEnabled ? 'Ovoz yoqilgan' : 'Ovoz o\'chirilgan'}</span>
      </button>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
