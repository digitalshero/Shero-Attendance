import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { getAttendanceByRange, submitRegularization } from '../../services/attendanceService';
import api from '../../services/api';
import { formatTime, formatDuration } from '../../utils/timeUtils';
import { format } from 'date-fns';
import { Calendar, UserCheck, UserX, AlertTriangle, Clock, Clock4, ChevronDown, CalendarDays, Palmtree, Sparkles, Inbox, X, AlertCircle } from 'lucide-react';
import LiveTimer from '../../components/attendance/LiveTimer';
import DateRangeFilter, { type DateRange, getRangeForPreset } from '../../components/common/DateRangeFilter';
import { getMyPermissions } from '../../services/permissionService';
import toast from 'react-hot-toast';

const LATE_THRESHOLD_HOUR = 9;
const LATE_THRESHOLD_MINUTE = 30;
const EARLY_EXIT_HOUR = 18;
const EARLY_EXIT_MINUTE = 0;
const MIN_WORKING_SECONDS = 8 * 3600;

interface ParsedRecord {
  _id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  totalWorkingSeconds: number;
  totalStoppedSeconds: number;
  status: string;
  events: any[];
  lunchStart: string | null;
  lunchEnd: string | null;
  displayStatus: 'Present' | 'Early Exit' | 'Late' | 'Half Day' | 'Working' | 'Leave';
  isHalfDayFlagged?: boolean;
  regularizationStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface Holiday {
  _id?: string;
  name: string;
  date: string;
  type?: string;
  description?: string;
}

const getLunchTimes = (events: any[]) => {
  if (!events || !Array.isArray(events)) return { lunchStart: null, lunchEnd: null };
  const stopEvent = events.find(e => e.eventType === 'STOP');
  const resumeEvent = events.find(e => e.eventType === 'RESUME');
  return {
    lunchStart: stopEvent?.timestamp || null,
    lunchEnd: resumeEvent?.timestamp || null,
  };
};

const getLastResumeTime = (events: any[]) => {
  if (!events || !Array.isArray(events)) return undefined;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].eventType === 'RESUME' || events[i].eventType === 'CHECK_IN') {
      return events[i].timestamp;
    }
  }
  return undefined;
};

const getDisplayStatus = (record: any): ParsedRecord['displayStatus'] => {
  if (record.status === 'WORKING') return 'Working';
  if (record.status === 'STOPPED') return 'Leave';

  const checkIn = record.checkIn ? new Date(record.checkIn) : null;
  const checkOut = record.checkOut ? new Date(record.checkOut) : null;

  const isLate = checkIn &&
    (checkIn.getHours() > LATE_THRESHOLD_HOUR ||
      (checkIn.getHours() === LATE_THRESHOLD_HOUR && checkIn.getMinutes() > LATE_THRESHOLD_MINUTE));

  const isEarlyExit = checkOut &&
    (checkOut.getHours() < EARLY_EXIT_HOUR ||
      (checkOut.getHours() === EARLY_EXIT_HOUR && checkOut.getMinutes() < EARLY_EXIT_MINUTE));

  const isHalfDay = record.totalWorkingSeconds < MIN_WORKING_SECONDS / 2;

  if (isHalfDay) return 'Half Day';
  if (isEarlyExit) return 'Early Exit';
  if (isLate) return 'Late';
  return 'Present';
};

