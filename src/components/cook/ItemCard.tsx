'use client';

import { useState } from 'react';
import { FoodItem, OrderItem } from '@/types';
import { BiTable, BiUser, BiTime, BiCheck, BiMinus, BiPlus, BiSend } from 'react-icons/bi';

interface ItemCardProps {
  order: FoodItem;
  item: OrderItem;
  itemIndex: number;
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
}

const getTimeDiff = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  return `${hours} soat oldin`;
};

export function ItemCard({ order, item, itemIndex, onMarkReady }: ItemCardProps) {
  // Qolgan miqdor (umumiy - tayyor qilingan)
  const alreadyReady = item.readyQuantity || 0;
  const remainingQuantity = item.quantity - alreadyReady;

  // Local state - nechta tayyor qilmoqchi
  const [pendingCount, setPendingCount] = useState(remainingQuantity);

  const isFullyReady = remainingQuantity <= 0;

  const handleDecrease = () => {
    if (pendingCount > 1) {
      setPendingCount(prev => prev - 1);
    }
  };

  const handleIncrease = () => {
    if (pendingCount < remainingQuantity) {
      setPendingCount(prev => prev + 1);
    }
  };

  const handleSubmit = () => {
    onMarkReady(order, itemIndex, pendingCount);
    // Reset to remaining after this submission
    const newRemaining = remainingQuantity - pendingCount;
    setPendingCount(newRemaining > 0 ? newRemaining : 0);
  };

  return (
    <div className={`bg-secondary rounded-xl border overflow-hidden transition-all hover:border-[#404040]
      ${isFullyReady ? 'border-[#22c55e]/30' : 'border-border'}`}
    >
      {/* Header with item name */}
      <div className="px-5 py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            {/* Qolgan miqdor badge */}
            <span className={`px-3 py-1 rounded-lg text-lg font-bold ${
              isFullyReady
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'bg-[#f97316] text-white'
            }`}>
              {remainingQuantity}x
            </span>
            <h3 className={`text-lg font-semibold ${isFullyReady ? 'text-[#22c55e]' : ''}`}>
              {item.foodName}
            </h3>
          </div>

          {/* Tayyor badge - agar qisman tayyor bo'lsa */}
          {alreadyReady > 0 && (
            <span className="py-1 px-3 bg-[#22c55e]/15 text-[#22c55e] rounded-lg text-sm font-medium">
              {alreadyReady} tayyor
            </span>
          )}
        </div>

        {/* +/- UI - faqat tayyor bo'lmaganda */}
        {!isFullyReady && (
          <div className="flex items-center justify-between gap-3 bg-background/50 rounded-lg p-3">
            {/* Minus button */}
            <button
              onClick={handleDecrease}
              disabled={pendingCount <= 1}
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold transition-all
                ${pendingCount <= 1
                  ? 'bg-[#262626] text-[#525252] cursor-not-allowed'
                  : 'bg-[#ef4444] text-white hover:bg-[#dc2626] active:scale-95'
                }`}
            >
              <BiMinus />
            </button>

            {/* Counter */}
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-foreground">{pendingCount}</span>
              <span className="text-muted-foreground text-sm ml-1">/ {remainingQuantity}</span>
            </div>

            {/* Plus button */}
            <button
              onClick={handleIncrease}
              disabled={pendingCount >= remainingQuantity}
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold transition-all
                ${pendingCount >= remainingQuantity
                  ? 'bg-[#262626] text-[#525252] cursor-not-allowed'
                  : 'bg-[#22c55e] text-white hover:bg-[#16a34a] active:scale-95'
                }`}
            >
              <BiPlus />
            </button>
          </div>
        )}

        {/* Submit button */}
        {!isFullyReady ? (
          <button
            onClick={handleSubmit}
            className="w-full mt-3 py-3 px-5 bg-[#22c55e] rounded-lg text-white text-base font-semibold flex items-center justify-center gap-2 hover:bg-[#16a34a] transition-all active:scale-[0.98]"
          >
            <BiSend className="text-xl" />
            {pendingCount}x Tayyor - Yuborish
          </button>
        ) : (
          <div className="mt-3 py-3 px-5 bg-[#22c55e]/15 text-[#22c55e] rounded-lg text-base font-semibold flex items-center justify-center gap-2">
            <BiCheck className="text-xl" />
            Hammasi tayyor!
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-5 py-3 flex items-center gap-4 text-sm text-muted-foreground border-t border-border">
        <div className="flex items-center gap-2">
          <BiTable className="text-[#3b82f6]" />
          <span>{order.tableName}</span>
        </div>
        {order.waiterName && (
          <div className="flex items-center gap-2">
            <BiUser className="text-muted-foreground" />
            <span>{order.waiterName}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <BiTime className="text-[#f97316]" />
          <span>{getTimeDiff(order.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
