'use client';

import { useState, useMemo, useEffect } from 'react';
import { FoodItem, TabType } from '@/types';
import { OrderCard } from './OrderCard';
import { BiArchive, BiChevronLeft, BiChevronRight, BiTable } from 'react-icons/bi';

const ITEMS_PER_PAGE = 10;

interface FoodItemsListProps {
  items: FoodItem[];
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
  onRevertReady: (order: FoodItem, itemIndex: number, revertCount: number) => void;
  onStartItem?: (order: FoodItem, itemIndex: number) => Promise<void>;
  onMarkAllReady?: (order: FoodItem) => void;
  removingItem: string | null;
  isLoading: boolean;
  requireDoubleConfirmation?: boolean;
}

export function FoodItemsList({
  items,
  onMarkReady,
  onRevertReady,
  onStartItem,
  onMarkAllReady,
  removingItem,
  isLoading,
  requireDoubleConfirmation,
}: FoodItemsListProps) {
  const [tab, setTab] = useState<TabType>('new');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

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

      // Agar tayyor bo'lmagan item bo'lsa - doim tayyorlanmoqda tabiga
      if (!allItemsReady && activeItems.length > 0) {
        preparing.push({ ...order, items: order.items });
        return;
      }

      // Barcha itemlar tayyor bo'lsa - tugatilganlar
      if (order.status === 'served' || order.status === 'ready' || order.status === 'paid' || allItemsReady) {
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

  const tabOrders = tab === 'new'
    ? preparingOrders
    : tab === 'served'
      ? completedOrders
      : cancelledOrders;

  // Barcha orderlardan stollar ro'yxati (unikal) - tableName bo'yicha guruhlash
  const allTables = useMemo(() => {
    const tableMap = new Map<string, { tableName: string; count: number }>();
    items.forEach(order => {
      const key = order.tableName;
      if (tableMap.has(key)) {
        tableMap.get(key)!.count++;
      } else {
        tableMap.set(key, { tableName: key, count: 1 });
      }
    });
    return Array.from(tableMap.values()).sort((a, b) => a.tableName.localeCompare(b.tableName, undefined, { numeric: true }));
  }, [items]);

  // Stol bo'yicha filterlangan orderlar (tableName bo'yicha)
  const filteredOrders = selectedTable
    ? tabOrders.filter(order => order.tableName === selectedTable)
    : tabOrders;

  // Tab o'zgarganda sahifani 1-ga qaytarish
  useEffect(() => {
    setCurrentPage(1);
  }, [tab]);

  // Stol o'zgarganda sahifani 1-ga qaytarish
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTable]);

  // Pagination hisoblash
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Sahifa raqamini to'g'rilash (agar orderlar kamaysa)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const tabs = [
    { key: 'new' as TabType, label: 'Tayyorlanmoqda', count: preparingItemsCount, orderCount: preparingOrders.length, color: 'text-[#f97316]' },
    { key: 'served' as TabType, label: 'Tugatilganlar', count: completedItemsCount, orderCount: completedOrders.length, color: 'text-[#22c55e]' },
    { key: 'cancelled' as TabType, label: 'Rad etilgan', count: cancelledOrders.length, orderCount: cancelledOrders.length, color: 'text-[#ef4444]' },
  ];

  const isEmpty = filteredOrders.length === 0;

  return (
    <div>
      {/* Tabs va Pagination - space-between */}
      <div className="flex items-center justify-between mb-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-secondary p-1 rounded-lg w-fit">
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
                {t.orderCount}
              </span>
            </button>
          ))}
        </div>

        {/* Pagination - always show when there are orders */}
        {filteredOrders.length > 0 && (
          <div className="flex items-center gap-3">
            {/* Orders count */}
            <div className="px-4 py-2.5 bg-secondary rounded-lg text-sm text-muted-foreground">
              {filteredOrders.length} ta buyurtma
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`flex items-center justify-center gap-2 px-8 py-2.5 rounded-lg text-sm font-medium transition-all min-w-[140px]
                ${currentPage === 1
                  ? 'bg-secondary text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-secondary text-foreground hover:bg-[#262626]'
                }`}
            >
              <BiChevronLeft className="text-xl" />
              Oldingi
            </button>

            <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary rounded-lg min-w-[100px] justify-center">
              <span className="text-sm font-semibold text-foreground">{currentPage}</span>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-sm text-muted-foreground">{totalPages}</span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`flex items-center justify-center gap-2 px-8 py-2.5 rounded-lg text-sm font-medium transition-all min-w-[140px]
                ${currentPage === totalPages
                  ? 'bg-secondary text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-secondary text-foreground hover:bg-[#262626]'
                }`}
            >
              Keyingi
              <BiChevronRight className="text-xl" />
            </button>
          </div>
        )}
      </div>

      {/* Stollar - katakcha ko'rinishda */}
      {allTables.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <BiTable className="text-lg text-muted-foreground shrink-0" />
          <button
            onClick={() => setSelectedTable(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border shrink-0 whitespace-nowrap
              ${!selectedTable
                ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-[#3b82f6]/50'
              }`}
          >
            Barchasi ({items.length})
          </button>
          {allTables.map((table) => (
            <button
              key={table.tableName}
              onClick={() => setSelectedTable(selectedTable === table.tableName ? null : table.tableName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border shrink-0 whitespace-nowrap
                ${selectedTable === table.tableName
                  ? 'bg-[#f97316] text-white border-[#f97316]'
                  : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-[#f97316]/50'
                }`}
            >
              {table.tableName} ({table.count})
            </button>
          ))}
        </div>
      )}

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
          {paginatedOrders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              onMarkReady={onMarkReady}
              onRevertReady={onRevertReady}
              onStartItem={onStartItem}
              onMarkAllReady={onMarkAllReady}
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
