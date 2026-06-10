import React, { useState } from 'react';
import { Lock, User as UserIcon, ShieldAlert, ArrowRight, Terminal, Database, CheckCircle, AlertTriangle } from 'lucide-react';
import { User } from '../types.ts';
import { INITIAL_FALLBACK_USERS } from '../fallbackData.ts';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  dbStatus?: { connected: boolean; isDemo: boolean; modeMessage?: string; uriUsed?: string; error?: string; uriState?: string } | null;
}

export default function Login({ onLoginSuccess, dbStatus }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please supply username and password.');
      return;
    }
    submitLogin(username.trim(), password.trim());
  };

  const submitLogin = (userVal: string, passVal: string) => {
    setLoading(true);
    setErrorMsg('');
    const cleanUsername = userVal.trim().toLowerCase();

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userVal, password: passVal })
    })
      .then((res) => {
         if (!res.ok) {
           if (res.status === 401) {
             throw new Error('Authentication failed: Invalid username or passcode.');
           }
           throw new Error('BACKEND_OFFLINE');
         }
         return res.json();
      })
      .then((userData: User) => {
        onLoginSuccess(userData);
      })
      .catch((err) => {
        setErrorMsg(err.message === 'BACKEND_OFFLINE' 
          ? 'Database connection offline. Please examine your MONGO_URI setup.' 
          : (err.message || 'Authentication failed: Invalid username or passcode.'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans" id="login-module-container">
      <div className="max-w-md w-full mx-auto space-y-8 animate-fade-in">
        
        {/* Sleek App Icon Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-md mx-auto">
            <Terminal className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 font-display">
              Yangon Store
            </h2>
          </div>
        </div>

        {/* Database Connectivity Status / Error Alert on Login Screen */}
        {dbStatus && (
          <div className="animate-fade-in text-left">
            {dbStatus.connected ? (
              <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-emerald-600 bg-emerald-50/70 border border-emerald-100 rounded-2xl py-1.5 px-3.5 w-fit mx-auto font-bold shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>MongoDB Database Connected (Successfully Connected)</span>
              </div>
            ) : (
              <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex gap-2.5 items-start">
                  <div className="bg-amber-100 text-amber-800 p-1.5 rounded-xl mt-0.5 shrink-0">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-amber-950 font-display flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600 inline shrink-0" />
                      Database is currently offline
                    </h4>
                    <p className="text-[11px] text-slate-650 mt-1 leading-relaxed">
                      Please verify that your database credentials are correctly set up and MongoDB cluster is accessible.
                    </p>
                  </div>
                </div>

                {/* Condition-specific direct errors */}
                {dbStatus.error && (
                  <div className="text-[11px] text-rose-800 bg-rose-50/70 p-3 rounded-xl border border-rose-100 space-y-1.5">
                    <p className="font-bold text-rose-950">
                      ❌ MongoDB Live Connection Error
                    </p>
                    <div className="bg-white/90 border border-rose-100 font-mono text-[10px] p-2 rounded-lg break-words leading-normal max-h-24 overflow-y-auto">
                      {dbStatus.error}
                    </div>
                    <p className="text-[10px] text-rose-700/90 leading-normal">
                      <strong>Tip:</strong> Ensure you have whitelisted all IP addresses in your Atlas Cluster Network Access List (e.g. adding <code className="bg-rose-100/50 px-1 font-bold">0.0.0.0/0</code> for global access).
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Login Card Core */}
        <div className="bg-white rounded-3xl border border-slate-200/50 p-6 sm:p-8 shadow-sm">
          <form className="space-y-4 text-left" onSubmit={handleLoginSubmit}>
            {errorMsg && (
              <div className="bg-rose-50 text-rose-800 border border-rose-100 p-3 rounded-2xl text-[11px] font-semibold flex items-center gap-2 mb-2 animate-fade-in">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="username-field" className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1.5 select-none">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="username-field"
                  type="text"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200/80 rounded-2xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:bg-white focus:border-slate-400 transition-all font-sans"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-field" className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1.5 select-none">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password-field"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200/80 rounded-2xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:bg-white focus:border-slate-400 transition-all font-sans"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-950 text-white rounded-2xl py-3 text-xs font-bold hover:bg-slate-850 active:scale-99 cursor-pointer shadow-sm flex items-center justify-center gap-1.5 transition-all mt-6"
            >
              {loading ? (
                <span className="animate-pulse">Authenticating Session...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Info footer */}
        <p className="text-center text-[10px] text-slate-400 leading-normal">
          Enterprise role restrictions prevent unauthorized access.<br/>
          SmartFix Co., Ltd &copy; 2026. All Rights Reserved.
        </p>

      </div>
    </div>
  );
}
