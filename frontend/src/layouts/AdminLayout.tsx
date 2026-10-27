import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, CalendarDays, Menu, X, Settings, Clock4, ShieldCheck, ChevronDown, Clock, MapPin, Home, Calendar, Briefcase, FileBarChart } from 'lucide-react';
import { AttendanceReminderAndPWA } from '../components/common/AttendanceReminderAndPWA';

const settingsSubItems = [
  { label: 'Shift & Timings', tab: 'timings', icon: Clock },
  { label: 'Office Geofence', tab: 'geofence', icon: MapPin },
  { label: 'Company WFH Days', tab: 'wfh', icon: Home },
  { label: 'Holidays Calendar', tab: 'holidays', icon: Calendar },
  { label: 'Departments', tab: 'departments', icon: Briefcase },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const isOnSettings = location.pathname === '/admin/settings';
  const [settingsOpen, setSettingsOpen] = useState(isOnSettings);
  const activeSettingsTab = searchParams.get('tab') || 'timings';

  React.useEffect(() => {
    if (isOnSettings) setSettingsOpen(true);
  }, [isOnSettings]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: CalendarDays },
    { name: 'Employees', path: '/admin/employees', icon: Users },
    { name: 'Employee Requests', path: '/admin/permissions', icon: Clock4 },
    { name: 'Monthly Report', path: '/admin/reports', icon: FileBarChart },
  ];

  const BrandLogo = () => (
    <Link to="/admin" className="flex items-center space-x-3 group">
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
        <span className="text-[10px] uppercase font-semibold tracking-wider text-teal-600 block -mt-0.5">Admin Workspace</span>
      </div>
    </Link>
  );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.name}
            to={item.path}
            onClick={onNavigate}
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

      {/* Settings — expandable dropdown with sub-sections */}
      <div>
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
            isOnSettings
              ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Settings className={`w-4 h-4 mr-3 shrink-0 ${isOnSettings ? 'text-teal-600' : 'text-slate-400'}`} />
          <span className="flex-1 text-left">Settings</span>
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${settingsOpen ? 'rotate-180' : ''} ${isOnSettings ? 'text-teal-600' : 'text-slate-400'}`} />
        </button>
        {settingsOpen && (
          <div className="mt-1 ml-4 pl-3 border-l border-slate-200 space-y-0.5">
            {settingsSubItems.map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive = isOnSettings && activeSettingsTab === sub.tab;
              return (
                <Link
                  key={sub.tab}
                  to={`/admin/settings?tab=${sub.tab}`}
                  onClick={onNavigate}
                  className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isSubActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <SubIcon className={`w-3.5 h-3.5 mr-2 shrink-0 ${isSubActive ? 'text-teal-600' : 'text-slate-400'}`} />
                  {sub.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );

  const UserProfileCard = () => (
    <div className="flex items-center pl-3 pr-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
      <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center mr-2 text-[11px] shrink-0">
        {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
      </div>
      <div className="mr-2 text-left min-w-0">
        <p className="font-semibold text-slate-800 text-xs leading-none truncate">{user?.name}</p>
        <p className="text-[10px] text-teal-600 font-medium flex items-center mt-0.5">
          <ShieldCheck className="w-2.5 h-2.5 mr-0.5 shrink-0" /> Administrator
        </p>
      </div>
      <button
        onClick={() => setLogoutModalOpen(true)}
        className="ml-auto p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100 shrink-0"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans">
      {/* Utility Bar (notification prompt) — only renders when there's something to show */}
      <AttendanceReminderAndPWA />

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-slate-200/80 shadow-subtle">
          <div className="px-4 py-5 border-b border-slate-100">
            <BrandLogo />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks />
          </div>
          <div className="px-3 py-4 border-t border-slate-100">
            <UserProfileCard />
          </div>
        </aside>

        {/* Mobile Top Bar */}
        <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-subtle">
          <div className="flex items-center justify-between h-16 px-4">
            <BrandLogo />
            <button
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Sidebar Drawer */}
        {mobileOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 animate-fade-in"
              onClick={() => setMobileOpen(false)}
            />
            <div className="md:hidden fixed top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-white z-50 shadow-2xl flex flex-col animate-slide-up">
              <div className="px-4 py-5 border-b border-slate-100 flex items-center justify-between">
                <BrandLogo />
                <button
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="px-3 py-4 border-t border-slate-100">
                <UserProfileCard />
              </div>
            </div>
          </>
        )}

        {/* Main Container */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-8 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {logoutModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 animate-slide-up">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-50/50">
              <LogOut className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5">Sign Out</h2>
            <p className="text-xs text-slate-500 mb-6">Are you sure you want to end your current session?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Stay Logged In
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

export default AdminLayout;
