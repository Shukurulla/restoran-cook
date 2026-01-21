'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BiPhone, BiLock, BiShow, BiHide } from 'react-icons/bi';

export function LoginPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatPhone = (value: string) => {
    let digits = value.replace(/\D/g, '');
    if (!digits.startsWith('998')) {
      digits = '998' + digits;
    }
    let formatted = '+998';
    if (digits.length > 3) {
      formatted += ' ' + digits.slice(3, 5);
    }
    if (digits.length > 5) {
      formatted += ' ' + digits.slice(5, 8);
    }
    if (digits.length > 8) {
      formatted += ' ' + digits.slice(8, 10);
    }
    if (digits.length > 10) {
      formatted += ' ' + digits.slice(10, 12);
    }
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    if (formatted.length <= 17) {
      setPhone(formatted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const cleanPhone = phone.replace(/\s/g, '');
      await login(cleanPhone, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirish xatoligi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5">
      <Card className="w-full max-w-[420px] bg-card border-border">
        <CardHeader className="text-center pb-2">
          <div className="w-[150px] h-[100px] mx-auto mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="Kepket" className="max-w-full max-h-full object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Oshxona Panel</CardTitle>
          <CardDescription className="text-muted-foreground">
            Oshpaz sifatida kirish
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-6 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BiPhone className="text-lg" />
                Telefon
              </label>
              <input
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="+998 XX XXX XX XX"
                maxLength={17}
                disabled={isLoading}
                className="w-full h-12 px-4 bg-secondary border border-border rounded-xl text-foreground focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]/10 outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BiLock className="text-lg" />
                Parol
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parolni kiriting"
                  disabled={isLoading}
                  className="w-full h-12 px-4 pr-12 bg-secondary border border-border rounded-xl text-foreground focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]/10 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <BiHide className="text-xl" /> : <BiShow className="text-xl" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || phone.length < 17 || !password}
              className="w-full h-12 bg-gradient-to-r from-[#f97316] to-[#ea580c] hover:opacity-90 text-white font-semibold text-base"
            >
              {isLoading ? 'Kirish...' : 'Kirish'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
