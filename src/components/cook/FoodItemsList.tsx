'use client';

import { useState, useMemo } from 'react';
import { FoodItem, TabType } from '@/types';
import { OrderCard } from './OrderCard';
import { BiArchive } from 'react-icons/bi';

interface FoodItemsListProps {
  items: FoodItem[];
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
  onRevertReady: (order: FoodItem, itemIndex: number, revertCount: number) => void;
  removingItem: string | null;
  isLoading: boolean;
  requireDoubleConfirmation?: boolean;
}

export function FoodItemsList({
  items,
  onMarkReady,
  onRevertReady,
  removingItem,
  isLoading,
  requireDoubleConfirmation,
}: FoodItemsListProps) {
  const [tab, setTab] = useState<TabType>('new');

  // Orderlarni filterlash - har bir order o'z itemlari bilan
  const { preparingOrders, completedOrders, cancelledOrders } = useMemo(() => {
    const preparing: FoodItem[] = [];
    const completed: FoodItem[] = [];
    const cancelled: FoodItem[] = [];

    items.forEach(order => {
      if (order.status === 'cancelled') {
        cancelled.push(order);
        return;
      }

      // Bekor qilinmagan itemlarni olish
      const activeItems = order.items.filter(item => !item.isCancelled && item.kitchenStatus !== 'cancelled');

      // Barcha itemlar tayyor yoki served bo'lganini tekshirish (faqat active itemlar)
      const allItemsReady = activeItems.length > 0 && activeItems.every(item => {
        const readyQty = item.readyQuantity || 0;
        const isFullyReady = readyQty >= item.quantity;
        const isReadyStatus = item.kitchenStatus === 'ready' || item.kitchenStatus === 'served';
        return isFullyReady || isReadyStatus || item.isReady;
      });

      // Order status served/ready yoki barcha itemlar tayyor bo'lsa - tugatilganlar
      if (order.status === 'served' || order.status === 'ready' || allItemsReady) {
        completed.push(order);
        return;
      }

      // Aks holda - tayyorlanmoqda
      preparing.push({
        ...order,
        items: order.items,
      });
    });

    // Vaqt bo'yicha saralash - eng eski birinchi
    preparing.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    completed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { preparingOrders: preparing, completedOrders: completed, cancelledOrders: cancelled };
  }, [items]);

  // Tayyorlanayotgan itemlar soni (har bir orderdagi pending itemlar, cancelled itemlarni hisobga olmaymiz)
  const preparingItemsCount = preparingOrders.reduce((sum, order) => {
    return sum + order.items.filter(item => {
      // Cancelled itemlarni hisobga olmaymiz
      if (item.isCancelled || item.kitchenStatus === 'cancelled') return false;
      const readyQty = item.readyQuantity || 0;
      return item.quantity - readyQty > 0;
    }).length;
  }, 0);

  // Tugatilgan itemlar soni
  const completedItemsCount = completedOrders.reduce((sum, order) => sum + order.items.length, 0);

  const filteredOrders = tab === 'new'
    ? preparingOrders
    : tab === 'served'
      ? completedOrders
      : cancelledOrders;

  const tabs = [
    { key: 'new' as TabType, label: 'Tayyorlanmoqda', count: preparingItemsCount, orderCount: preparingOrders.length, color: 'text-[#f97316]' },
    { key: 'served' as TabType, label: 'Tugatilganlar', count: completedItemsCount, orderCount: completedOrders.length, color: 'text-[#22c55e]' },
    { key: 'cancelled' as TabType, label: 'Rad etilgan', count: cancelledOrders.length, orderCount: cancelledOrders.length, color: 'text-[#ef4444]' },
  ];

  const isEmpty = filteredOrders.length === 0;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 bg-secondary p-1 rounded-lg w-fit mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all
              ${tab === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {t.label}
            <span className={`px-2 py-0.5 rounded text-[11px] min-w-[24px] text-center font-semibold
              ${tab === t.key ? `bg-[#262626] ${t.color}` : 'bg-[#262626] text-muted-foreground'}`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center text-3xl text-[#71717a] mb-5">
            <BiArchive />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {tab === 'new' && 'Tayyorlanayotgan buyurtma yo\'q'}
            {tab === 'served' && 'Tugatilgan buyurtmalar yo\'q'}
            {tab === 'cancelled' && 'Rad etilgan buyurtmalar yo\'q'}
          </h3>
          <p className="text-[#71717a] text-sm">
            {tab === 'new' && 'Yangi buyurtmalar kelganda bu yerda ko\'rinadi'}
            {tab === 'served' && 'Yetkazib berilgan buyurtmalar bu yerda ko\'rinadi'}
            {tab === 'cancelled' && 'Rad etilgan buyurtmalar bu yerda ko\'rinadi'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              onMarkReady={onMarkReady}
              onRevertReady={onRevertReady}
              removingItem={removingItem}
              isLoading={isLoading}
              requireDoubleConfirmation={requireDoubleConfirmation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
