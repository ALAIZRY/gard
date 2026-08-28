import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, LogIn, Key, Sparkles, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { loadUserAccounts, UserAccount } from '../utils/userUtils';

interface LoginModalProps {
  onLoginSuccess: (username: string, role: string, permissions?: string[]) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [userAccounts] = useState<UserAccount[]>(() => loadUserAccounts());
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('rama_last_username') || '';
    } catch (e) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = password.trim();

    if (!trimmedUser) {
      setErrorMsg('يرجى إدخال اسم المستخدم.');
      return;
    }

    if (!trimmedPass) {
      setErrorMsg('يرجى إدخال كلمة السر.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Always load absolute freshest user accounts from localStorage
      const latestAccounts = loadUserAccounts();
      const matchedAcc = latestAccounts.find(
        (u) => u.username.toLowerCase() === trimmedUser
      );

      let isValid = false;
      let matchedRole = 'مستخدم النظام';
      let permissions: string[] = [];

      if (matchedAcc) {
        matchedRole = matchedAcc.role;
        permissions = matchedAcc.permissions || [];
        // Check password against account password or saved custom pass or default '123'
        const savedCustomPass = localStorage.getItem(`rama_user_pass_${trimmedUser}`);
        if (savedCustomPass) {
          isValid = savedCustomPass === trimmedPass;
        } else if (matchedAcc.password) {
          isValid = matchedAcc.password === trimmedPass || trimmedPass === '123';
        } else {
          isValid = trimmedPass === '123' || trimmedPass === '123456';
        }
      } else {
        // Fallback for default admin/auditor
        if (trimmedPass === '123' || trimmedPass === '123456') {
          isValid = true;
          matchedRole = trimmedUser === 'admin' ? 'مدير النظام' : 'مراقب مخزني';
        }
      }

      if (isValid) {
        // Save session in sessionStorage
        const sessionData = {
          username: trimmedUser,
          role: matchedRole,
          permissions: permissions,
          loginTime: new Date().toISOString(),
        };

        try {
          sessionStorage.setItem('rama_auth_session', JSON.stringify(sessionData));
          localStorage.removeItem('rama_auth_session');
        } catch (e) {}

        // Save or remove remembered username
        if (rememberMe) {
          localStorage.setItem('rama_last_username', trimmedUser);
        } else {
          localStorage.removeItem('rama_last_username');
        }

        onLoginSuccess(trimmedUser, matchedRole, permissions);
      } else {
        setErrorMsg('اسم المستخدم أو كلمة السر غير صحيحة! جرب كلمة السر الافتراضية: 123');
      }
      setIsLoading(false);
    }, 400);
  };

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md font-['Cairo',sans-serif]">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col my-auto relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Decorative Top Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600"></div>

        <div className="p-5 sm:p-7 space-y-5">

          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                تسجيل الدخول للنظام
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                صيدلية راما - نظام إدارة وجرد الأصناف والمخزون
              </p>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Username Input Field */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 pr-1">
                اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: admin"
                  autoFocus
                  required
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-medium"
                />
              </div>
            </div>

            {/* Password Input Field */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 pr-1">
                كلمة السر
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-emerald-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة السر"
                  required
                  className="w-full pr-10 pl-10 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                  title={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded border-slate-700 bg-slate-800 cursor-pointer"
                />
                <span>تذكر اسم المستخدم</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">كلمة السر الافتراضية: 123</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول إلى النظام</span>
                </>
              )}
            </button>

          </form>

          {/* Quick Preset Accounts Section */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 text-center flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>الحسابات المسجلة للتشغيل السريع:</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {userAccounts.slice(0, 4).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickFill(user.username, user.password || '123')}
                  className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-right transition group cursor-pointer"
                >
                  <p className="text-[11px] font-bold text-slate-200 group-hover:text-emerald-400 truncate">
                    {user.name} ({user.role})
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {user.username} / {user.password || '123'}
                  </p>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 text-center">
          صيدلية راما - نظام محلي آمن 100% بدون حاجة للاتصال بالإنترنت
        </div>

      </div>
    </div>
  );
};
