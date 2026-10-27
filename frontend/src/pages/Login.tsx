import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Auto redirect if user already has an active session
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/employee', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const data = await login(identifier, password);
      if (data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/employee');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please check your email or employee ID.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7fbf9] text-slate-800 relative flex flex-col justify-between overflow-x-hidden select-none font-sans">
      {/* Top-Left Organic Curved Accent */}
      <div className="absolute -top-24 -left-24 w-80 h-80 sm:w-96 sm:h-96 bg-[#e1f3ec] rounded-full blur-2xl pointer-events-none opacity-80"></div>

      {/* Bottom-Right Organic Wave & Leaf Accent */}
      <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-[#d8eee5] rounded-full blur-3xl pointer-events-none opacity-80"></div>
      
      {/* Decorative Botanical Leaf Branch SVG on Bottom Right */}
      <svg
        className="absolute bottom-0 right-0 w-44 sm:w-60 h-auto pointer-events-none select-none text-[#568275] opacity-75 z-0"
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M240 240C200 220 160 180 140 130C130 105 132 80 140 50"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="opacity-40"
        />
        {/* Leaf 1 */}
        <path
          d="M140 130C110 125 90 95 100 70C125 75 145 105 140 130Z"
          fill="currentColor"
          className="opacity-60"
        />
        {/* Leaf 2 */}
        <path
          d="M170 170C140 175 125 150 135 125C160 130 175 155 170 170Z"
          fill="currentColor"
          className="opacity-50"
        />
        {/* Leaf 3 */}
        <path
          d="M190 200C165 215 145 195 160 170C185 175 200 190 190 200Z"
          fill="currentColor"
          className="opacity-60"
        />
        {/* Leaf 4 */}
        <path
          d="M140 50C130 25 150 10 170 20C175 45 155 55 140 50Z"
          fill="currentColor"
          className="opacity-70"
        />
        {/* Leaf 5 */}
        <path
          d="M135 90C110 80 115 55 135 55C150 70 145 85 135 90Z"
          fill="currentColor"
          className="opacity-55"
        />
      </svg>

      {/* Top Header Bar */}
      <header className="px-6 py-6 sm:px-12 sm:py-8 flex justify-end z-10">
        <div className="text-right">
          <p className="text-xs sm:text-[13px] font-medium text-slate-500 leading-tight">
            Better People
          </p>
          <p className="text-xs sm:text-[13px] font-medium text-slate-500 leading-tight">
            Better Tomorrow
          </p>
          <div className="w-8 h-[2.5px] bg-[#147a6f] rounded-full mt-1.5 ml-auto"></div>
        </div>
      </header>

      {/* Main Centered Login Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-4 z-10 w-full max-w-[440px] mx-auto">
        {/* Shero Brand Logo */}
        <div className="flex flex-col items-center justify-center mb-1">
          <div className="flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Shero Home Food"
              className="h-14 sm:h-16 w-auto max-w-[200px] object-contain"
              onError={(e) => {
                const target = e.target as HTMLElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            {/* Elegant SVG Fallback if image fails */}
            <div className="hidden flex-col items-center justify-center">
              <span className="text-3xl font-serif font-extrabold text-[#147a6f] tracking-wide">
                <span className="text-rose-500 text-lg align-top">● </span>Shero
              </span>
            </div>
          </div>
          <p className="text-[11px] font-bold tracking-[0.26em] text-slate-500 uppercase mt-2 text-center">
            ATTENDANCE SYSTEM
          </p>
        </div>

        {/* Welcome Back Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-7 mb-1.5 text-center flex items-center justify-center gap-2">
          Welcome Back <span className="text-2xl">👋</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 text-center mb-7">
          Login to your account to continue
        </p>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Email or Employee ID */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-white/90 shadow-2xs focus-within:border-[#147a6f] focus-within:ring-2 focus-within:ring-[#147a6f]/15 focus-within:bg-white transition-all">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
              <Mail className="w-5 h-5 stroke-[1.75]" />
            </div>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or Employee ID"
              className="w-full pl-12 pr-4 py-3.5 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none rounded-2xl"
            />
          </div>

          {/* Password */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-white/90 shadow-2xs focus-within:border-[#147a6f] focus-within:ring-2 focus-within:ring-[#147a6f]/15 focus-within:bg-white transition-all">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-5 h-5 stroke-[1.75]" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-12 pr-12 py-3.5 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none rounded-2xl"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 stroke-[1.75]" />
              ) : (
                <Eye className="w-5 h-5 stroke-[1.75]" />
              )}
            </button>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between pt-1 pb-1 px-1">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#147a6f] focus:ring-[#147a6f] border-slate-300 accent-[#147a6f] cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700">
                Remember me
              </span>
            </label>

            <button
              type="button"
              onClick={() => toast('Please contact your HR administrator to reset your credentials.', { icon: 'ℹ️' })}
              className="text-xs sm:text-sm font-medium text-[#147a6f] hover:text-[#0f635a] hover:underline transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium animate-shake text-center">
              {error}
            </div>
          )}

          {/* Submit Login Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#147a6f] hover:bg-[#0f635a] active:scale-[0.99] text-white font-bold text-sm sm:text-base transition-all shadow-md shadow-[#147a6f]/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none mt-2"
          >
            {isSubmitting ? (
              <span>Logging in...</span>
            ) : (
              <>
                <span>Login</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials Assistant */}
        <div className="w-full mt-6 pt-5 border-t border-slate-200/60 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIdentifier('admin@company.com');
              setPassword('admin123');
              setError('');
            }}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-[#147a6f]/10 hover:text-[#147a6f] hover:border-[#147a6f]/30 transition-all"
          >
            Admin Demo
          </button>
          <button
            type="button"
            onClick={() => {
              setIdentifier('employee1@company.com');
              setPassword('emp123');
              setError('');
            }}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-[#147a6f]/10 hover:text-[#147a6f] hover:border-[#147a6f]/30 transition-all"
          >
            Employee Demo
          </button>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="px-6 py-6 text-center z-10">
        <p className="text-xs text-slate-500 font-medium">
          © 2025 Shero International Limited
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Empowering Opportunities. Creating Impact.
        </p>
      </footer>
    </div>
  );
};

export default Login;
