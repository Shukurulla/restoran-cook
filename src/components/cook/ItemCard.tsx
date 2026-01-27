'use client';

import { useState, useEffect, useCallback } from 'react';
import { FoodItem, OrderItem } from '@/types';
import { BiTable, BiUser, BiTime, BiCheck, BiMinus, BiPlus, BiSend, BiCheckDouble, BiUndo, BiError, BiPlay, BiStopwatch } from 'react-icons/bi';

interface ItemCardProps {
  order: FoodItem;
  item: OrderItem;
  itemIndex: number;
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
  onRevertReady: (order: FoodItem, itemIndex: number, revertCount: number) => void;
  onStartItem?: (order: FoodItem, itemIndex: number) => Promise<void>; // Yangi - Boshlandi callback
  isRemoving?: boolean;
  isLoading?: boolean;
  requireDoubleConfirmation?: boolean; // Oshpaz profilidan - ikki marta tasdiqlash
}

// Vaqt farqini hisoblash (qo'shilgan vaqtdan beri)
const getTimeDiff = (dateStr: string | undefined | null): string => {
  if (!dateStr) return 'Noma\'lum';

  const date = new Date(dateStr);
  // Invalid date check
  if (isNaN(date.getTime())) return 'Noma\'lum';

  const diff = Date.now() - date.getTime();

  // Agar kelajakdagi vaqt bo'lsa (server vaqti farqi)
  if (diff < 0) return 'Hozirgina';

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} soat oldin`;
  return `${hours} soat ${remainingMinutes} daqiqa oldin`;
};

// Tayyorlash vaqtini formatlash (timer uchun)
const formatPreparationTime = (startedAt: string | undefined): string => {
  if (!startedAt) return '00:00';

  const start = new Date(startedAt);
  if (isNaN(start.getTime())) return '00:00';

  const diff = Date.now() - start.getTime();
  if (diff < 0) return '00:00';

  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export function ItemCard({ order, item, itemIndex, onMarkReady, onRevertReady, onStartItem, isRemoving, isLoading, requireDoubleConfirmation }: ItemCardProps) {
  // Qolgan miqdor (umumiy - tayyor qilingan)
  const alreadyReady = item.readyQuantity || 0;
  const remainingQuantity = item.quantity - alreadyReady;

  // Backend dan kelgan isStarted holatini ishlatish
  const isStartedFromBackend = item.isStarted || false;

  // Local state - 1 dan boshlab ko'paytirib boradi
  const [pendingCount, setPendingCount] = useState(1);

  // Local state - boshlash jarayonida
  const [isStarting, setIsStarting] = useState(false);

  // Ikki marta tasdiqlash uchun - tasdiqlash kutilmoqda
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'partial' | 'all' | null>(null);

  // Vaqt uchun - item.addedAt yoki order.createdAt
  // Bo'sh string ham check qilinadi
  const timeSource = (item.addedAt && item.addedAt.trim()) || order.createdAt;

  // Vaqt ko'rsatkichi - dinamik yangilanadi
  const [timeDiff, setTimeDiff] = useState<string>('');

  // Tayyorlash vaqti timer - har sekundda yangilanadi
  const [preparationTime, setPreparationTime] = useState<string>('00:00');

  // Har 30 sekundda qo'shilgan vaqtni yangilash
  useEffect(() => {
    const updateTime = () => setTimeDiff(getTimeDiff(timeSource));
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [timeSource, item.foodId, item.foodName, order.createdAt, item.addedAt]);

  // Tayyorlash timeri - har sekundda yangilanadi (faqat boshlangan bo'lsa)
  useEffect(() => {
    if (!isStartedFromBackend || !item.startedAt) {
      setPreparationTime('00:00');
      return;
    }

    const updatePrepTime = () => setPreparationTime(formatPreparationTime(item.startedAt));
    updatePrepTime();
    const interval = setInterval(updatePrepTime, 1000); // Har sekundda
    return () => clearInterval(interval);
  }, [isStartedFromBackend, item.startedAt]);

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
    // Ikki marta tasdiqlash kerak bo'lsa (oshpaz profilidan)
    if (requireDoubleConfirmation) {
      if (waitingConfirmation && confirmationType === 'partial') {
        // Ikkinchi bosish - yuborish
        onMarkReady(order, itemIndex, pendingCount);
        setPendingCount(1);
        setWaitingConfirmation(false);
        setConfirmationType(null);
      } else {
        // Birinchi bosish - tasdiqlash kutish
        setWaitingConfirmation(true);
        setConfirmationType('partial');
      }
    } else {
      // Oddiy holat - darhol yuborish
      onMarkReady(order, itemIndex, pendingCount);
      setPendingCount(1);
    }
  };

  // Barchasi tayyor - qolgan hammasi
  const handleAllReady = () => {
    // Ikki marta tasdiqlash kerak bo'lsa (oshpaz profilidan)
    if (requireDoubleConfirmation) {
      if (waitingConfirmation && confirmationType === 'all') {
        // Ikkinchi bosish - yuborish
        onMarkReady(order, itemIndex, remainingQuantity);
        setPendingCount(1);
        setWaitingConfirmation(false);
        setConfirmationType(null);
      } else {
        // Birinchi bosish - tasdiqlash kutish
        setWaitingConfirmation(true);
        setConfirmationType('all');
      }
    } else {
      // Oddiy holat - darhol yuborish
      onMarkReady(order, itemIndex, remainingQuantity);
      setPendingCount(1);
    }
  };

  // Tasdiqlashni bekor qilish
  const handleCancelConfirmation = () => {
    setWaitingConfirmation(false);
    setConfirmationType(null);
  };

  // Ortga qaytarish - tayyor qilinganlarni qaytarish
  const handleRevert = () => {
    onRevertReady(order, itemIndex, item.quantity); // Hammasini qaytarish
  };

  // Tayyorlashni boshlash - backend API ga yuborish
  const handleStart = useCallback(async () => {
    if (isStarting || isLoading) return;

    setIsStarting(true);
    try {
      if (onStartItem) {
        await onStartItem(order, itemIndex);
      }
    } catch (error) {
      console.error('Start item error:', error);
    } finally {
      setIsStarting(false);
    }
  }, [order, itemIndex, onStartItem, isStarting, isLoading]);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all hover:border-[#404040]
      ${waitingConfirmation
        ? 'bg-[#ef4444]/10 border-[#ef4444] border-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
        : isStartedFromBackend
          ? 'bg-[#f97316]/10 border-[#f97316]/50'
          : isFullyReady
            ? 'bg-secondary border-[#22c55e]/30'
            : 'bg-secondary border-border'}
      ${isRemoving ? 'opacity-50 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
      style={{ transition: 'all 0.3s ease-out' }}
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

          <div className="flex items-center gap-2">
            {/* Tayyorlash vaqti timer - faqat boshlangan bo'lsa */}
            {isStartedFromBackend && !isFullyReady && (
              <span className="py-1 px-3 bg-[#f97316]/20 text-[#f97316] rounded-lg text-sm font-bold flex items-center gap-1.5 animate-pulse">
                <BiStopwatch className="text-base" />
                {preparationTime}
              </span>
            )}
            {/* Ikki tasdiqlash badge */}
            {requireDoubleConfirmation && !isFullyReady && (
              <span className="py-1 px-2 bg-[#f97316]/15 text-[#f97316] rounded-lg text-xs font-medium">
                2x tasdiqlash
              </span>
            )}
            {/* Tayyor badge - agar qisman tayyor bo'lsa (lekin to'liq emas) */}
            {alreadyReady > 0 && !isFullyReady && (
              <span className="py-1 px-3 bg-[#22c55e]/15 text-[#22c55e] rounded-lg text-sm font-medium">
                {alreadyReady} tayyor
              </span>
            )}
          </div>
        </div>

        {/* +/- UI - tayyor bo'lmaganda */}
        {!isFullyReady && (
          <>
            {/* Boshlandi tugmasi - faqat hali boshlanmagan bo'lsa (backend dan) */}
            {!isStartedFromBackend && (
              <button
                onClick={handleStart}
                disabled={isStarting || isLoading}
                className={`w-full h-14 mb-2 px-4 rounded-xl text-white text-base font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                  ${isStarting || isLoading
                    ? 'bg-[#f97316]/50 cursor-not-allowed'
                    : 'bg-[#f97316] hover:bg-[#ea580c]'}`}
              >
                {isStarting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Boshlanmoqda...
                  </>
                ) : (
                  <>
                    <BiPlay className="text-xl" />
                    Tayyorlashni boshlash
                  </>
                )}
              </button>
            )}

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
                disabled={isLoading}
                className={`flex-1 h-16 px-4 rounded-xl text-white text-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                  ${isLoading
                    ? 'bg-[#3b82f6]/50 cursor-not-allowed'
                    : waitingConfirmation && confirmationType === 'partial'
                      ? 'bg-[#ef4444] hover:bg-[#dc2626] animate-pulse'
                      : 'bg-[#3b82f6] hover:bg-[#2563eb]'}`}
              >
                {waitingConfirmation && confirmationType === 'partial' ? (
                  <>
                    <BiError className="text-2xl" />
                    Tasdiqlang!
                  </>
                ) : (
                  <>
                    <BiSend className="text-2xl" />
                    {pendingCount}x yuborish
                  </>
                )}
              </button>
            </div>

            {/* Barchasi tayyor */}
            <button
              onClick={handleAllReady}
              disabled={isLoading}
              className={`w-full h-14 mt-2 px-4 rounded-xl text-white text-base font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                ${isLoading
                  ? 'bg-[#22c55e]/50 cursor-not-allowed'
                  : waitingConfirmation && confirmationType === 'all'
                    ? 'bg-[#ef4444] hover:bg-[#dc2626] animate-pulse'
                    : 'bg-[#22c55e] hover:bg-[#16a34a]'}`}
            >
              {waitingConfirmation && confirmationType === 'all' ? (
                <>
                  <BiError className="text-xl" />
                  Tasdiqlang!
                </>
              ) : (
                <>
                  <BiCheckDouble className="text-xl" />
                  Barchasi tayyor
                </>
              )}
            </button>

            {/* Bekor qilish tugmasi - faqat tasdiqlash kutilayotganda */}
            {waitingConfirmation && (
              <button
                onClick={handleCancelConfirmation}
                className="w-full h-12 mt-2 px-4 rounded-xl text-[#f97316] text-sm font-medium flex items-center justify-center gap-2 transition-all border border-[#f97316]/30 hover:bg-[#f97316]/10"
              >
                <BiUndo className="text-lg" />
                Bekor qilish
              </button>
            )}
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
              disabled={isLoading}
              className={`w-full h-12 px-4 border rounded-xl text-base font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                ${isLoading
                  ? 'bg-[#f97316]/5 border-[#f97316]/20 text-[#f97316]/50 cursor-not-allowed'
                  : 'bg-[#f97316]/10 border-[#f97316]/30 text-[#f97316] hover:bg-[#f97316]/20'}`}
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
