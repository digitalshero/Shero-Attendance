import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTodayAttendance } from '../../services/attendanceService';
import { Download, Smartphone, X, Clock, LogOut, LogIn, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const AttendanceReminderAndPWA: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Notification Popup State
  const [reminderType, setReminderType] = useState<'SIGN_IN_1013' | 'SIGN_OUT_1913' | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  // Check if standalone (already installed)
  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Request notification permission once user is logged in
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay prompt slightly so page finishes loading
      const timer = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
        toast.success('App installed to your home screen!');
      }
    } else {
      // Check iOS Safari
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIos) {
        setShowIosGuide(true);
      } else {
        toast('To install, tap your browser menu (⋮) and select "Add to Home screen" or "Install App".', {
          icon: '📲',
          duration: 5000,
        });
      }
    }
  };

  // Helper to get current IST time & Day of Week
  const getCurrentIST = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour12: false
    }).formatToParts(now);

    const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const yyyy = parts.find(p => p.type === 'year')?.value || '';
    const mm = parts.find(p => p.type === 'month')?.value || '';
    const dd = parts.find(p => p.type === 'day')?.value || '';
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    // Working days: Monday - Saturday (Sunday is off)
    const isWorkingDay = weekday !== 'Sun';
    
    return { hours, minutes, dateStr, totalMins: hours * 60 + minutes, isWorkingDay };
  };

  // Notification Check loop
  useEffect(() => {
    if (!user) return;

    const checkAttendanceAndRemind = async () => {
      try {
        const { dateStr, totalMins, isWorkingDay } = getCurrentIST();

        // 5:00 PM (17:00 IST = 1020 total minutes) - ONE-TIME WELCOME TEST NOTIFICATION FOR ALL USERS INCLUDING HR
        const welcomeSentKey = 'shero_welcome_notification_5pm_sent';
        if (totalMins >= 1020 && localStorage.getItem(welcomeSentKey) !== 'true') {
          localStorage.setItem(welcomeSentKey, 'true');

          const welcomeTitle = 'Shero Home Food — Welcome! 👋';
          const welcomeBody = 'Welcome to Shero Attendance System! Your attendance and workforce portal is live and ready.';

          // In-App Toast
          toast.success(welcomeBody, {
            duration: 9000,
            icon: '🎉',
          });

          // System / Mobile Push Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const options: any = {
                body: welcomeBody,
                icon: '/logo.png',
                badge: '/logo.png',
                vibrate: [300, 100, 300, 100, 300],
                tag: 'shero-welcome-5pm',
                renotify: true,
                requireInteraction: true,
              };

              if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification(welcomeTitle, options);
              } else {
                new Notification(welcomeTitle, options);
              }
            } catch (e) {
              console.log('Welcome notification trigger error:', e);
            }
          }
        }

        // 5:25 PM (17:25 IST = 1045 total minutes) - ONE-TIME NOTIFICATION FOR ALL USERS INCLUDING HR
        const sentKey525 = 'shero_notification_525pm_sent';
        if (totalMins >= 1045 && localStorage.getItem(sentKey525) !== 'true') {
          localStorage.setItem(sentKey525, 'true');

          const notifTitle525 = 'Shero Home Food — Attendance Portal 🔔';
          const notifBody525 = 'Welcome to Shero Attendance System! Your attendance and workforce portal is live and ready.';

          // In-App Toast
          toast.success(notifBody525, {
            duration: 9000,
            icon: '🔔',
          });

          // System / Mobile Push Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const options: any = {
                body: notifBody525,
                icon: '/logo.png',
                badge: '/logo.png',
                vibrate: [300, 100, 300, 100, 300],
                tag: 'shero-notif-525pm',
                renotify: true,
                requireInteraction: true,
              };

              if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification(notifTitle525, options);
              } else {
                new Notification(notifTitle525, options);
              }
            } catch (e) {
              console.log('5:25 PM Notification trigger error:', e);
            }
          }
        }

        // Employee-specific sign-in/sign-out reminders (skipped for HR/Admin)
        if (user.role === 'ADMIN') return;

        const data = await getTodayAttendance();
        const status = data?.attendance?.status || 'NOT_CHECKED_IN';

        // 10:13 AM Sign-In Reminder: (10:13 IST = 10*60 + 13 = 613 minutes)
        // Trigger ONLY on working days (Mon-Sat) and ONLY between 10:13 AM and 11:30 AM window
        if (isWorkingDay && totalMins >= 613 && totalMins <= 690 && status === 'NOT_CHECKED_IN') {
          const sessionDismissKey = `dismissed_signin_${dateStr}`;
          if (sessionStorage.getItem(sessionDismissKey) !== 'true' && dismissedKey !== sessionDismissKey) {
            setReminderType('SIGN_IN_1013');

            // Send Android/Browser Push Notification if allowed
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                const options: any = {
                  body: 'Still you did not sign in today! Please mark your attendance.',
                  icon: '/logo.png',
                  badge: '/logo.png',
                  vibrate: [300, 100, 300],
                  tag: 'signin-reminder',
                };
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification('Shero Attendance Reminder', options);
                  });
                } else {
                  new Notification('Shero Attendance Reminder', options);
                }
              } catch (e) {
                console.log('Notification trigger error: ', e);
              }
            }
            return;
          }
        }

        // 07:13 PM Sign-Out Reminder: (19:13 IST = 19*60 + 13 = 1153 minutes)
        // Trigger ONLY starting at 7:13 PM (19:13 to 21:00) and if user is currently WORKING
        if (totalMins >= 1153 && totalMins <= 1260 && status === 'WORKING') {
          const sessionDismissKey = `dismissed_signout_${dateStr}`;
          if (sessionStorage.getItem(sessionDismissKey) !== 'true' && dismissedKey !== sessionDismissKey) {
            setReminderType('SIGN_OUT_1913');

            // Send Android/Browser Push Notification if allowed
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                const options: any = {
                  body: 'Still you did not sign out! Please remember to sign out for today.',
                  icon: '/logo.png',
                  badge: '/logo.png',
                  vibrate: [300, 100, 300],
                  tag: 'signout-reminder',
                };
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification('Shero Attendance Reminder', options);
                  });
                } else {
                  new Notification('Shero Attendance Reminder', options);
                }
              } catch (e) {
                console.log('Notification trigger error: ', e);
              }
            }
            return;
          }
        }

        // If status changed to WORKING or CHECKED_OUT, dismiss corresponding reminder
        if (status === 'WORKING' && reminderType === 'SIGN_IN_1013') {
          setReminderType(null);
        }
        if (status === 'CHECKED_OUT' && reminderType === 'SIGN_OUT_1913') {
          setReminderType(null);
        }
      } catch (err) {
        // silent error
      }
    };

    // Run check immediately and every 10 seconds
    checkAttendanceAndRemind();
    const interval = setInterval(checkAttendanceAndRemind, 10000);
    return () => clearInterval(interval);
  }, [user, dismissedKey, reminderType]);

  const handleDismissReminder = () => {
    const { dateStr } = getCurrentIST();
    if (reminderType === 'SIGN_IN_1013') {
      const key = `dismissed_signin_${dateStr}`;
      sessionStorage.setItem(key, 'true');
      setDismissedKey(key);
    } else if (reminderType === 'SIGN_OUT_1913') {
      const key = `dismissed_signout_${dateStr}`;
      sessionStorage.setItem(key, 'true');
      setDismissedKey(key);
    }
    setReminderType(null);
  };

  const handleGoToAttendance = () => {
    handleDismissReminder();
    if (location.pathname !== '/employee') {
      navigate('/employee');
    }
  };

  return (
    <>
      {/* PWA & Realtime Alert Controls (notification permission is requested silently in the background) */}

      {/* iOS Add to Home Screen Instructions Modal */}
      {showIosGuide && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 animate-slide-up space-y-4">
            <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-teal-50/50">
              <Smartphone className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Install on iPhone / iPad</h3>
            <div className="text-xs text-slate-600 text-left space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                <span>Tap the <strong>Share</strong> button at bottom of Safari.</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                <span>Tap <strong>Add</strong> in the top right corner.</span>
              </p>
            </div>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Got It
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 10:13 AM Sign-In Reminder In-App Popup */}
      {reminderType === 'SIGN_IN_1013' && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-amber-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center ring-8 ring-amber-50/50 shrink-0">
                  <Clock className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    10:13 AM Alert
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">Still You Did Not Sign In!</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissReminder}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              It is past 10:13 AM and you have not signed in yet today. Please sign in now to start tracking your working hours and avoid being marked absent or late.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDismissReminder}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Remind Me Later
              </button>
              <button
                type="button"
                onClick={handleGoToAttendance}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-teal-600 hover:from-amber-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In Now</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 07:13 PM Sign-Out Reminder In-App Popup */}
      {reminderType === 'SIGN_OUT_1913' && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-rose-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center ring-8 ring-rose-50/50 shrink-0">
                  <LogOut className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    7:13 PM Shift End Alert
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">Still You Did Not Sign Out!</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissReminder}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              It is past 07:13 PM and your active work timer is still running. Please sign out now to finalize your daily work log and close your attendance session.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDismissReminder}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Remind Me Later
              </button>
              <button
                type="button"
                onClick={handleGoToAttendance}
                className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-teal-600 hover:from-rose-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out Now</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
