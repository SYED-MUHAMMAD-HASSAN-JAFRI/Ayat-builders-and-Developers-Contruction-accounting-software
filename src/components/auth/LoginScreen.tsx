import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AYAT_LOGO_PATH } from '../common/Header';
import { Lock, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await login({ username: username.trim(), password: password.trim() });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError('');
    setIsSubmitting(true);
    try {
      await login({ username: user, password: pass });
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        {/* App Branding */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-3 p-2 shadow-sm overflow-hidden">
            <img
              src={AYAT_LOGO_PATH}
              alt="AYAT Builders & Developers"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#082F60]">
            AYAT BUILDERS
          </h1>
          <p className="text-xs font-semibold text-[#164B8A] mt-0.5">
            Builders &amp; Developers
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            Building Dreams. Managing Progress.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#172B4D] mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or builder"
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#F7F9FC] border border-slate-300 rounded-lg text-[#172B4D] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164B8A] focus:border-[#164B8A] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#172B4D] mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#F7F9FC] border border-slate-300 rounded-lg text-[#172B4D] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164B8A] focus:border-[#164B8A] text-sm"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 bg-[#082F60] hover:bg-[#164B8A] disabled:bg-slate-400 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                'Signing in...'
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins for Testing on Site */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 text-center mb-3">
              Quick One-Tap Sign In:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'admin123')}
                className="py-2 px-3 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-center transition-colors"
              >
                Admin (admin123)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('builder', 'builder123')}
                className="py-2 px-3 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-center transition-colors"
              >
                User (builder123)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
