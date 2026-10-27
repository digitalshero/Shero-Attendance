import React from 'react';
import { formatTime } from '../../utils/timeUtils';
import { LogIn, Coffee, Play, LogOut, Activity } from 'lucide-react';

interface AttendanceTimelineProps {
  events: any[];
}

const AttendanceTimeline: React.FC<AttendanceTimelineProps> = ({ events }) => {
  const getEventMeta = (type: string) => {
    switch (type) {
      case 'CHECK_IN':
        return {
          icon: LogIn,
          title: 'Checked In',
          desc: 'Started work day',
          color: 'text-teal-700',
          bg: 'bg-teal-50 border-teal-200',
        };
      case 'STOP':
        return {
          icon: Coffee,
          title: 'Leave / Break',
          desc: 'Paused active session',
          color: 'text-amber-700',
          bg: 'bg-amber-50 border-amber-200',
        };
      case 'RESUME':
        return {
          icon: Play,
          title: 'Resumed',
          desc: 'Continued work timer',
          color: 'text-emerald-700',
          bg: 'bg-emerald-50 border-emerald-200',
        };
      case 'CHECK_OUT':
        return {
          icon: LogOut,
          title: 'Checked Out',
          desc: 'Shift completed',
          color: 'text-slate-700',
          bg: 'bg-slate-100 border-slate-300',
        };
      default:
        return {
          icon: Activity,
          title: 'Event',
          desc: 'Recorded event',
          color: 'text-slate-600',
          bg: 'bg-slate-50 border-slate-200',
        };
    }
  };

  return (
    <div className="flow-root">
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {events.map((event, idx) => {
          const meta = getEventMeta(event.eventType);
          const Icon = meta.icon;
          return (
            <div key={event._id || event.id || idx} className="relative group">
              {/* Event Dot */}
              <div className={`absolute -left-[30px] top-0.5 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${meta.bg}`}>
                <Icon className={`w-3 h-3 ${meta.color}`} />
              </div>

              {/* Event Content */}
              <div className="flex items-start justify-between gap-2 p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-800">{meta.title}</p>
                  <p className="text-[11px] text-slate-500">{meta.desc}</p>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                  {formatTime(event.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceTimeline;