const StatusBadge = ({ status }: { status: ParsedRecord['displayStatus'] }) => {
  const styles: Record<string, string> = {
    Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Early Exit': 'bg-rose-50 text-rose-700 border-rose-200',
    Late: 'bg-amber-50 text-amber-700 border-amber-200',
    'Half Day': 'bg-orange-50 text-orange-700 border-orange-200',
    Working: 'bg-teal-50 text-teal-700 border-teal-200',
    Leave: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AttendanceHistory = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveDaysMonth, setLeaveDaysMonth] = useState(0);
  const [leaveDaysYear, setLeaveDaysYear] = useState(0);
  const [permissionsMonth, setPermissionsMonth] = useState(0);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'LOGS' | 'HOLIDAYS'>('LOGS');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'WFO' | 'WFH' | 'LEAVE' | 'PERMISSION'>('ALL');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>({ preset: 'THIS_MONTH', ...getRangeForPreset('THIS_MONTH') });
  const [regularizeModal, setRegularizeModal] = useState<{ isOpen: boolean; record: ParsedRecord | null; remark: string; submitting: boolean }>({
    isOpen: false,
    record: null,
    remark: '',
    submitting: false,
  });

  const fetchHistoryAndHolidays = async () => {
    try {
      setLoading(true);
      const [attData, holidayRes, leaveRes, requestsData] = await Promise.all([
        getAttendanceByRange(range.startDate, range.endDate),
        api.get('/attendance/holidays').catch(() => ({ data: [] })),
        api.get('/attendance/leave-summary').catch(() => ({ data: { totalLeaveDaysYear: 0, totalLeaveDaysMonth: 0 } })),
        getMyPermissions().catch(() => []),
      ]);

      const parsed: ParsedRecord[] = attData.map((rec: any) => {
        const { lunchStart, lunchEnd } = getLunchTimes(rec.events || []);
        const displayStatus = getDisplayStatus(rec);
        return { ...rec, lunchStart, lunchEnd, displayStatus };
      });
      setRecords(parsed);
      const allHolidays = Array.isArray(holidayRes.data) ? holidayRes.data : (holidayRes.data?.holidays || []);
      setHolidays(allHolidays.filter((h: any) => new Date(h.date + 'T00:00:00').getDay() !== 0));
      setLeaveDaysMonth(leaveRes.data?.totalLeaveDaysMonth || 0);
      setLeaveDaysYear(leaveRes.data?.totalLeaveDaysYear || 0);
      setPermissionsMonth(leaveRes.data?.approvedPermissionsMonth || 0);
      setMyRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (error) {
      console.error('Failed to fetch history', error);
    } finally {
      setLoading(false);
    }
  };

  const [nowTick, setNowTick] = useState(new Date());

  useEffect(() => {
    fetchHistoryAndHolidays();
    const timer = setInterval(() => setNowTick(new Date()), 60000);
    return () => clearInterval(timer);
  }, [range.startDate, range.endDate]);

  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regularizeModal.record || !regularizeModal.remark.trim()) {
      toast.error('Please enter a remark explaining the late sign-out');
      return;
    }
    try {
      setRegularizeModal((prev) => ({ ...prev, submitting: true }));
      await submitRegularization(regularizeModal.record._id, regularizeModal.remark.trim());
      toast.success('Regularization request submitted to your reporting manager!');
      setRegularizeModal({ isOpen: false, record: null, remark: '', submitting: false });
      fetchHistoryAndHolidays();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit regularization request');
      setRegularizeModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const daysPresent = records.length;
  const daysLate = records.filter(r => r.displayStatus === 'Late').length;
  let dynamicTotalSeconds = records.reduce((acc, curr) => acc + curr.totalWorkingSeconds, 0);

  const activeRecord = records.find(r => r.status === 'WORKING');
  if (activeRecord) {
    const lastResume = getLastResumeTime(activeRecord.events);
    if (lastResume) {
      const diff = Math.floor((nowTick.getTime() - new Date(lastResume).getTime()) / 1000);
      dynamicTotalSeconds += Math.max(0, diff);
    }
  }

  // Filtered dataset for the LOGS view
  const displayedRecords = records.filter((r) => {
    if (statusFilter === 'LATE') return r.displayStatus === 'Late';
    if (statusFilter === 'WFO') return (r as any).workMode === 'WFO';
    if (statusFilter === 'WFH') return (r as any).workMode === 'WFH';
    if (statusFilter === 'LEAVE' || statusFilter === 'PERMISSION') return false;
    return true;
  });

  const requestsInRange = myRequests.filter((r) => r.date >= range.startDate && r.date <= range.endDate && r.status !== 'REJECTED');
  const displayedRequests = requestsInRange.filter((r) => {
    if (statusFilter === 'LEAVE') return r.requestType === 'LEAVE';
    if (statusFilter === 'PERMISSION') return r.requestType === 'PERMISSION';
    return false;
  });
  const isRequestsView = statusFilter === 'LEAVE' || statusFilter === 'PERMISSION';

  const StatCard = ({ icon: Icon, value, label, colorClass, bgClass }: any) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-center space-x-3 mb-2">
        <div className={`p-2.5 rounded-xl ${bgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-700 border border-teal-100">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Work Logs & Company Holidays</h1>
            <p className="text-xs text-slate-500 mt-0.5">Historical work logs, leave records, and official company holidays</p>
          </div>
        </div>

        {/* Tab & Month Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
            <button
              type="button"
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'LOGS' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Attendance Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HOLIDAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'HOLIDAYS' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palmtree className="w-3.5 h-3.5 text-teal-600" />
              <span>Shero Holidays ({holidays.length})</span>
            </button>
          </div>

          {activeTab === 'LOGS' && (
            <>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 py-2 pl-3.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
                >
                  <option value="ALL">All</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="WFO">WFO</option>
                  <option value="WFH">WFH</option>
                  <option value="LEAVE">Leave</option>
                  <option value="PERMISSION">Permission</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <DateRangeFilter value={range} onChange={setRange} />
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={UserCheck} value={`${daysPresent} Days`} label="Days Present" colorClass="text-emerald-600" bgClass="bg-emerald-50" />
        <StatCard icon={CalendarDays} value={`${leaveDaysMonth} Days`} label="Days on Leave" colorClass="text-rose-600" bgClass="bg-rose-50" />
        <StatCard icon={AlertTriangle} value={`${daysLate} Days`} label="Late Arrivals" colorClass="text-amber-600" bgClass="bg-amber-50" />
        <StatCard icon={Clock4} value={permissionsMonth} label="Permission" colorClass="text-indigo-600" bgClass="bg-indigo-50" />
        <StatCard icon={Clock} value={formatDuration(dynamicTotalSeconds)} label="Total Logged Time" colorClass="text-teal-600" bgClass="bg-teal-50" />
      </div>

      {activeTab === 'HOLIDAYS' ? (
        /* Company / Office Holidays View */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <Palmtree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Declared Shero Holidays</h3>
                <p className="text-[11px] text-slate-500">Official company calendar and recurring weekly offs</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {holidays.length} Holidays Scheduled
            </span>
          </div>

          {holidays.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              No holidays declared yet by HR.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Holiday Name</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Day of Week</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {holidays.map((h) => {
                    const d = new Date(h.date + 'T00:00:00');
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <tr key={h._id || h.date} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900">{h.name}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-700">{dateFormatted}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-600">{dayName}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            h.type === 'NATIONAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            h.type === 'COMPANY' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            h.type === 'OPTIONAL' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {h.type || 'FESTIVAL'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{h.description || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : isRequestsView ? (
        /* Leave / Permission Requests View */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/75">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Timing</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs">
                      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Loading requests...
                    </td>
                  </tr>
                ) : displayedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Inbox className="w-6 h-6" />
                        <span className="text-xs font-medium">
                          No {statusFilter === 'LEAVE' ? 'leave' : 'permission'} requests found for the selected date range.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">
                        {format(new Date(req.date), 'EEE, MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600">
                        {req.startTime} – {req.endTime}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                        {req.reason || <span className="text-slate-400 italic">No reason specified</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {req.status === 'APPROVED' ? 'Approved' : 'Pending Review'}
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
        /* Work Attendance Logs View */
        <>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/75">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Lunch Break</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Logged Hours</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs">
                    <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading records...
                  </td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">
                    No attendance records found for the selected date range.
                  </td>
                </tr>
              ) : (
                displayedRecords.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">
                      {format(new Date(record.date), 'EEE, MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-slate-700">
                      {formatTime(record.checkIn) || '--:--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">
                      {record.lunchStart ? `${formatTime(record.lunchStart)} - ${formatTime(record.lunchEnd) || 'Active'}` : '--'}
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
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={record.displayStatus} />
                        {record.isHalfDayFlagged && (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">
                              Half Day Leave{record.regularizationStatus === 'PENDING' ? ' · Pending' : record.regularizationStatus === 'REJECTED' ? ' · Rejected' : ''}
                            </span>
                            {(record.regularizationStatus === 'NONE' || record.regularizationStatus === 'REJECTED') && (
                              <button
                                type="button"
                                onClick={() => setRegularizeModal({ isOpen: true, record, remark: '', submitting: false })}
                                className="text-[10px] font-bold text-teal-700 hover:text-teal-800 whitespace-nowrap"
                              >
                                Regularize
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
        {loading ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-card">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : displayedRecords.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-card">
            No records found for the selected date range.
          </div>
        ) : (
          displayedRecords.map((record) => (
            <div key={record._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <p className="font-bold text-slate-900 text-xs">
                  {format(new Date(record.date), 'EEE, MMM d, yyyy')}
                </p>
                <StatusBadge status={record.displayStatus} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl">
                  <p className="text-[10px] font-semibold text-slate-400">Check In</p>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">{formatTime(record.checkIn) || '--:--'}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl">
                  <p className="text-[10px] font-semibold text-slate-400">Check Out</p>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">{formatTime(record.checkOut) || '--:--'}</p>
                </div>
              </div>

              <div className="bg-teal-50/80 p-2.5 rounded-xl flex justify-between items-center border border-teal-100">
                <span className="text-[11px] font-bold text-teal-800">Total Worked</span>
                <span className="font-mono font-extrabold text-xs text-teal-700">
                  {record.status === 'WORKING' ? (
                    <LiveTimer status={record.status} initialWorkingSeconds={record.totalWorkingSeconds} lastResumeTimestamp={getLastResumeTime(record.events)} />
                  ) : (
                    formatDuration(record.totalWorkingSeconds)
                  )}
                </span>
              </div>

              {record.isHalfDayFlagged && (
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                    Half Day Leave{record.regularizationStatus === 'PENDING' ? ' · Pending' : record.regularizationStatus === 'REJECTED' ? ' · Rejected' : ''}
                  </span>
                  {(record.regularizationStatus === 'NONE' || record.regularizationStatus === 'REJECTED') && (
                    <button
                      type="button"
                      onClick={() => setRegularizeModal({ isOpen: true, record, remark: '', submitting: false })}
                      className="text-[10px] font-bold text-teal-700 hover:text-teal-800"
                    >
                      Regularize
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </>
      )}

      {/* Regularization Request Modal */}
      {regularizeModal.isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 animate-slide-up flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-3xl">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Regularize Half Day Leave</h3>
                <p className="text-[11px] text-slate-500">
                  {regularizeModal.record && format(new Date(regularizeModal.record.date), 'EEE, MMM d, yyyy')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegularizeModal({ isOpen: false, record: null, remark: '', submitting: false })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRegularization} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  You signed out at <strong>{regularizeModal.record ? formatTime(regularizeModal.record.checkOut) : ''}</strong>, after 8:00 PM, so this day was auto-marked as Half Day Leave.
                  Explain why below and your reporting manager will review it. You can regularize up to 3 days per month.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Remark <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Was completing a client deliverable, forgot to sign out earlier..."
                  value={regularizeModal.remark}
                  onChange={(e) => setRegularizeModal((prev) => ({ ...prev, remark: e.target.value }))}
                  className="form-input text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRegularizeModal({ isOpen: false, record: null, remark: '', submitting: false })}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regularizeModal.submitting}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-60"
                >
                  {regularizeModal.submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AttendanceHistory;
