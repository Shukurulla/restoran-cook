'use client';

import { FoodItem, OrderItem } from '@/types';
import { BiTable, BiUser, BiTime, BiCheck } from 'react-icons/bi';

interface ItemCardProps {
  order: FoodItem;
  item: OrderItem;
  itemIndex: number;
  onMarkReady: (order: FoodItem, itemIndex: number) => void;
}

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTimeDiff = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  return `${hours} soat oldin`;
};

export function ItemCard({ order, item, itemIndex, onMarkReady }: ItemCardProps) {
  const isReady = item.isReady;

  return (
    <div className={`bg-secondary rounded-xl border overflow-hidden transition-all hover:border-[#404040]
      ${isReady ? 'border-[#22c55e]/30' : 'border-border'}`}
    >
      {/* Header with item name */}
      <div className="px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="bg-[#f97316] text-white px-3 py-1 rounded-lg text-lg font-bold">
            {item.quantity}x
          </span>
          <h3 className={`text-lg font-semibold ${isReady ? 'text-[#22c55e]' : ''}`}>
            {item.foodName}
          </h3>
        </div>
        {!isReady ? (
          <button
            onClick={() => onMarkReady(order, itemIndex)}
            className="py-2.5 px-5 bg-[#22c55e] rounded-lg text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <BiCheck className="text-lg" />
            Tayyor
          </button>
        ) : (
          <span className="py-2.5 px-5 bg-[#22c55e]/15 text-[#22c55e] rounded-lg text-sm font-semibold flex items-center gap-2">
            <BiCheck className="text-lg" />
            Tayyor
          </span>
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
