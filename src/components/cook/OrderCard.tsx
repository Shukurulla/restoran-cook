'use client';

import { useState, useEffect } from 'react';
import { FoodItem, OrderItem } from '@/types';
import { BiTable, BiUser, BiTime, BiCheck, BiMinus, BiPlus, BiCheckDouble, BiUndo, BiError } from 'react-icons/bi';

interface OrderCardProps {
  order: FoodItem;
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
  onRevertReady: (order: FoodItem, itemIndex: number, revertCount: number) => void;
  removingItem: string | null;
  isLoading: boolean;
  requireDoubleConfirmation?: boolean;
}

const getTimeDiff = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return 'hozirgina';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} sekund`;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} daqiqa`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} soat`;
  return `${hours} soat ${remainingMinutes} daqiqa`;
};

// Compact item row component
function ItemRow({
  order,
  item,
  itemIndex,
  onMarkReady,
  onRevertReady,
  isRemoving,
  isLoading,
  requireDoubleConfirmation,
  isCancelled,
}: {
  order: FoodItem;
  item: OrderItem;
  itemIndex: number;
  onMarkReady: (order: FoodItem, itemIndex: number, readyCount?: number) => void;
  onRevertReady: (order: FoodItem, itemIndex: number, revertCount: number) => void;
  isRemoving: boolean;
  isLoading: boolean;
  requireDoubleConfirmation?: boolean;
  isCancelled?: boolean;
}) {
  const alreadyReady = item.readyQuantity || 0;
  const remainingQuantity = item.quantity - alreadyReady;
  const isFullyReady = remainingQuantity <= 0;

  // Item-level yoki order-level bekor qilish tekshiruvi
  const isItemCancelled = isCancelled || item.isCancelled || item.kitchenStatus === 'cancelled';

  // Bekor qilingan order/item uchun - faqat item ko'rsatish, button yo'q
  if (isItemCancelled) {
    return (
      <div className={`flex items-center justify-between py-2 px-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 ${isRemoving ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="text-[#ef4444] font-medium line-through">{item.quantity}x</span>
          <span className="text-[#ef4444] line-through">{item.foodName}</span>
        </div>
        <span className="text-xs text-[#ef4444] bg-[#ef4444]/10 px-2 py-1 rounded">
          Bekor qilindi
        </span>
      </div>
    );
  }

  const [pendingCount, setPendingCount] = useState(1);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDecrease = () => {
    if (pendingCount > 1) setPendingCount(prev => prev - 1);
  };

  const handleIncrease = () => {
    if (pendingCount < remainingQuantity) setPendingCount(prev => prev + 1);
  };

  const handleSubmit = () => {
    if (requireDoubleConfirmation && !waitingConfirmation) {
      setWaitingConfirmation(true);
      return;
    }
    onMarkReady(order, itemIndex, pendingCount);
    setPendingCount(1);
    setWaitingConfirmation(false);
    setExpanded(false);
  };

  const handleAllReady = () => {
    if (requireDoubleConfirmation && !waitingConfirmation) {
      setWaitingConfirmation(true);
      return;
    }
    onMarkReady(order, itemIndex, remainingQuantity);
    setPendingCount(1);
    setWaitingConfirmation(false);
    setExpanded(false);
  };

  const handleRevert = () => {
    onRevertReady(order, itemIndex, item.quantity);
  };

  // Tayyor bo'lgan item - kompakt ko'rinish
  if (isFullyReady) {
    return (
      <div className={`flex items-center justify-between py-2 px-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 ${isRemoving ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2">
          <BiCheck className="text-[#22c55e] text-lg" />
          <span className="text-[#22c55e] font-medium">{item.quantity}x</span>
          <span className="text-[#22c55e]">{item.foodName}</span>
        </div>
        <button
          onClick={handleRevert}
          disabled={isLoading}
          className="p-1.5 text-[#f97316] hover:bg-[#f97316]/10 rounded-lg transition-colors"
          title="Qaytarish"
        >
          <BiUndo className="text-lg" />
        </button>
      </div>
    );
  }

  // Tayyorlanmoqda - kompakt ko'rinish
  return (
    <div className={`rounded-lg border transition-all ${
      waitingConfirmation
        ? 'bg-[#ef4444]/10 border-[#ef4444]'
        : expanded
          ? 'bg-[#1a1a1a] border-[#404040]'
          : 'bg-[#1a1a1a] border-[#333]'
    } ${isRemoving ? 'opacity-50' : ''}`}>
      {/* Main row - always visible */}
      <div
        className="flex items-center justify-between py-2.5 px-3 cursor-pointer"
        onClick={() => !waitingConfirmation && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#f97316] text-white text-sm font-bold">
            {remainingQuantity}x
          </span>
          <span className="font-medium text-white">{item.foodName}</span>
          {alreadyReady > 0 && (
            <span className="text-xs text-[#22c55e] bg-[#22c55e]/10 px-1.5 py-0.5 rounded">
              +{alreadyReady} tayyor
            </span>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          {waitingConfirmation ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleAllReady(); }}
                disabled={isLoading}
                className="px-3 py-1.5 bg-[#ef4444] text-white text-sm font-semibold rounded-lg animate-pulse"
              >
                <BiError className="inline mr-1" />
                Tasdiqlash
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setWaitingConfirmation(false); }}
                className="p-1.5 text-[#888] hover:text-white"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleAllReady(); }}
              disabled={isLoading}
              className="px-3 py-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1"
            >
              <BiCheckDouble />
              Tayyor
            </button>
          )}
        </div>
      </div>

      {/* Expanded controls - qisman tayyor qilish uchun */}
      {expanded && !waitingConfirmation && remainingQuantity > 1 && (
        <div className="px-3 pb-3 pt-1 border-t border-[#333]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#888]">Qisman:</span>
            <button
              onClick={handleDecrease}
              disabled={pendingCount <= 1}
              className={`w-8 h-8 rounded flex items-center justify-center text-lg ${
                pendingCount <= 1 ? 'bg-[#262626] text-[#525252]' : 'bg-[#ef4444] text-white'
              }`}
            >
              <BiMinus />
            </button>
            <span className="w-8 text-center font-bold text-white">{pendingCount}</span>
            <button
              onClick={handleIncrease}
              disabled={pendingCount >= remainingQuantity}
              className={`w-8 h-8 rounded flex items-center justify-center text-lg ${
                pendingCount >= remainingQuantity ? 'bg-[#262626] text-[#525252]' : 'bg-[#22c55e] text-white'
              }`}
            >
              <BiPlus />
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 h-8 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-semibold rounded transition-colors"
            >
              {pendingCount}x yuborish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrderCard({
  order,
  onMarkReady,
  onRevertReady,
  removingItem,
  isLoading,
  requireDoubleConfirmation,
}: OrderCardProps) {
  const [timeDiff, setTimeDiff] = useState('');

  useEffect(() => {
    const updateTime = () => setTimeDiff(getTimeDiff(order.createdAt));
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const totalItems = order.items.length;
  const readyItems = order.items.filter(item => (item.readyQuantity || 0) >= item.quantity).length;
  const allReady = readyItems === totalItems;
  const isCancelled = order.status === 'cancelled';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isCancelled
        ? 'bg-[#ef4444]/5 border-[#ef4444]/30'
        : allReady
          ? 'bg-[#22c55e]/5 border-[#22c55e]/30'
          : 'bg-secondary border-border hover:border-[#404040]'
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        isCancelled ? 'border-[#ef4444]/20' : allReady ? 'border-[#22c55e]/20' : 'border-border'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
            isCancelled
              ? 'bg-[#ef4444]/20 text-[#ef4444]'
              : allReady
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'bg-[#3b82f6]/20 text-[#3b82f6]'
          }`}>
            <BiTable />
          </div>
          <div>
            <h3 className={`font-bold ${
              isCancelled ? 'text-[#ef4444]' : allReady ? 'text-[#22c55e]' : 'text-white'
            }`}>
              {order.tableName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {order.waiterName && (
                <span className="flex items-center gap-1">
                  <BiUser />
                  {order.waiterName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <BiTime className="text-[#f97316]" />
                {timeDiff}
              </span>
            </div>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
          isCancelled
            ? 'bg-[#ef4444]/20 text-[#ef4444]'
            : allReady
              ? 'bg-[#22c55e]/20 text-[#22c55e]'
              : 'bg-[#f97316]/20 text-[#f97316]'
        }`}>
          {isCancelled ? 'BEKOR QILINDI' : `${readyItems}/${totalItems}`}
        </div>
      </div>

      {/* Items */}
      <div className="p-3 space-y-2">
        {order.items.map((item, index) => {
          const actualIndex = item.originalIndex !== undefined ? item.originalIndex : index;
          const itemKey = `${order._id}-${actualIndex}`;
          return (
            <ItemRow
              key={`${order._id}-${actualIndex}-${index}`}
              order={order}
              item={item}
              itemIndex={actualIndex}
              onMarkReady={onMarkReady}
              onRevertReady={onRevertReady}
              isRemoving={removingItem === itemKey}
              isLoading={isLoading}
              requireDoubleConfirmation={requireDoubleConfirmation}
              isCancelled={order.status === 'cancelled'}
            />
          );
        })}
      </div>
    </div>
  );
}
