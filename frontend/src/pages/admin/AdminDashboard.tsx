import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { formatDuration, formatTime } from '../../utils/timeUtils';
import { getFileUrl } from '../../utils/fileUrl';
import { format, subDays } from 'date-fns';
import { UserCheck, UserX, Users, Clock, LogOut, Loader2, Clock4, Sparkles, Inbox, Calendar, ChevronDown, Paperclip } from 'lucide-react';
import LiveTimer from '../../components/attendance/LiveTimer';

type DashboardDatePreset = 'TODAY' | 'YESTERDAY' | 'DAY_BEFORE_YESTERDAY' | 'CUSTOM';

const DASHBOARD_DATE_LABELS: Record<DashboardDatePreset, string> = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  DAY_BEFORE_YESTERDAY: 'Day Before Yesterday',
  CUSTOM: 'Custom Range',
};

const getDashboardDateForPreset = (preset: DashboardDatePreset, customDate?: string) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  switch (preset) {
    case 'YESTERDAY':
      return format(subDays(new Date(), 1), 'yyyy-MM-dd');
    case 'DAY_BEFORE_YESTERDAY':
      return format(subDays(new Date(), 2), 'yyyy-MM-dd');
    case 'CUSTOM':
      return customDate || today;
    default:
      return today;
  }
};

const DASHBOARD_DATE_PRESET_ORDER: DashboardDatePreset[] = ['TODAY', 'YESTERDAY', 'DAY_BEFORE_YESTERDAY', 'CUSTOM'];

const DashboardDateFilter = ({ preset, date, onChange }: { preset: DashboardDatePreset; date: string; onChange: (preset: DashboardDatePreset, date: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState(date);

  const selectPreset = (p: DashboardDatePreset) => {
    if (p === 'CUSTOM') return;
    onChange(p, getDashboardDateForPreset(p));
    setOpen(false);
  };

  const applyCustom = () => {
    onChange('CUSTOM', customDate);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 py-2.5 px-3.5 transition-all"
      >
        <Calendar className="w-3.5 h-3.5 text-teal-600" />
        <span>{DASHBOARD_DATE_LABELS[preset]}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 p-2">
          {DASHBOARD_DATE_PRESET_ORDER.filter((p) => p !== 'CUSTOM').map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => selectPreset(p)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                preset === p ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {DASHBOARD_DATE_LABELS[p]}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-2 px-1 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Custom Date</p>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5"
            />
            <button
              type="button"
              onClick={applyCustom}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-1.5 rounded-xl transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyRow = ({ colSpan, message }: { colSpan: number; message: string }) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <Inbox className="w-6 h-6" />
        <span className="text-xs font-medium">{message}</span>
      </div>
    </td>
  </tr>
);

const getLastResumeTime = (events: any[]) => {
  if (!events || !Array.isArray(events)) return undefined;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].eventType === 'RESUME' || events[i].eventType === 'CHECK_IN') {
      return events[i].timestamp;
    }
  }
  return undefined;
};

const getCheckInCount = (events: any[]) => {
  if (!events || !Array.isArray(events)) return 0;
  return events.filter((e) => e.eventType === 'CHECK_IN').length;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'WORKING':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
          WORKING
        </span>
      );
    case 'STOPPED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          ON LEAVE
        </span>
      );
    case 'CHECKED_OUT':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          CHECKED OUT
        </span>
      );
    case 'ABSENT':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          ON LEAVE
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
          {status}
        </span>
      );
  }
};

