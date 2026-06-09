import React, { useState } from 'react';
import { Lock, User as UserIcon, ShieldAlert, ArrowRight, UserCheck, Terminal } from 'lucide-react';
import { User, UserRole } from '../types.ts';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const ACCOUNT_PRESETS = [
    {
      username: 'admin',
      password: 'admin',
      role: 'admin' as UserRole,
      label: 'Ko Phyo (System Admin)',
      desc: 'Full access: service jobs control, billing invoices, deletions logs, staff assignment & settings.',
      color: 'hover:border-slate-400 bg-white border-slate-200/80 hover:bg-slate-50/40 text-slate-900 shadow-xs'
    },
    {
      username: 'coordinator',
      password: 'coordinator',
      role: 'coordinator' as UserRole,
      label: 'Daw Su (Coordinator)',
      desc: 'Customer intake: create jobs, edit general ticket info, assign tech staffs. No invoice access or deletes.',
      color: 'hover:border-slate-400 bg-white border-slate-200/80 hover:bg-slate-50/40 text-slate-900 shadow-xs'
    },
    {
      username: 'senior',
      password: 'senior',
      role: 'senior_technician' as UserRole,
      label: 'Ko Tin (Senior Tech)',
      desc: 'Operations & Billing: dispatch logs, diagnoses & repair outcomes, generate service invoices. No deletes.',
      color: 'hover:border-slate-400 bg-white border-slate-200/80 hover:bg-slate-50/40 text-slate-900 shadow-xs'
    },
    {
      username: 'tech',
      password: 'tech',
      role: 'technician' as UserRole,
      label: 'Ko Sai (Technician)',
      desc: 'Field Service: dispatcher updates, site diagnoses & resolution notes of jobs. No billing or creates.',
      color: 'hover:border-slate-400 bg-white border-slate-200/80 hover:bg-slate-50/40 text-slate-900 shadow-xs'
    }
  ];

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
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userVal, password: passVal })
    })
      .then((res) => {
         if (!res.ok) {
           throw new Error('Authentication failed: Invalid username or passcode.');
         }
         return res.json();
      })
      .then((userData: User) => {
        onLoginSuccess(userData);
      })
      .catch((err) => {
        setErrorMsg(err.message);
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
              SmartFix Solutions
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
              Enterprise Dispatch & Service System
            </p>
          </div>
        </div>

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
                Username / အသုံးပြုသူအမည်
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
                Password / လျှို့ဝှက်နံပါတ်
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

          {/* Quick-Switch Profile Presets Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest select-none">
                Quick Dev Session / အမြန်ဝင်ရန်
              </span>
            </div>
          </div>

          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-1 gap-2 text-left">
            {ACCOUNT_PRESETS.map((p) => (
              <button
                key={p.username}
                type="button"
                onClick={() => {
                  setUsername(p.username);
                  setPassword(p.password);
                  submitLogin(p.username, p.password);
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col items-start gap-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all cursor-pointer group ${p.color}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-[11px] font-sans flex items-center gap-1.5 text-slate-900 pr-1 truncate">
                    <UserCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" /> {p.label}
                  </span>
                  <span className="text-[9px] bg-slate-50 border border-slate-200/50 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 group-hover:bg-slate-100">
                    {p.username}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal font-sans">
                  {p.desc}
                </p>
              </button>
            ))}
          </div>

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
