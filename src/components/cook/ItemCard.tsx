'use client';

import { useState, useEffect } from 'react';
import { FoodItem, OrderItem } from '@/types';
import { BiTable, BiUser, BiTime, BiCheck, BiMinus, BiPlus, BiSend, BiCheckDouble, BiUndo } from 'react-icons/bi';

interface ItemCardProps {
  order: FoodItem;
  item: OrderItem;
  itemIndex: number;
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
  onRevertReady: (order: FoodItem, itemIndex: number, revertCount: number) => void;
  isRemoving?: boolean;
}

const getTimeDiff = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} soat oldin`;
  return `${hours} soat ${remainingMinutes} daqiqa oldin`;
};

export function ItemCard({ order, item, itemIndex, onMarkReady, onRevertReady, isRemoving }: ItemCardProps) {
  // Qolgan miqdor (umumiy - tayyor qilingan)
  const alreadyReady = item.readyQuantity || 0;
  const remainingQuantity = item.quantity - alreadyReady;

  // Local state - 1 dan boshlab ko'paytirib boradi
  const [pendingCount, setPendingCount] = useState(1);

  // Vaqt ko'rsatkichi - dinamik yangilanadi
  const [timeDiff, setTimeDiff] = useState(() => getTimeDiff(order.createdAt));

  // Har 30 sekundda vaqtni yangilash
  useEffect(() => {
    const updateTime = () => setTimeDiff(getTimeDiff(order.createdAt));
    updateTime(); // Darhol yangilash
    const interval = setInterval(updateTime, 30000); // Har 30 sekundda
    return () => clearInterval(interval);
  }, [order.createdAt]);

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
    // Reset to 1 for next time
    setPendingCount(1);
  };

  // Barchasi tayyor - qolgan hammasi
  const handleAllReady = () => {
    onMarkReady(order, itemIndex, remainingQuantity);
    setPendingCount(1);
  };

  // Ortga qaytarish - tayyor qilinganlarni qaytarish
  const handleRevert = () => {
    onRevertReady(order, itemIndex, item.quantity); // Hammasini qaytarish
  };

  return (
    <div className={`bg-secondary rounded-xl border overflow-hidden transition-all hover:border-[#404040]
      ${isFullyReady ? 'border-[#22c55e]/30' : 'border-border'}
      ${isRemoving ? 'opacity-50 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
      style={{ transition: 'opacity 0.3s ease-out, transform 0.3s ease-out' }}
    >
      {/* Header with item name */}
      <div className="px-5 py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            {/* Miqdor badge - tayyor bo'lganda umumiy sonni, aks holda qolganini ko'rsatish */}
            <span className={`px-3 py-1 rounded-lg text-lg font-bold ${
              isFullyReady
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'bg-[#f97316] text-white'
            }`}>
              {isFullyReady ? item.quantity : remainingQuantity}x
            </span>
            <h3 className={`text-lg font-semibold ${isFullyReady ? 'text-[#22c55e]' : ''}`}>
              {item.foodName}
            </h3>
          </div>

          {/* Tayyor badge - agar qisman tayyor bo'lsa (lekin to'liq emas) */}
          {alreadyReady > 0 && !isFullyReady && (
            <span className="py-1 px-3 bg-[#22c55e]/15 text-[#22c55e] rounded-lg text-sm font-medium">
              {alreadyReady} tayyor
            </span>
          )}
        </div>

        {/* +/- UI - faqat tayyor bo'lmaganda */}
        {!isFullyReady && (
          <>
            {/* Buttons row - - + va Yuborish */}
            <div className="flex gap-2">
              {/* Minus button */}
              <button
                onClick={handleDecrease}
                disabled={pendingCount <= 1}
                className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold transition-all
                  ${pendingCount <= 1
                    ? 'bg-[#262626] text-[#525252] cursor-not-allowed'
                    : 'bg-[#ef4444] text-white hover:bg-[#dc2626] active:scale-95'
                  }`}
              >
                <BiMinus />
              </button>

              {/* Plus button */}
              <button
                onClick={handleIncrease}
                disabled={pendingCount >= remainingQuantity}
                className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold transition-all
                  ${pendingCount >= remainingQuantity
                    ? 'bg-[#262626] text-[#525252] cursor-not-allowed'
                    : 'bg-[#22c55e] text-white hover:bg-[#16a34a] active:scale-95'
                  }`}
              >
                <BiPlus />
              </button>

              {/* Qisman yuborish - count ko'rsatiladi */}
              <button
                onClick={handleSubmit}
                className="flex-1 h-16 px-4 bg-[#3b82f6] rounded-xl text-white text-lg font-bold flex items-center justify-center gap-2 hover:bg-[#2563eb] transition-all active:scale-[0.98]"
              >
                <BiSend className="text-2xl" />
                {pendingCount}x yuborish
              </button>
            </div>

            {/* Barchasi tayyor */}
            <button
              onClick={handleAllReady}
              className="w-full h-14 mt-2 px-4 bg-[#22c55e] rounded-xl text-white text-base font-semibold flex items-center justify-center gap-2 hover:bg-[#16a34a] transition-all active:scale-[0.98]"
            >
              <BiCheckDouble className="text-xl" />
              Barchasi tayyor
            </button>
          </>
        )}

        {/* Fully ready state */}
        {isFullyReady && (
          <div className="space-y-2">
            <div className="py-3 px-5 bg-[#22c55e]/15 text-[#22c55e] rounded-lg text-base font-semibold flex items-center justify-center gap-2">
              <BiCheck className="text-xl" />
              Hammasi tayyor!
            </div>
            {/* Ortga qaytarish tugmasi */}
            <button
              onClick={handleRevert}
              className="w-full h-12 px-4 bg-[#f97316]/10 border border-[#f97316]/30 rounded-xl text-[#f97316] text-base font-medium flex items-center justify-center gap-2 hover:bg-[#f97316]/20 transition-all active:scale-[0.98]"
            >
              <BiUndo className="text-xl" />
              Ortga qaytarish
            </button>
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
          <span>{timeDiff}</span>
        </div>
      </div>
    </div>
  );
}
