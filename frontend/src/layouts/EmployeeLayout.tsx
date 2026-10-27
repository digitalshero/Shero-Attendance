import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, CalendarDays, Clock, Clock4, KeyRound, Eye, EyeOff, X, Lock } from 'lucide-react';
import { AttendanceReminderAndPWA } from '../components/common/AttendanceReminderAndPWA';
import api from '../services/api';
import toast from 'react-hot-toast';

const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  
  // Update Password State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error('Please enter your current password');
      return;
    }
    if (!newPassword.trim()) {
      toast.error('Please enter your new password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setUpdatingPassword(true);
      const res = await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success(res.data.message || 'Password updated successfully!');
      setPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const navItems = [
    { name: 'Attendance', path: '/employee', icon: Clock },
    { name: 'History', path: '/employee/attendance', icon: CalendarDays },
    { name: 'Requests Status', path: '/employee/permissions', icon: Clock4 },
  ];

  const BrandLogo = () => (
    <Link to="/employee" className="flex items-center space-x-3 group">
      <div className="h-9 w-9 shrink-0 bg-slate-50 border border-slate-200/80 rounded-xl shadow-2xs group-hover:scale-105 transition-transform flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Shero Home Food"
          className="h-6 w-auto max-w-[32px] object-contain"
          onError={(e) => {
            const target = e.target as HTMLElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'block';
          }}
        />
        <span className="hidden text-teal-700 font-extrabold text-sm tracking-tight">SHERO</span>
      </div>
      <div>
        <span className="font-bold text-slate-900 text-sm tracking-tight block">Shero Home Food</span>
        <span className="text-[10px] uppercase font-semibold tracking-wider text-teal-600 block -mt-0.5">Staff Portal</span>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans">
      {/* Attendance Reminder and PWA Install Handling */}
      <AttendanceReminderAndPWA />

      {/* Mobile-only Header (brand + password + logout; nav lives in the bottom bar) */}
      <header className="md:hidden bg-white/85 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80 shadow-subtle">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between h-16 items-center">
            <BrandLogo />
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-xl transition-all border border-slate-200/60 hover:border-teal-200 shadow-2xs"
                title="Change Password"
              >
                <KeyRound className="h-4 w-4 text-teal-600" />
              </button>
              <button
                onClick={() => setLogoutModalOpen(true)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200/60 hover:border-rose-100 shadow-2xs"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-slate-200/80 shadow-subtle">
          <div className="px-4 py-5 border-b border-slate-100">
            <BrandLogo />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mr-3 shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="px-3 py-4 border-t border-slate-100 space-y-2">
            <div
              onClick={() => setPasswordModalOpen(true)}
              className="flex items-center pl-3 pr-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs cursor-pointer hover:bg-teal-50/50 hover:border-teal-200 transition-colors"
              title="Click to update password"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center mr-2 text-[11px] shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'E'}
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-slate-800 text-xs leading-none truncate">{user?.name}</p>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{user?.employeeId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="p-2 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-xl transition-all border border-slate-200/60 hover:border-teal-200 flex items-center justify-center gap-1.5 shadow-2xs"
                title="Change Password"
              >
                <KeyRound className="h-3.5 w-3.5 text-teal-600" />
                <span className="text-xs font-semibold">Password</span>
              </button>
              <button
                onClick={() => setLogoutModalOpen(true)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200/60 hover:border-rose-100 flex items-center justify-center gap-1.5 shadow-2xs"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-20 md:pb-8 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fitts's Law Ergonomic Touch Targets) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-lg">
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition-all ${
                  isActive
                    ? 'text-teal-700 bg-teal-50/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setPasswordModalOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition-all text-slate-500 hover:text-slate-800"
          >
            <KeyRound className="w-5 h-5 mb-0.5 text-slate-400" />
            <span>Password</span>
          </button>
        </div>
      </div>

      {/* Update Password Modal */}
      {passwordModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 animate-slide-up flex flex-col my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Update Password</h3>
                  <p className="text-[11px] text-slate-500">Change your portal login credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPasswordModalOpen(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="form-input text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalOpen(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="btn-primary px-5 py-2 text-xs font-bold shadow-glow-teal disabled:opacity-50"
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Logout Confirmation Modal */}
      {logoutModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 animate-slide-up">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-50/50">
              <LogOut className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5">Sign Out</h2>
            <p className="text-xs text-slate-500 mb-6">Are you sure you want to log out from your portal?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EmployeeLayout;
