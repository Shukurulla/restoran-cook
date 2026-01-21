'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Restaurant } from '@/types';
import { api } from '@/services/api';

interface AuthContextType {
  user: User | null;
  restaurant: Restaurant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = api.getStoredUser();
    const storedRestaurant = api.getStoredRestaurant();
    const token = api.getToken();

    if (storedUser && storedRestaurant && token) {
      setUser(storedUser);
      setRestaurant(storedRestaurant);
    }
    setIsLoading(false);
  }, []);

  const login = async (phone: string, password: string) => {
    const data = await api.login(phone, password);
    setUser(data.user);
    setRestaurant(data.restaurant);
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
    setRestaurant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurant,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
