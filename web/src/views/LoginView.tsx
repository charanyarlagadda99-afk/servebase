import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Lock, KeyRound, User, Mail, ShieldCheck, ArrowRight, AlertCircle, ChefHat } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: any) => void;
  isBackendOnline: boolean;
  isLocalServer?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, isBackendOnline, isLocalServer }) => {
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  
  // PIN Login state
  const [pin, setPin] = useState<string>('');
  
  // Password Login state
  const [email, setEmail] = useState<string>('manager@dawat.com');
  const [password, setPassword] = useState<string>('Admin@1234');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handlePinDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      if (newPin.length === 4) {
        handlePinSubmit(undefined, newPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
    setError(null);
  };

  const handlePinSubmit = async (e?: React.FormEvent, overridePin?: string) => {
    if (e) e.preventDefault();
    const pinToTest = overridePin || pin;
    if (pinToTest.length < 4) {
      setError('Please enter a 4-digit terminal PIN (e.g. 1234 or 5678)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.auth.pinLogin(pinToTest);
      if (res.ok && res.data?.user) {
        onLoginSuccess(res.data.user);
        return;
      } else {
        setError(res.error?.message || 'Invalid terminal PIN. Use 1234 (Manager) or 5678 (Cashier).');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Check that the API server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Physical keyboard listener for desktop and laptop computers
  useEffect(() => {
    if (mode !== 'pin') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) {
          const newPin = pin + e.key;
          setPin(newPin);
          setError(null);
          if (newPin.length === 4) {
            handlePinSubmit(undefined, newPin);
          }
        }
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handlePinSubmit();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        setPin('');
        setError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, pin]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.auth.login(email, password);
      if (res.ok && res.data?.user) {
        onLoginSuccess(res.data.user);
        return;
      } else {
        setError(res.error?.message || 'Invalid credentials. Try Admin@1234');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (userType: 'manager' | 'cashier') => {
    const selectedPin = userType === 'manager' ? '1234' : '5678';
    setPin(selectedPin);
    handlePinSubmit(undefined, selectedPin);
  };

  const quickFill = (userType: 'manager' | 'cashier') => {
    if (userType === 'manager') {
      setEmail('manager@dawat.com');
      setPassword('Admin@1234');
      setPin('1234');
    } else {
      setEmail('cashier@dawat.com');
      setPassword('Admin@1234');
      setPin('5678');
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 font-sans text-slate-100">
      {/* Brand Header */}
      <div className="text-center mb-8 max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
          <ChefHat size={36} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
          ServeBase <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest font-mono">Enterprise</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Mission-Critical Restaurant POS & Multi-Outlet Back-Office Platform
        </p>

        {isLocalServer ? (
          <div className="mt-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>API Server Connected (Fastify + C++ Engine + PostgreSQL)</span>
          </div>
        ) : (
          <div className="mt-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            <span>API server not detected. Start the backend to log in.</span>
          </div>
        )}
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        {/* Toggle Mode */}
        <div className="flex bg-slate-950/60 p-1 rounded-xl mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('pin'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === 'pin'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound size={14} />
            Terminal 4-Digit PIN
          </button>
          <button
            type="button"
            onClick={() => { setMode('password'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === 'password'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock size={14} />
            Back-Office Password
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* PIN MODE KEYPAD */}
        {mode === 'pin' ? (
          <div>
            <div className="text-center mb-6">
              <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-mono">Enter Terminal PIN</div>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold transition-all ${
                      pin.length > idx
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-sm'
                        : 'border-slate-800 bg-slate-950/40 text-slate-600'
                    }`}
                  >
                    {pin.length > idx ? '•' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Numerical Pad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    if (val === 'C') handlePinClear();
                    else if (val === '⌫') handlePinBackspace();
                    else handlePinDigit(val);
                  }}
                  className={`h-14 rounded-xl text-lg font-bold transition-all active:scale-95 flex items-center justify-center ${
                    val === 'C'
                      ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                      : val === '⌫'
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-100 hover:border-slate-700 border border-slate-800/50'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={loading || pin.length < 4}
              onClick={() => handlePinSubmit()}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
            >
              {loading ? 'Authenticating Terminal...' : 'Unlock Terminal'}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          /* PASSWORD MODE FORM */
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Corporate Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@dawat.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? 'Verifying Credentials...' : 'Sign In to Back Office'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Quick Login Shortcuts */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 text-center">
            Quick Terminal Login
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => quickLogin('manager')}
              className="px-2.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/50 text-left transition-all hover:border-amber-500/50 flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-amber-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-200">Aarav (Manager)</div>
                  <div className="text-[10px] text-slate-400 font-mono">PIN: 1234</div>
                </div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950 font-bold transition-all">
                Login →
              </span>
            </button>

            <button
              type="button"
              onClick={() => quickLogin('cashier')}
              className="px-2.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/50 text-left transition-all hover:border-emerald-500/50 flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <User size={14} className="text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-200">Rohan (Cashier)</div>
                  <div className="text-[10px] text-slate-400 font-mono">PIN: 5678</div>
                </div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-slate-950 font-bold transition-all">
                Login →
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 font-mono">
        ServeBase Production v1.0 • C++ Engine Verified • PostgreSQL 16
      </div>
    </div>
  );
};