const calculateShiftDuration = (start: string, end: string) => {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '';
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m > 0 ? `${m}m` : ''} shift`;
};

const AdminDashboard = () => {
  const [summary, setSummary] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DashboardDatePreset>('TODAY');
  const [snapshotDate, setSnapshotDate] = useState(getDashboardDateForPreset('TODAY'));

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [summaryRes, attendanceRes] = await Promise.all([
        api.get(`/admin/dashboard?date=${snapshotDate}`),
        api.get(`/admin/attendance?date=${snapshotDate}`)
      ]);
      setSummary(summaryRes.data);
      setAttendance(attendanceRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [snapshotDate]);

  // Status filter (Present / Late / Permission / Signed Out / Leave) and work-mode toggle (All / WFO / WFH)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'PERMISSIONS' | 'SIGNED_OUT' | 'LEAVE'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'WFO' | 'WFH'>('ALL');

  const SummaryCard = ({ title, value, icon: Icon, colorClass, bgClass }: any) => (
    <div className="w-full text-left p-5 rounded-2xl border bg-white border-slate-200/80 shadow-card relative overflow-hidden">
      <div className="flex items-center space-x-3 mb-2">
        <div className={`p-2.5 rounded-xl ${bgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
      </div>
      <p className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{value}</p>
    </div>
  );

  const matchesMode = (workMode: string | undefined) =>
    modeFilter === 'ALL' || (workMode || 'WFO') === modeFilter;

  const absentList = summary?.absentList || [];
  const permissionList = (summary?.permissionList || []).filter((p: any) => matchesMode(p.workMode));

  // "All Staff" should list everyone, not just those who checked in — merge in on-leave staff as well
  const absentRows = absentList.map((emp: any) => ({
    _id: `absent-${emp.employeeId}`,
    employeeId: emp.employeeId,
    user: { name: emp.name, employeeId: emp.employeeId, workMode: emp.workMode },
    checkIn: null,
    checkOut: null,
    status: 'ABSENT',
    totalWorkingSeconds: 0,
    events: [],
    isLate: false,
  }));
  const allStaffRows: any[] = statusFilter === 'ALL' ? [...attendance, ...absentRows] : statusFilter === 'LEAVE' ? absentRows : attendance;

  // Filtered dataset calculation
  const displayedAttendance = allStaffRows.filter((rec) => {
    if (!matchesMode(rec.user?.workMode)) return false;
    if (statusFilter === 'LATE') return rec.isLate;
    if (statusFilter === 'SIGNED_OUT') return rec.status === 'CHECKED_OUT';
    return true;
  });
  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div>
          <div className="inline-flex items-center space-x-1.5 bg-teal-50 px-2.5 py-0.5 rounded-full text-xs font-bold text-teal-700 border border-teal-100 mb-1.5">
            {loading && summary ? (
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" title="Refreshing live data…" />
            ) : (
              <Sparkles className="w-3 h-3 text-teal-600" />
            )}
            <span>{loading && summary ? 'Updating…' : 'Real-time Operational Telemetry'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Executive Attendance Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live headcount monitoring and active logs</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 py-2.5 pl-3.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            >
              <option value="ALL">All Staff</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="PERMISSIONS">Permission</option>
              <option value="SIGNED_OUT">Signed Out</option>
              <option value="LEAVE">Leave</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
            {(['ALL', 'WFO', 'WFH'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setModeFilter(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modeFilter === mode ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode === 'ALL' ? 'All' : mode}
              </button>
            ))}
          </div>

          <DashboardDateFilter
            preset={datePreset}
            date={snapshotDate}
            onChange={(preset, newDate) => { setDatePreset(preset); setSnapshotDate(newDate); }}
          />
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Primary Metric Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <SummaryCard
              title="Present"
              value={summary?.present || 0}
              icon={UserCheck}
              colorClass="text-emerald-600"
              bgClass="bg-emerald-50"
            />
            <SummaryCard
              title="Late Today"
              value={summary?.lateToday || 0}
              icon={Clock}
              colorClass="text-amber-600"
              bgClass="bg-amber-50"
            />
            <SummaryCard
              title="Permissions"
              value={summary?.permissionCount || 0}
              icon={Clock4}
              colorClass="text-indigo-600"
              bgClass="bg-indigo-50"
            />
            <SummaryCard
              title="Leave"
              value={summary?.absent || 0}
              icon={UserX}
              colorClass="text-rose-600"
              bgClass="bg-rose-50"
            />
            <SummaryCard
              title="Signed Out"
              value={summary?.checkedOut || 0}
              icon={LogOut}
              colorClass="text-slate-600"
              bgClass="bg-slate-100"
            />
          </div>



          {statusFilter === 'PERMISSIONS' ? (
            /* VIEW: PERMISSIONS / WFH REQUESTS */
            <div className="bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden animate-fade-in">
              <div className="px-6 py-4 border-b border-slate-100 bg-indigo-50/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock4 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Permissions & WFH Requests Today ({permissionList.length})
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/75">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Request Type</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Timing / Reason</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permissionList.length === 0 ? (
                      <EmptyRow colSpan={4} message="No permissions or WFH requests for this date." />
                    ) : (
                      permissionList.map((p: any) => (
                        <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link to={`/admin/employees/${p.employeeId}/attendance`} className="flex items-center space-x-3 group">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs border border-indigo-100">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{p.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{p.employeeId}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {p.requestType}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            <div>
                              {p.startTime && p.endTime && (
                                <span className="font-mono font-bold text-slate-800 mr-2">
                                  {p.startTime} - {p.endTime}
                                </span>
                              )}
                              <span>{p.reason || 'No reason specified'}</span>
                            </div>
                            {p.attachmentUrl && (
                              <a
                                href={getFileUrl(p.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-800 mt-1"
                              >
                                <Paperclip className="w-3 h-3" /> {p.attachmentName || 'View Document'}
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              p.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              p.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VIEW: ATTENDANCE LOGS (ALL / PRESENT / LATE / SIGNED_OUT) */
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/75">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Sign In</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Sign Out</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Working Duration</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedAttendance.length === 0 ? (
                        <EmptyRow colSpan={5} message="No attendance records match this selection." />
                      ) : (
                        displayedAttendance.map((record) => (
                          <tr key={record._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Link to={`/admin/employees/${record.employeeId}/attendance`} className="flex items-center space-x-3 group">
                                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center text-xs border border-teal-100">
                                  {(record.user?.name || record.employeeId).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{record.user?.name || record.employeeId}</span>
                                    {getCheckInCount(record.events) > 1 && (
                                      <span
                                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap"
                                        title={`Signed in ${getCheckInCount(record.events)} times today`}
                                      >
                                        {getCheckInCount(record.events)}× Sign-in
                                      </span>
                                    )}
                                  </div>
                                  {record.user && <div className="text-[10px] text-slate-400 font-mono">{record.user.employeeId}</div>}
                                </div>
                              </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <span>{formatTime(record.checkIn) || '--:--'}</span>
                                {record.isLate && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                    LATE
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-slate-700">
                              {formatTime(record.checkOut) || '--:--'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-teal-700">
                              {record.status === 'WORKING' ? (
                                <LiveTimer status={record.status} initialWorkingSeconds={record.totalWorkingSeconds} lastResumeTimestamp={getLastResumeTime(record.events)} />
                              ) : (
                                formatDuration(record.totalWorkingSeconds)
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              {getStatusBadge(record.status)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden space-y-3">
                {displayedAttendance.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-card">
                    No matching attendance records.
                  </div>
                ) : (
                  displayedAttendance.map((record) => (
                    <div key={record._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-3">
                      <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                        <Link to={`/admin/employees/${record.employeeId}/attendance`}>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-xs">{record.user?.name || record.employeeId}</p>
                            {getCheckInCount(record.events) > 1 && (
                              <span
                                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap"
                                title={`Signed in ${getCheckInCount(record.events)} times today`}
                              >
                                {getCheckInCount(record.events)}× Sign-in
                              </span>
                            )}
                          </div>
                          {record.user && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{record.user.employeeId}</p>}
                        </Link>
                        {getStatusBadge(record.status)}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 rounded-xl p-2">
                          <p className="text-[10px] text-slate-400 mb-0.5">Sign In</p>
                          <div className="flex flex-col items-center">
                            <p className="font-mono font-bold text-slate-800">{formatTime(record.checkIn) || '—'}</p>
                            {record.isLate && (
                              <span className="mt-0.5 px-1.5 py-0.2 rounded text-[8px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                LATE
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2">
                          <p className="text-[10px] text-slate-400 mb-0.5">Sign Out</p>
                          <p className="font-mono font-bold text-slate-800">{formatTime(record.checkOut) || '—'}</p>
                        </div>
                        <div className="bg-teal-50 rounded-xl p-2 border border-teal-100">
                          <p className="text-[10px] text-teal-600 mb-0.5 font-bold">Working</p>
                          <p className="font-mono font-extrabold text-teal-800">
                            {record.status === 'WORKING' ? (
                              <LiveTimer status={record.status} initialWorkingSeconds={record.totalWorkingSeconds} lastResumeTimestamp={getLastResumeTime(record.events)} />
                            ) : (
                              formatDuration(record.totalWorkingSeconds)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}

    </div>
  );
};

export default AdminDashboard;
