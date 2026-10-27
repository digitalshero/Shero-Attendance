import React, { useState } from 'react';
import { checkIn, checkOut } from '../../services/attendanceService';
import LiveTimer from './LiveTimer';
import { formatTime, formatDuration } from '../../utils/timeUtils';
import { useAuth } from '../../context/AuthContext';
import { LogIn, LogOut, CheckCircle2, Clock, AlertCircle, Building2, Home } from 'lucide-react';
import toast from 'react-hot-toast';

interface AttendanceCardProps {
  attendance: any;
  onRefresh: () => void;
  isCompanyWfhDay?: boolean;
  companyWfhInfo?: any;
}

const AttendanceCard: React.FC<AttendanceCardProps> = ({ 
  attendance, 
  onRefresh, 
  isCompanyWfhDay, 
  companyWfhInfo 
}) => {
  const { user } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = attendance?.status || 'NOT_CHECKED_IN';
  const isCompanyRemote = Boolean(isCompanyWfhDay || attendance?.isCompanyWfhDay);
  const workMode = attendance?.workMode || (isCompanyRemote ? 'WFH' : (user?.workMode || 'WFO'));
  
  const getCoordinates = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      // 1. Try high accuracy first (GPS / Satellite)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (highAccError) => {
          console.warn('High accuracy GPS timed out or unavailable, falling back to network location...', highAccError);
          // 2. Fallback to standard/network accuracy (Wi-Fi / Cell tower - very reliable indoors on mobile)
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            (lowAccError) => {
              console.error('Mobile location detection failed:', lowAccError);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  };

  // Called when user clicks "SIGN IN"
  const handleCheckInClick = (selectedMode?: 'WFO' | 'WFH') => {
    executeCheckIn(selectedMode);
  };

  const executeCheckIn = async (selectedMode?: 'WFO' | 'WFH') => {
    const actionLabel = selectedMode === 'WFO' ? 'Sign In (WFO)' : selectedMode === 'WFH' ? 'Sign In (WFH)' : 'Sign In';
    setLoadingAction(actionLabel);
    setError(null);
    try {
      const coords = await getCoordinates();
      await checkIn(coords || undefined, undefined, selectedMode);
      toast.success(
        selectedMode === 'WFO'
          ? 'Signed in successfully at Office (WFO)! Have a great day.'
          : 'Signed in successfully! Have a great day.'
      );
      onRefresh();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to sign in';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // Called when user clicks "SIGN OUT FOR TODAY"
  const handleCheckOutClick = () => {
    executeCheckOut();
  };

  const executeCheckOut = async () => {
    setLoadingAction('Sign Out');
    setError(null);
    try {
      await checkOut();
      toast.success('Signed out successfully. Good work today!');
      onRefresh();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to sign out';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const getLastResumeTime = () => {
    if (!attendance || !attendance.events) return undefined;
    const events = attendance.events;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].eventType === 'RESUME' || events[i].eventType === 'CHECK_IN') {
        return events[i].timestamp;
      }
    }
    return undefined;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'WORKING':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-ping"></span>
            <span>WORKING NOW</span>
          </div>
        );
      case 'CHECKED_OUT':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span>SIGNED OUT</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200/80">
            <span className="w-2 h-2 rounded-full bg-slate-400 mr-2"></span>
            <span>NOT SIGNED IN</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            Today's Attendance Cockpit
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Live work timer and attendance state management</p>
        </div>
        <div className="flex items-center gap-2">
          {attendance?.workMode === 'WFO' ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
              <Building2 className="w-3 h-3 mr-1 text-teal-600" />
              WFO Office
            </span>
          ) : isCompanyRemote ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
              <Home className="w-3 h-3 mr-1 text-indigo-600" />
              Company WFH Day
            </span>
          ) : workMode === 'HYBRID' ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              <span className="mr-1 text-xs">🏢+🏠</span>
              Hybrid Flex
            </span>
          ) : workMode === 'WFH' ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Home className="w-3 h-3 mr-1 text-indigo-500" />
              WFH Remote
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
              <Building2 className="w-3 h-3 mr-1 text-teal-600" />
              WFO Office
            </span>
          )}
          {getStatusBadge()}
        </div>
      </div>

      {error && (
        <div className="my-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center text-xs text-rose-700 font-medium">
          <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
          {error}
        </div>
      )}

      {/* State Machine: Not Signed In */}
      {status === 'NOT_CHECKED_IN' ? (
        <div className="text-center py-10 px-4 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-dashed border-slate-200 my-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-teal-50/50">
            <LogIn className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Ready to start your day?</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            {isCompanyRemote
              ? 'Today is an official Company-Wide Work From Home day! You can sign in remotely from home or sign in on WFO if working at the office today.'
              : workMode === 'WFO' 
              ? 'Click below to verify your GPS location at the office and begin tracking your active work hours.'
              : workMode === 'HYBRID'
              ? 'Click below to sign in from anywhere (office or home) and begin tracking your active work hours.'
              : 'Click below to record your official sign-in timestamp and begin tracking your active work hours.'}
          </p>

          {isCompanyRemote ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto mx-auto">
              <button
                onClick={() => handleCheckInClick('WFH')}
                disabled={loadingAction !== null}
                className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all inline-flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>{loadingAction === 'Sign In (WFH)' ? 'Signing In Remotely...' : 'SIGN IN (WFH - HOME)'}</span>
              </button>

              <button
                onClick={() => handleCheckInClick('WFO')}
                disabled={loadingAction !== null}
                className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-glow-teal active:scale-[0.98] transition-all inline-flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>{loadingAction === 'Sign In (WFO)' ? 'Signing In at Office...' : 'SIGN IN ON WFO (OFFICE)'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleCheckInClick()}
              disabled={loadingAction !== null}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-glow-teal active:scale-[0.98] transition-all inline-flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loadingAction === 'Sign In' ? 'Verifying Location & Signing In...' : 'SIGN IN NOW'}</span>
            </button>
          )}
        </div>
      ) : (

        /* State Machine: Active Work Day */
        <div className="space-y-6 my-6">
          {/* Key Metrics Grid (3 Clean Tiles) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            
            {/* Sign In Tile */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sign In Time</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono">
                {formatTime(attendance.checkIn)}
              </p>
            </div>

            {/* Live Working Time Tile */}
            <div className={`p-4 rounded-2xl border transition-all ${
              status === 'WORKING' 
                ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900' 
                : 'bg-slate-50/80 border-slate-100 text-slate-900'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[11px] font-bold uppercase tracking-wider ${status === 'WORKING' ? 'text-emerald-700' : 'text-slate-400'}`}>
                  Working Time
                </p>
                {status === 'WORKING' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                )}
              </div>
              <p className="text-xl font-extrabold font-mono text-emerald-700">
                {status === 'CHECKED_OUT' ? (
                  formatDuration(attendance.totalWorkingSeconds)
                ) : (
                  <LiveTimer 
                    status={status} 
                    initialWorkingSeconds={attendance.totalWorkingSeconds}
                    lastResumeTimestamp={getLastResumeTime()}
                  />
                )}
              </p>
            </div>

            {/* Sign Out Tile */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sign Out Time</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono">
                {status === 'CHECKED_OUT' && attendance.checkOut ? formatTime(attendance.checkOut) : '--:--'}
              </p>
            </div>
          </div>

          {/* Primary Action Button: Sign Out Only */}
          <div className="pt-2">
            {status === 'WORKING' && (
              <div>
                <button
                  onClick={handleCheckOutClick}
                  disabled={loadingAction !== null}
                  className="w-full py-4 px-6 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-glow-teal active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{loadingAction === 'Sign Out' ? 'Signing out...' : 'SIGN OUT FOR TODAY'}</span>
                </button>
              </div>
            )}
            
            {status === 'CHECKED_OUT' && (
              <div className="p-4 bg-slate-50 rounded-2xl text-center border border-slate-200/80 space-y-4">
                <div>
                  <p className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Signed Out
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total active work logged so far: <span className="font-bold text-slate-800">{formatDuration(attendance.totalWorkingSeconds)}</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => handleCheckInClick('WFO')}
                    disabled={loadingAction !== null}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-glow-teal active:scale-[0.98] transition-all inline-flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{loadingAction === 'Sign In (WFO)' ? 'Signing In at Office...' : 'SIGN IN AGAIN (OFFICE)'}</span>
                  </button>

                  <button
                    onClick={() => handleCheckInClick('WFH')}
                    disabled={loadingAction !== null}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all inline-flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    <span>{loadingAction === 'Sign In (WFH)' ? 'Signing In Remotely...' : 'SIGN IN AGAIN (HOME)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
};

export default AttendanceCard;
