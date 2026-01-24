'use client';

import { useState, useMemo } from 'react';
import { FoodItem, OrderItem, TabType } from '@/types';
import { ItemCard } from './ItemCard';
import { BiArchive } from 'react-icons/bi';

interface FoodItemsListProps {
  items: FoodItem[];
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
  onRevertReady: (order: FoodItem, itemIndex: number, revertCount: number) => void;
  removingItem: string | null;
  isLoading: boolean;
}

// Flat item structure for display
interface FlatItem {
  order: FoodItem;
  item: OrderItem;
  itemIndex: number;
}

export function FoodItemsList({ items, onMarkReady, onRevertReady, removingItem, isLoading }: FoodItemsListProps) {
  const [tab, setTab] = useState<TabType>('new');

  // Flatten all items from all orders
  const flatItems = useMemo(() => {
    const result: FlatItem[] = [];
    items.forEach(order => {
      order.items.forEach((item, index) => {
        // Use originalIndex if available (from filtered cook orders), otherwise use array index
        const actualIndex = item.originalIndex !== undefined ? item.originalIndex : index;
        result.push({
          order,
          item,
          itemIndex: actualIndex,
        });
      });
    });
    // Sort by order createdAt (oldest first)
    return result.sort((a, b) =>
      new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime()
    );
  }, [items]);

  // Filter items based on ready status
  // Qisman tayyor bo'lgan itemlar ham tayyorlanmoqda tabida ko'rinadi
  const pendingItems = flatItems.filter(f => {
    const readyQty = f.item.readyQuantity || 0;
    const remaining = f.item.quantity - readyQty;
    return remaining > 0; // Qolgan miqdor bor bo'lsa - hali tayyor emas
  });
  const readyItems = flatItems.filter(f => {
    const readyQty = f.item.readyQuantity || 0;
    return readyQty >= f.item.quantity; // Hammasi tayyor
  });
  const cancelledOrders = items.filter(order => order.status === 'cancelled');

  const filteredItems = tab === 'new'
    ? pendingItems
    : tab === 'ready'
      ? readyItems
      : [];

  const tabs = [
    { key: 'new' as TabType, label: 'Tayyorlanmoqda', count: pendingItems.length, color: 'text-[#f97316]' },
    { key: 'ready' as TabType, label: 'Tayyor', count: readyItems.length, color: 'text-[#22c55e]' },
    { key: 'cancelled' as TabType, label: 'Rad etilgan', count: cancelledOrders.length, color: 'text-[#ef4444]' },
  ];

  const isEmpty = tab === 'cancelled' ? cancelledOrders.length === 0 : filteredItems.length === 0;

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
            {tab === 'new' && 'Tayyorlanayotgan taom yo\'q'}
            {tab === 'ready' && 'Tayyor taomlar yo\'q'}
            {tab === 'cancelled' && 'Rad etilgan taomlar yo\'q'}
          </h3>
          <p className="text-[#71717a] text-sm">
            {tab === 'new' && 'Yangi buyurtmalar kelganda bu yerda ko\'rinadi'}
            {tab === 'ready' && 'Tayyor qilingan taomlar bu yerda ko\'rinadi'}
            {tab === 'cancelled' && 'Rad etilgan taomlar bu yerda ko\'rinadi'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((flatItem, index) => {
            const itemKey = `${flatItem.order._id}-${flatItem.itemIndex}`;
            const isRemoving = removingItem === itemKey;
            return (
              <ItemCard
                key={`${flatItem.order._id}-${flatItem.itemIndex}-${index}`}
                order={flatItem.order}
                item={flatItem.item}
                itemIndex={flatItem.itemIndex}
                onMarkReady={onMarkReady}
                onRevertReady={onRevertReady}
                isRemoving={isRemoving}
                isLoading={isLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
