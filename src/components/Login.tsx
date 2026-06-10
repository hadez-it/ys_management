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
        if (err.message === 'Authentication failed: Invalid username or passcode.') {
          setErrorMsg(err.message);
        } else {
          // Client-side authentication fallback (ideal for Vercel static hosting)
          const matchedUser = INITIAL_FALLBACK_USERS.find(
            (u) => u.username === cleanUsername && u.password === passVal
          );
          if (matchedUser) {
            const { password, ...userData } = matchedUser;
            onLoginSuccess(userData as User);
          } else {
            setErrorMsg('Authentication failed: Invalid username or passcode.');
          }
        }
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
                <span>MongoDB Database Connected (အောင်မြင်စွာ ချိတ်ဆက်ပြီး)</span>
              </div>
            ) : (
              <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 space-y-3.5 shadow-sm">
                <div className="flex gap-2.5 items-start">
                  <div className="bg-amber-100 text-amber-800 p-1.5 rounded-xl mt-0.5 shrink-0">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-amber-950 font-display flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600 inline shrink-0" />
                      ဒေတာဘေ့စ် ချိတ်ဆက်မှုစစ်ဆေးရန်လိုအပ်နေပါသည်
                    </h4>
                    <span className="inline-block mt-1 text-[9.5px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md">
                      ⚠️ AI Studio Playground Preview အခြေအနေ
                    </span>
                  </div>
                </div>

                {/* Condition 1: Missing Variable altogether in Sandbox */}
                {(!dbStatus.uriState || dbStatus.uriState === "missing") && (
                  <div className="text-[11px] text-slate-700 bg-white/70 p-3 rounded-xl border border-amber-150 space-y-2">
                    <p className="font-bold text-slate-900 leading-normal">
                      💡 Vercel တွင် environment variable ထည့်သွင်းထားသော်လည်း ယခုမြင်တွေ့နေရသော builder preview ဘောင်သည် <span className="text-amber-800 font-extrabold">Google AI Studio Playground Sandbox</span> အတွင်း၌ runtime run နေခြင်းဖြစ်ပါသည်။
                    </p>
                    <p className="leading-relaxed">
                      ထို့ကြောင့် ဤ AI Studio Preview အတွင်း၌လည်း Green (အောင်မြင်စွာချိတ်ဆက်မှု) ကို မြင်တွေ့လိုပါက အောက်ပါအတိုင်း ဆောင်ရွက်နိုင်သည် -
                    </p>
                    <div className="bg-amber-100/40 p-2.5 rounded-lg text-[10.5px] space-y-1 font-medium text-amber-900">
                      <p className="font-bold">၁။ Google AI Studio Playground internal environment settings သို့သွားပါ -</p>
                      <p>အက်ပ်မျက်နှာပြင်၏ဘယ်ဘက်အောက် သို့မဟုတ် ညာဘက်အပေါ်ရှိ <strong>Settings / Secrets panel</strong> (သို့မဟုတ် သော့ပုံစံ Icon) ကို နှိပ်ပြီး <strong>Secrets</strong> သို့မဟုတ် Environment Variable ထဲတွင် အောက်ပါအတိုင်း အသစ်ပေါင်းထည့်ပေးပါ။</p>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 font-semibold">
                        <li>Key Name: <code className="bg-amber-200/50 px-1 font-mono rounded">MONGO_URI</code></li>
                        <li>Value: <code className="bg-amber-200/50 px-1 font-mono rounded">mongodb+srv://... (သင်၏ real Cluster URI link)</code></li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Condition 2: Placeholder credentials configured inside Sandbox */}
                {dbStatus.uriState === "placeholder" && (
                  <div className="text-[11px] text-slate-700 bg-white/70 p-3 rounded-xl border border-amber-150 space-y-1.5">
                    <p className="font-bold text-amber-900">
                      ⚠️ Placeholder Credentials တွေ့ရှိရသည် -
                    </p>
                    <p className="leading-relaxed">
                      လက်ရှိ <code className="bg-slate-100 px-1 font-mono text-xs text-rose-700 font-bold">MONGO_URI</code> ထဲတွင် user credentials နေရာ၌ <code className="font-mono text-amber-900">&lt;db_username&gt;</code> သို့မဟုတ် <code className="font-mono text-amber-900">&lt;db_password&gt;</code> စာသားများ မပြောင်းလဲရသေးဘဲ ဖြစ်နေပါသည်။
                    </p>
                    <p>သင်၏ မူရင်း MongoDB Atlas စကားဝှက်နှင့် user id တို့ကို အမှန်တကယ်အစားထိုးရေးသားပေးရန် လိုအပ်ပါသည်။</p>
                  </div>
                )}

                {/* Condition 3: Real URI is present but connecting failed */}
                {dbStatus.uriState === "present" && dbStatus.error && (
                  <div className="text-[11px] text-rose-800 bg-rose-50/70 p-3 rounded-xl border border-rose-100 space-y-1.5">
                    <p className="font-bold text-rose-950">
                      ❌ MongoDB Live Connection Error (ယာယီချိတ်ဆက်မရပါ) -
                    </p>
                    <p className="leading-relaxed">
                      ထည့်သွင်းထားသော URI သို့ ချိတ်ဆက်ရန်ကြိုးစားသော်လည်း အောက်ပါအမှားအယွင်း ဖြစ်ပေါ်နေပါသည် -
                    </p>
                    <div className="bg-white/90 border border-rose-100 font-mono text-[10px] p-2 rounded-lg break-words leading-normal max-h-24 overflow-y-auto">
                      {dbStatus.error}
                    </div>
                    <p className="text-[10px] text-rose-700/90 leading-normal">
                      <strong>အကြံပြုချက်:</strong> သင်၏ Atlas Cluster ဘက်တွင် IP Access List ကို <code className="bg-rose-100/50 px-1 font-bold">0.0.0.0/0</code> (Allow Access from Anywhere) ခွင့်ပြုထားခြင်း ရှိမရှိ စစ်ဆေးပေးပါ။
                    </p>
                  </div>
                )}

                {/* Global Vercel Deployment Guidance */}
                <div className="text-[11px] text-amber-950 leading-relaxed border-t border-amber-200/65 pt-2.5 space-y-1 bg-amber-50/20">
                  <p className="font-extrabold text-amber-950">🌍 လက်ရှိ Vercel Production အခြေအနေလမ်းညွှန် -</p>
                  <p className="text-[10.5px] text-slate-700 font-medium">
                    သင်သည် Vercel Dashboard တွင် <code className="bg-amber-100 px-1 rounded font-mono font-bold">MONGO_URI</code> ကို မှန်ကန်စွာ သတ်မှတ်ထည့်သွင်းပြီးပါက Vercel static/server build သည် အောင်မြင်စွာ အလုပ်လုပ်နေမည် ဖြစ်ပါသည်။
                  </p>
                  <p className="text-[10.5px] text-slate-700 font-semibold bg-amber-100/50 p-2 rounded-md">
                    *အရေးကြီးမှတ်ချက်:* Vercel တွင် env variable ကို Save လုပ်ပြီးသည်နှင့် Variable သစ်များ သက်ရောက်မှုရှိစေရန်အတွက် <strong>Deployments</strong> တက်ဘ်သို့သွားပြီး **Redeploy** (ပြန်လည်ထုတ်လွှင့်မှု) တစ်ကြိမ် ပြုလုပ်ပေးရန် လုံးဝလိုအပ်ပါသည်။
                  </p>
                </div>
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
