import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { FileBarChart, Calendar, ChevronDown, Loader2, Inbox, Clock, Clock4, Palmtree, X } from 'lucide-react';

type ReportPreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

const PRESET_LABELS: Record<ReportPreset, string> = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  THIS_WEEK: 'This Week',
  LAST_WEEK: 'Last Week',
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
  CUSTOM: 'Custom Range',
};

const PRESET_ORDER: ReportPreset[] = ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'];

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

const getRangeForPreset = (preset: ReportPreset, customStart?: string, customEnd?: string): { startDate: string; endDate: string } => {
  const now = new Date();
  switch (preset) {
    case 'TODAY':
      return { startDate: fmt(now), endDate: fmt(now) };
    case 'YESTERDAY': {
      const y = subDays(now, 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case 'THIS_WEEK':
      return { startDate: fmt(startOfWeek(now, { weekStartsOn: 1 })), endDate: fmt(endOfWeek(now, { weekStartsOn: 1 })) };
    case 'LAST_WEEK': {
      const lastWeek = subWeeks(now, 1);
      return { startDate: fmt(startOfWeek(lastWeek, { weekStartsOn: 1 })), endDate: fmt(endOfWeek(lastWeek, { weekStartsOn: 1 })) };
    }
    case 'THIS_MONTH':
      return { startDate: fmt(startOfMonth(now)), endDate: fmt(endOfMonth(now)) };
    case 'LAST_MONTH': {
      const lastMonth = subMonths(now, 1);
      return { startDate: fmt(startOfMonth(lastMonth)), endDate: fmt(endOfMonth(lastMonth)) };
    }
    case 'CUSTOM':
      return { startDate: customStart || fmt(now), endDate: customEnd || fmt(now) };
    default:
      return { startDate: fmt(now), endDate: fmt(now) };
  }
};

interface ReportDateRange {
  preset: ReportPreset;
  startDate: string;
  endDate: string;
}

const ReportDateFilter = ({ value, onChange }: { value: ReportDateRange; onChange: (r: ReportDateRange) => void }) => {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);

  const selectPreset = (preset: ReportPreset) => {
    if (preset === 'CUSTOM') return;
    onChange({ preset, ...getRangeForPreset(preset) });
    setOpen(false);
  };

  const applyCustom = () => {
    onChange({ preset: 'CUSTOM', startDate: customStart, endDate: customEnd });
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
        <span>{PRESET_LABELS[value.preset]}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 p-2 max-h-[80vh] overflow-y-auto">
          {PRESET_ORDER.filter((p) => p !== 'CUSTOM').map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => selectPreset(preset)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                value.preset === preset ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-2 px-1 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Custom Range</p>
            <div className="flex items-center gap-1.5 px-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-1/2 text-[11px] border border-slate-200 rounded-lg px-2 py-1.5"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-1/2 text-[11px] border border-slate-200 rounded-lg px-2 py-1.5"
              />
            </div>
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

interface ReportRow {
  employeeId: string;
  name: string;
  department: string;
  leaveCount: number;
  lateCount: number;
  permissionCount: number;
}

const AdminMonthlyReport = () => {
  const [range, setRange] = useState<ReportDateRange>({ preset: 'THIS_MONTH', ...getRangeForPreset('THIS_MONTH') });
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [metricFilter, setMetricFilter] = useState<'ALL' | 'LEAVE' | 'LATE' | 'PERMISSION'>('ALL');
  const [modalMetric, setModalMetric] = useState<'LEAVE' | 'LATE' | 'PERMISSION' | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reports/monthly', {
        params: { startDate: range.startDate, endDate: range.endDate },
      });
      setRows(res.data?.report || []);
    } catch (error) {
      console.error('Failed to fetch monthly report', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate]);

  const filteredRows = rows
    .filter(
      (r) =>
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.department?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((r) => {
      if (metricFilter === 'LEAVE') return r.leaveCount > 0;
      if (metricFilter === 'LATE') return r.lateCount > 0;
      if (metricFilter === 'PERMISSION') return r.permissionCount > 0;
      return true;
    })
    .sort((a, b) => {
      if (metricFilter === 'LEAVE') return b.leaveCount - a.leaveCount;
      if (metricFilter === 'LATE') return b.lateCount - a.lateCount;
      if (metricFilter === 'PERMISSION') return b.permissionCount - a.permissionCount;
      return 0;
    });

  const totals = {
    leave: filteredRows.filter((r) => r.leaveCount > 0).length,
    late: filteredRows.filter((r) => r.lateCount > 0).length,
    permission: filteredRows.filter((r) => r.permissionCount > 0).length,
  };

  const MODAL_CONFIG = {
    LEAVE: { title: 'Employees on Leave', countKey: 'leaveCount' as const, colorClass: 'text-rose-700', bgClass: 'bg-rose-50', borderClass: 'border-rose-100' },
    LATE: { title: 'Employees Late', countKey: 'lateCount' as const, colorClass: 'text-amber-700', bgClass: 'bg-amber-50', borderClass: 'border-amber-100' },
    PERMISSION: { title: 'Employees on Permission', countKey: 'permissionCount' as const, colorClass: 'text-indigo-700', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-100' },
  };

  const modalRows = modalMetric
    ? rows
        .filter((r) => r[MODAL_CONFIG[modalMetric].countKey] > 0)
        .sort((a, b) => b[MODAL_CONFIG[modalMetric].countKey] - a[MODAL_CONFIG[modalMetric].countKey])
    : [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-700 border border-teal-100">
            <FileBarChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Monthly Report</h1>
            <p className="text-xs text-slate-500 mt-0.5">Leave, Late, and Permission counts per employee</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all w-44"
            />
          </div>

          <div className="relative">
            <select
              value={metricFilter}
              onChange={(e) => setMetricFilter(e.target.value as typeof metricFilter)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 py-2.5 pl-3.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            >
              <option value="ALL">All Metrics</option>
              <option value="LEAVE">Leave</option>
              <option value="LATE">Late</option>
              <option value="PERMISSION">Permission</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <ReportDateFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setModalMetric('LEAVE')}
          className="text-left bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover hover:border-slate-300 transition-all"
        >
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-rose-50">
              <Palmtree className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employees on Leave</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{totals.leave}</p>
        </button>
        <button
          type="button"
          onClick={() => setModalMetric('LATE')}
          className="text-left bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover hover:border-slate-300 transition-all"
        >
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-amber-50">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employees Late</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{totals.late}</p>
        </button>
        <button
          type="button"
          onClick={() => setModalMetric('PERMISSION')}
          className="text-left bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover hover:border-slate-300 transition-all"
        >
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-50">
              <Clock4 className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employees on Permission</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{totals.permission}</p>
        </button>
      </div>

      {/* Report Table */}
      <div className="bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/75">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Department</th>
                <th className={`px-6 py-4 text-right text-xs font-bold uppercase tracking-wider ${metricFilter === 'LEAVE' ? 'text-rose-700' : 'text-slate-400'}`}>Leave</th>
                <th className={`px-6 py-4 text-right text-xs font-bold uppercase tracking-wider ${metricFilter === 'LATE' ? 'text-amber-700' : 'text-slate-400'}`}>Late</th>
                <th className={`px-6 py-4 text-right text-xs font-bold uppercase tracking-wider ${metricFilter === 'PERMISSION' ? 'text-indigo-700' : 'text-slate-400'}`}>Permission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-teal-600 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Inbox className="w-6 h-6" />
                      <span className="text-xs font-medium">No employees match this selection.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center text-xs border border-teal-100">
                          {r.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{r.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{r.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                      {r.department || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                        {r.leaveCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                        {r.lateCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                        {r.permissionCount}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metric Detail Modal */}
      {modalMetric && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 animate-slide-up flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 rounded-t-3xl">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{MODAL_CONFIG[modalMetric].title}</h3>
                <p className="text-[11px] text-slate-500">{modalRows.length} employee{modalRows.length === 1 ? '' : 's'} · {PRESET_LABELS[range.preset]}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalMetric(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {modalRows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 py-10">
                  <Inbox className="w-6 h-6" />
                  <span className="text-xs font-medium">No employees match this selection.</span>
                </div>
              ) : (
                modalRows.map((r) => (
                  <div
                    key={r.employeeId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 border border-slate-100"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center text-xs border border-teal-100">
                        {r.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{r.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.employeeId}{r.department ? ` · ${r.department}` : ''}</div>
                      </div>
                    </div>
                    <span className={`font-mono font-bold px-2.5 py-1 rounded-lg border ${MODAL_CONFIG[modalMetric].colorClass} ${MODAL_CONFIG[modalMetric].bgClass} ${MODAL_CONFIG[modalMetric].borderClass}`}>
                      {r[MODAL_CONFIG[modalMetric].countKey]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminMonthlyReport;
