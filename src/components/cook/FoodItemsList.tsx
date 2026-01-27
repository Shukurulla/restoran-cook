'use client';

import { useState, useMemo, useEffect } from 'react';
import { FoodItem } from '@/types';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Barcha orderlarni vaqt bo'yicha saralash - eng eski birinchi
  const sortedOrders = useMemo(() => {
    return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [items]);

  // Barcha orderlardan stollar ro'yxati (unikal)
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

  // Stol bo'yicha filterlangan orderlar
  const filteredOrders = selectedTable
    ? sortedOrders.filter(order => order.tableName === selectedTable)
    : sortedOrders;

  // Stol o'zgarganda sahifani 1-ga qaytarish
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTable]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Sahifa raqamini to'g'rilash
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const isEmpty = filteredOrders.length === 0;

  return (
    <div>
      {/* Header: buyurtmalar soni va pagination */}
      <div className="flex items-center justify-between mb-4">
        <div className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium">
          {filteredOrders.length} ta buyurtma
        </div>

        {filteredOrders.length > ITEMS_PER_PAGE && (
          <div className="flex items-center gap-3">
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

      {/* Stollar filtri */}
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
          <h3 className="text-lg font-semibold mb-2">Buyurtmalar yo&apos;q</h3>
          <p className="text-[#71717a] text-sm">Yangi buyurtmalar kelganda bu yerda ko&apos;rinadi</p>
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
