'use client';

import { useAuth } from '@/context/AuthContext';
import { Stats } from '@/types';
import { BiCog, BiUser, BiLogOut, BiRefresh } from 'react-icons/bi';

interface HeaderProps {
  stats: Stats;
  isConnected: boolean;
  onSettingsClick: () => void;
}

export function Header({ stats, isConnected, onSettingsClick }: HeaderProps) {
  const { user, restaurant, logout } = useAuth();

  return (
    <header className="flex justify-between items-center py-4 mb-6 border-b border-border">
      <div className="flex items-center gap-4">
        <img src="/logo.png" alt="Kepket" className="w-[100px] h-auto" />
        <h1 className="text-xl font-semibold tracking-tight">Oshxona Panel</h1>
        {restaurant && (
          <span className="px-4 py-1.5 bg-secondary rounded-full text-sm text-muted-foreground font-medium">
            {restaurant.name}
          </span>
        )}
      </div>

      <div className="flex gap-8">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold tabular-nums text-[#f97316]">{stats.pending}</span>
          <span className="text-xs text-[#71717a] uppercase tracking-wider">Tayyorlanmoqda</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold tabular-nums text-[#22c55e]">{stats.ready}</span>
          <span className="text-xs text-[#71717a] uppercase tracking-wider">Tayyor</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold tabular-nums text-[#3b82f6]">{stats.served}</span>
          <span className="text-xs text-[#71717a] uppercase tracking-wider">Tugatilgan</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold tabular-nums text-[#ef4444]">{stats.cancelled}</span>
          <span className="text-xs text-[#71717a] uppercase tracking-wider">Rad etilgan</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-secondary border border-border ${isConnected ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]' : 'bg-[#ef4444]'}`} />
          <span>{isConnected ? 'Ulangan' : 'Ulanmagan'}</span>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg text-[#3b82f6] text-sm font-medium hover:bg-[#3b82f6]/20 hover:border-[#3b82f6] transition-colors"
        >
          <BiRefresh className="text-lg" />
          Yangilash
        </button>

        <button
          onClick={onSettingsClick}
          className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-lg text-muted-foreground text-sm font-medium hover:bg-[#262626] hover:text-foreground transition-colors"
        >
          <BiCog className="text-lg" />
        </button>

        <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg text-muted-foreground text-sm font-medium">
          <BiUser className="text-lg" />
          <span>{user?.name}</span>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm font-medium hover:bg-[#ef4444]/20 hover:border-[#ef4444] transition-colors"
        >
          <BiLogOut className="text-lg" />
          Chiqish
        </button>
      </div>
    </header>
  );
}
