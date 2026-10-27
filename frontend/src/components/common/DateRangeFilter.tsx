import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateRangePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'LAST_3_MONTHS'
  | 'LAST_6_MONTHS'
  | 'CUSTOM';

export interface DateRange {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  THIS_WEEK: 'This Week',
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
  LAST_3_MONTHS: 'Last 3 Months',
  LAST_6_MONTHS: 'Last 6 Months',
  CUSTOM: 'Custom Range',
};

export const getRangeForPreset = (preset: DateRangePreset, customStart?: string, customEnd?: string): { startDate: string; endDate: string } => {
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
    case 'THIS_MONTH':
      return { startDate: fmt(startOfMonth(now)), endDate: fmt(endOfMonth(now)) };
    case 'LAST_MONTH': {
      const lastMonth = subMonths(now, 1);
      return { startDate: fmt(startOfMonth(lastMonth)), endDate: fmt(endOfMonth(lastMonth)) };
    }
    case 'LAST_3_MONTHS':
      return { startDate: fmt(startOfMonth(subMonths(now, 2))), endDate: fmt(endOfMonth(now)) };
    case 'LAST_6_MONTHS':
      return { startDate: fmt(startOfMonth(subMonths(now, 5))), endDate: fmt(endOfMonth(now)) };
    case 'CUSTOM':
      return { startDate: customStart || fmt(now), endDate: customEnd || fmt(now) };
    default:
      return { startDate: fmt(now), endDate: fmt(now) };
  }
};

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESET_ORDER: DateRangePreset[] = ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'LAST_3_MONTHS', 'LAST_6_MONTHS', 'CUSTOM'];

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);

  const selectPreset = (preset: DateRangePreset) => {
    if (preset === 'CUSTOM') {
      onChange({ preset, startDate: customStart, endDate: customEnd });
      return;
    }
    const range = getRangeForPreset(preset);
    onChange({ preset, ...range });
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

export default DateRangeFilter;
