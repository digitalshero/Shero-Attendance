import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatTime, formatDuration } from '../../utils/timeUtils';
import { format } from 'date-fns';
import { Calendar, UserCheck, AlertTriangle, Clock, Clock4, Palmtree, ArrowLeft, ChevronDown, Search, Users, User, X } from 'lucide-react';
import LiveTimer from '../../components/attendance/LiveTimer';
import toast from 'react-hot-toast';
import DateRangeFilter, { type DateRange, getRangeForPreset } from '../../components/common/DateRangeFilter';
import { getTeamPermissions } from '../../services/permissionService';

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

const getCheckInCount = (events: any[]) => {
  if (!events || !Array.isArray(events)) return 0;
  return events.filter((e) => e.eventType === 'CHECK_IN').length;
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

const AdminEmployeeAttendance = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>({ preset: 'THIS_MONTH', ...getRangeForPreset('THIS_MONTH') });
  const [employeeName, setEmployeeName] = useState<string>('');
  const [leaveCount, setLeaveCount] = useState(0);
  const [permissionCount, setPermissionCount] = useState(0);

  // Switcher state
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all employees for switcher
  useEffect(() => {
    const fetchEmployeesList = async () => {
      try {
        const res = await api.get('/admin/employees');
        setEmployees(res.data || []);
      } catch (err) {
        // silent
      }
    };
    fetchEmployeesList();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const [res, teamRequests] = await Promise.all([
        api.get(`/admin/employees/${id}/attendance`),
        getTeamPermissions().catch(() => []),
      ]);
      const allRecords: any[] = res.data;

      const filtered = allRecords.filter(r => {
        const d = format(new Date(r.date), 'yyyy-MM-dd');
        return d >= range.startDate && d <= range.endDate;
      });

      const parsed: ParsedRecord[] = filtered.map((rec: any) => {
        const { lunchStart, lunchEnd } = getLunchTimes(rec.events || []);
        const displayStatus = getDisplayStatus(rec);
        return { ...rec, lunchStart, lunchEnd, displayStatus };
      });
      setRecords(parsed);

      const employeeRequests = (Array.isArray(teamRequests) ? teamRequests : []).filter((r: any) =>
        r.employeeId === id && r.status !== 'REJECTED' && r.date >= range.startDate && r.date <= range.endDate
      );
      setLeaveCount(employeeRequests.filter((r: any) => r.requestType === 'LEAVE').length);
      setPermissionCount(employeeRequests.filter((r: any) => r.requestType === 'PERMISSION').length);

      if (allRecords.length > 0 && allRecords[0].user) {
        setEmployeeName(allRecords[0].user.name);
      }
    } catch (error) {
      console.error('Failed to fetch employee attendance history', error);
      toast.error('Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const [nowTick, setNowTick] = useState(new Date());

  useEffect(() => {
    fetchHistory();
    const timer = setInterval(() => setNowTick(new Date()), 60000);
    return () => clearInterval(timer);
  }, [id, range.startDate, range.endDate]);

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

  const currentEmp = employees.find(e => e.employeeId === id || e._id === id);
  const currentDisplayName = currentEmp?.name || employeeName || `Employee ${id}`;

  const filteredEmployeesList = employees.filter(e => 
    e.name.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchEmployeeQuery.toLowerCase())
  );

  const handleSelectEmployee = (emp: any) => {
    setSwitcherOpen(false);
    setSearchEmployeeQuery('');
    navigate(`/admin/employees/${emp.employeeId}/attendance`);
  };

  const StatCard = ({ icon: Icon, value, label, colorClass, bgClass }: any) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-center space-x-3 mb-2">
        <div className={`p-2.5 rounded-xl ${bgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/employees')}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200/80 transition-colors"
            title="Back to employee master"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{currentDisplayName}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendance Logs • ID: <span className="font-mono font-bold text-teal-700">{id}</span>
            </p>
          </div>
        </div>

        {/* Controls: Employee Switcher & Month Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Switch Employee Dropdown & Search Bar */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Switch Employee</span>
              <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
            </button>

            {switcherOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-slide-up space-y-2">
                {/* Search Bar inside dropdown */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search name or ID..."
                    value={searchEmployeeQuery}
                    onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
                  />
                  {searchEmployeeQuery && (
                    <button
                      onClick={() => setSearchEmployeeQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Employee List */}
                <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-slate-50">
                  {filteredEmployeesList.length === 0 ? (
                    <p className="text-center py-4 text-xs text-slate-400">No employees found</p>
                  ) : (
                    filteredEmployeesList.map((emp) => {
                      const isSelected = emp.employeeId === id || emp._id === id;
                      return (
                        <button
                          key={emp._id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-slate-900">{emp.name}</p>
                            <p className="text-[10px] font-mono text-slate-500">{emp.employeeId}</p>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                            emp.workMode === 'HYBRID' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            emp.workMode === 'WFH' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-teal-50 text-teal-700 border-teal-200'
                          }`}>
                            {emp.workMode || 'WFO'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date Range Filter */}
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={UserCheck} value={`${daysPresent} Days`} label="Days Present" colorClass="text-emerald-600" bgClass="bg-emerald-50" />
        <StatCard icon={AlertTriangle} value={`${daysLate} Days`} label="Late Check-ins" colorClass="text-amber-600" bgClass="bg-amber-50" />
        <StatCard icon={Palmtree} value={leaveCount} label="Leave" colorClass="text-rose-600" bgClass="bg-rose-50" />
        <StatCard icon={Clock4} value={permissionCount} label="Permission" colorClass="text-indigo-600" bgClass="bg-indigo-50" />
        <StatCard icon={Clock} value={formatDuration(dynamicTotalSeconds)} label="Total Logged Hours" colorClass="text-teal-600" bgClass="bg-teal-50" />
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/75">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Lunch Break</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Working Duration</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs">
                    <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading attendance history...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">
                    No attendance records found for the selected date range.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{format(new Date(record.date), 'EEE, MMM d, yyyy')}</span>
                        {getCheckInCount(record.events) > 1 && (
                          <span
                            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap"
                            title={`Signed in ${getCheckInCount(record.events)} times this day`}
                          >
                            {getCheckInCount(record.events)}× Sign-in
                          </span>
                        )}
                      </div>
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
                      <StatusBadge status={record.displayStatus} />
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
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-card">
            Loading...
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-card">
            No attendance records found for the selected date range.
          </div>
        ) : (
          records.map((record) => (
            <div key={record._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-900 text-xs">
                    {format(new Date(record.date), 'EEE, MMM d, yyyy')}
                  </p>
                  {getCheckInCount(record.events) > 1 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                      {getCheckInCount(record.events)}× Sign-in
                    </span>
                  )}
                </div>
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
                <span className="text-[11px] font-bold text-teal-800">Working Duration</span>
                <span className="font-mono font-extrabold text-xs text-teal-700">
                  {record.status === 'WORKING' ? (
                    <LiveTimer status={record.status} initialWorkingSeconds={record.totalWorkingSeconds} lastResumeTimestamp={getLastResumeTime(record.events)} />
                  ) : (
                    formatDuration(record.totalWorkingSeconds)
                  )}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminEmployeeAttendance;
