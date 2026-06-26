import React, { useState } from 'react';
import { Lock, User as UserIcon, ShieldAlert, ArrowRight, Terminal, Database, CheckCircle, AlertTriangle } from 'lucide-react';
import { User } from '../types.ts';
import { secureStorage } from '../lib/secureStorage.ts';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  dbStatus?: { connected: boolean; isDemo: boolean; modeMessage?: string; uriUsed?: string; error?: string; uriState?: string } | null;
}

export default function Login({ onLoginSuccess, dbStatus }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    const savedUser = secureStorage.getItem<string>('remember_username') || '';
    if (savedUser) {
      setUsername(savedUser);
      setRememberMe(true);
    }
  }, []);

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
        if (rememberMe) {
          secureStorage.setItem('remember_username', username);
        } else {
          secureStorage.removeItem('remember_username');
        }
        // Always remove password from secureStorage if it lingered from previous instances
        secureStorage.removeItem('remember_password');
        onLoginSuccess(userData);
      })
      .catch((err) => {
        setErrorMsg(err.message === 'BACKEND_OFFLINE' 
          ? 'Database connection offline. Please examine your setup configuration.' 
          : (err.message || 'Authentication failed: Invalid username or passcode.'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-[#050e12] relative flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden" id="login-module-container">
      
      {/* Dynamic drifting liquid gradient blobs behind the frosted card */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-teal-600 opacity-[0.25] blur-[120px] animate-blob-1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-emerald-600 opacity-[0.22] blur-[140px] animate-blob-2" />
        <div className="absolute top-[35%] right-[15%] w-[380px] h-[380px] rounded-full bg-cyan-500 opacity-[0.18] blur-[100px] animate-blob-3" />
      </div>

      <div className="max-w-md w-full mx-auto space-y-8 animate-fade-in relative z-10">
        
        {/* Sleek App Icon Header */}
        <div className="text-center space-y-3 select-none">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white shadow-xl mx-auto border border-white/20 relative">
            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-50 blur-[2px]" />
            <Terminal className="h-6 w-6 relative z-10 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-white font-display">
              YS SVC
            </h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
              Liquid Dispatch Hub
            </p>
          </div>
        </div>

        {/* Database Connectivity Status / Error Alert on Login Screen */}
        {dbStatus && (
          <div className="animate-fade-in text-center">
            {dbStatus.connected ? (
              <div className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full py-1 px-3.5 font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cloud Database Connected</span>
              </div>
            ) : (
              <div className="ios-glass-dark rounded-2xl p-4 space-y-3 text-left">
                <div className="flex gap-2.5 items-start">
                  <div className="bg-amber-500/20 text-amber-300 p-2 rounded-xl mt-0.5 shrink-0 border border-amber-500/20">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-amber-300 font-display flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 inline shrink-0" />
                      Database is currently offline
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Please verify that your database credentials are correctly set up and database server is accessible.
                    </p>
                  </div>
                </div>

                {/* Condition-specific direct errors */}
                {dbStatus.error && (
                  <div className="text-[11px] text-rose-300 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 flex flex-col gap-1 select-none">
                    <p className="font-bold text-rose-400 flex items-center gap-1">
                      <span>❌ Database Connection Error</span>
                    </p>
                    <p className="text-xs text-rose-350 font-sans leading-relaxed">
                      Detailed system logs are stored under secure console diagnostics. Please verify that your configurations conform to network standards.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Login Card Core */}
        <div className="ios-glass-dark rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          {/* Subtle top glare reflection line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <form className="space-y-5 text-left relative z-10" onSubmit={handleLoginSubmit}>
            {errorMsg && (
              <div className="bg-rose-500/10 text-rose-300 border border-rose-500/25 p-3 rounded-xl text-[11px] font-semibold flex items-center gap-2 mb-2 animate-fade-in">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="username-field" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-1.5 select-none">
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:bg-white/10 focus:border-teal-500/50 transition-all font-sans"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-field" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-1.5 select-none">
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:bg-white/10 focus:border-teal-500/50 transition-all font-sans"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between select-none py-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="chk-remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-white/10 text-teal-600 focus:ring-teal-500/50 h-4 w-4 bg-white/5 accent-teal-600 cursor-pointer"
                />
                <span className="text-[11px] text-slate-400 font-medium select-none">
                  Remember my credentials
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full ios-btn-primary rounded-xl py-3 text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5 mt-6"
            >
              {loading ? (
                <span className="animate-pulse">Authenticating Session...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Info footer */}
        <p className="text-center text-[10px] text-slate-500 leading-normal select-none">
          Enterprise role restrictions prevent unauthorized access.<br/>
          YS SVC Co., Ltd &copy; 2026. All Rights Reserved.
        </p>

      </div>
    </div>
  );
}
