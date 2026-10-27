import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getMyPermissions,
  getTeamPermissions,
  submitPermission,
  updatePermissionStatus,
  calculateDuration,
} from '../../services/permissionService';
import { getTeamRegularizations, updateRegularizationStatus } from '../../services/attendanceService';
import { formatTime12, formatTime } from '../../utils/timeUtils';
import { getFileUrl } from '../../utils/fileUrl';
import {
  Clock,
  Plus,
  X,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock4,
  FileText,
  Calendar,
  Send,
  MessageSquare,
  Paperclip,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EmployeePermissions = () => {
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [teamRegularizations, setTeamRegularizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [regularizeReviewModal, setRegularizeReviewModal] = useState<{
    isOpen: boolean;
    record: any;
    status: 'APPROVED' | 'REJECTED';
    comment: string;
  }>({ isOpen: false, record: null, status: 'APPROVED', comment: '' });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const isSsc = Boolean(user?.isSsc || (user?.workMode as string) === 'SSC');
  const todayStr = new Date().toISOString().split('T')[0];
  const [dayType, setDayType] = useState<'FULL_DAY' | 'HALF_DAY'>('FULL_DAY');
  const [halfDaySlot, setHalfDaySlot] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  
  const [form, setForm] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
    requestType: 'PERMISSION' | 'WFH' | 'LEAVE' | 'WEEK_OFF';
  }>({
    date: todayStr,
    startTime: '09:00',
    endTime: '18:00',
    reason: '',
    requestType: isSsc ? 'WEEK_OFF' : (user?.workMode === 'WFO' ? 'WFH' : 'PERMISSION'),
  });
  const [submitting, setSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [extraLeaveDates, setExtraLeaveDates] = useState<string[]>([]);

  const MONTHLY_FREE_LEAVE_LIMIT = 2;
  const leaveMonth = form.date.slice(0, 7); // YYYY-MM
  const leavesTakenThisMonth = myRequests.filter(
    (r: any) => r.requestType === 'LEAVE' && r.status !== 'REJECTED' && r.date?.startsWith(leaveMonth)
  ).length;
  const allSelectedLeaveDates = Array.from(new Set([form.date, ...extraLeaveDates].filter(Boolean)));
  const attachmentRequired = (() => {
    if (form.requestType !== 'LEAVE') return false;
    const runningCountByMonth: Record<string, number> = {};
    myRequests.forEach((r: any) => {
      if (r.requestType === 'LEAVE' && r.status !== 'REJECTED' && r.date) {
        const m = r.date.slice(0, 7);
        runningCountByMonth[m] = (runningCountByMonth[m] || 0) + 1;
      }
    });
    for (const d of allSelectedLeaveDates) {
      const m = d.slice(0, 7);
      runningCountByMonth[m] = (runningCountByMonth[m] || 0) + 1;
      if (runningCountByMonth[m] > MONTHLY_FREE_LEAVE_LIMIT) return true;
    }
    return false;
  })();

  // Review Modal State
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    request: any;
    status: 'APPROVED' | 'REJECTED';
    comment: string;
  }>({
    isOpen: false,
    request: null,
    status: 'APPROVED',
    comment: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [myRes, teamRes, teamRegularizationsRes] = await Promise.all([
        getMyPermissions(),
        getTeamPermissions(),
        getTeamRegularizations().catch(() => []),
      ]);
      setMyRequests(myRes);
      setTeamRequests(teamRes);
      setTeamRegularizations(Array.isArray(teamRegularizationsRes) ? teamRegularizationsRes : []);
    } catch (error) {
      console.error('Failed to fetch permissions', error);
      toast.error('Failed to load permission requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRegularizeReview = async () => {
    if (!regularizeReviewModal.record) return;
    try {
      await updateRegularizationStatus(regularizeReviewModal.record._id, {
        status: regularizeReviewModal.status,
        managerComment: regularizeReviewModal.comment,
      });
      toast.success(`Regularization request ${regularizeReviewModal.status.toLowerCase()}!`);
      setRegularizeReviewModal({ isOpen: false, record: null, status: 'APPROVED', comment: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update regularization status');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const durationInfo = calculateDuration(form.startTime, form.endTime);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let submitPayload = { ...form };
    if (form.requestType === 'LEAVE' || form.requestType === 'WFH' || form.requestType === 'WEEK_OFF') {
      if (dayType === 'FULL_DAY') {
        submitPayload.startTime = '09:00';
        submitPayload.endTime = '18:00';
      } else {
        if (halfDaySlot === 'FIRST_HALF') {
          submitPayload.startTime = '09:00';
          submitPayload.endTime = '13:30';
        } else {
          submitPayload.startTime = '13:30';
          submitPayload.endTime = '18:00';
        }
      }
    } else {
      const dur = calculateDuration(form.startTime, form.endTime);
      if (dur.diffMins <= 0) {
        toast.error('End time must be after start time');
        return;
      }
    }

    if (attachmentRequired && !attachment) {
      toast.error(`You've already taken ${leavesTakenThisMonth} leave(s) this month. Please attach a supporting document (e.g. medical certificate, marriage invitation).`);
      return;
    }

    try {
      setSubmitting(true);

      if (form.requestType === 'LEAVE' && allSelectedLeaveDates.length > 1) {
        // Submit one leave request per selected date, in sequence
        for (const d of allSelectedLeaveDates) {
          await submitPermission({ ...submitPayload, date: d }, attachment);
        }
        toast.success(`Leave application submitted for ${allSelectedLeaveDates.length} dates!`);
      } else {
        await submitPermission(submitPayload, attachment);
        toast.success(
          form.requestType === 'WEEK_OFF'
            ? 'Compensatory Week Off request submitted to your reporting manager!'
            : form.requestType === 'WFH'
            ? 'WFH request submitted to your reporting manager!'
            : form.requestType === 'LEAVE'
            ? 'Leave application submitted successfully!'
            : 'Permission request submitted successfully!'
        );
      }

      setShowModal(false);
      setDayType('FULL_DAY');
      setHalfDaySlot('FIRST_HALF');
      setAttachment(null);
      setExtraLeaveDates([]);
      setForm({
        date: todayStr,
        startTime: '09:00',
        endTime: '18:00',
        reason: '',
        requestType: isSsc ? 'WEEK_OFF' : (user?.workMode === 'WFO' ? 'WFH' : 'PERMISSION'),
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit request');
      fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewModal.request) return;
    try {
      await updatePermissionStatus(reviewModal.request._id, {
        status: reviewModal.status,
        managerComment: reviewModal.comment,
      });
      toast.success(`Request ${reviewModal.status.toLowerCase()}!`);
      setReviewModal({ isOpen: false, request: null, status: 'APPROVED', comment: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const renderTypeBadge = (type?: string) => {
    switch (type) {
      case 'WEEK_OFF':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-300">
            🏖️ Week Off
          </span>
        );
      case 'WFH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
            🏠 WFH
          </span>
        );
      case 'LEAVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
            🌴 Leave
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-200">
            ⏱️ Permission
          </span>
        );
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock4 className="w-3 h-3 mr-1 text-amber-600" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* SSC Employee Policy Banner */}
      {user?.isSsc && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-amber-500 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-amber-950">SSC Shift Employee Privilege Active</p>
                <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full text-[10px] font-black uppercase">
                  Holiday / Sunday Work Enabled
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Since you work on official holidays & Sundays, you are entitled to compensatory weekday <strong>Week Off</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({ ...form, requestType: 'WEEK_OFF' });
              setDayType('FULL_DAY');
              setShowModal(true);
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <span>🏖️</span> Request Week Off
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-700 border border-teal-100">
            <Clock4 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Permission & Leave Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit absence permissions, WFH, leaves, or compensatory week offs
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (!isSsc && form.requestType === 'WEEK_OFF') {
              setForm(f => ({ ...f, requestType: user?.workMode === 'WFO' ? 'WFH' : 'PERMISSION' }));
            }
            setShowModal(true);
          }}
          className="btn-primary w-full sm:w-auto shadow-glow-teal"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Request Time Off
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 max-w-md">
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex items-center justify-center py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'my'
              ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          My Requests ({myRequests.length})
        </button>

        {teamRequests.length > 0 && (
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 flex items-center justify-center py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'team'
                ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 mr-1.5" />
            Team Approvals ({teamRequests.length})
            {teamRequests.some((r) => r.status === 'PENDING') && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {teamRequests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TAB 1: My Requests */}
      {activeTab === 'my' && (
        <>
          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-card">
              <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : myRequests.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card space-y-3">
              <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto border border-teal-100">
                <Clock className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-800 text-sm">No permission requests submitted yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Need short leave or time off for an errand? Click "Request Permission" to alert your supervisor.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary mt-2"
              >
                <Plus className="w-4 h-4 mr-1" /> New Permission
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/75">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Timing</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Manager</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myRequests.map((req) => (
                        <tr key={req._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderTypeBadge(req.requestType)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">
                            {format(new Date(req.date), 'EEE, dd MMM yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">
                            <span className="font-mono">{formatTime12(req.startTime)}</span> – <span className="font-mono">{formatTime12(req.endTime)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-100 font-mono">
                              <Clock className="w-3 h-3 mr-1 text-teal-600" />
                              {req.totalHoursFormatted || `${req.totalHours} hrs`}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                            {req.managerInfo ? (
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                                <span className="font-semibold text-slate-800">{req.managerInfo.name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Admin</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-xs">
                            <p className="truncate">{req.reason || <span className="text-slate-400 italic">No reason provided</span>}</p>
                            {req.attachmentUrl && (
                              <a
                                href={getFileUrl(req.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-800 mt-1"
                              >
                                <Paperclip className="w-3 h-3" /> {req.attachmentName || 'View Document'}
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                            {renderStatusBadge(req.status)}
                            {req.managerComment && (
                              <p className="text-[10px] text-slate-500 mt-1 italic flex items-center justify-end gap-1">
                                <MessageSquare className="w-2.5 h-2.5 text-slate-400" />
                                "{req.managerComment}"
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {myRequests.map((req) => (
                  <div key={req._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {renderTypeBadge(req.requestType)}
                        </div>
                        <p className="font-bold text-slate-900 text-xs">{format(new Date(req.date), 'EEE, dd MMM yyyy')}</p>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          {formatTime12(req.startTime)} – {formatTime12(req.endTime)}
                        </p>
                      </div>
                      {renderStatusBadge(req.status)}
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Duration:</span>
                      <span className="font-mono font-bold text-teal-700">
                        {req.totalHoursFormatted || `${req.totalHours} hrs`}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      {req.reason && (
                        <p className="text-[11px]">
                          <span className="text-slate-400">Reason: </span>
                          <span className="text-slate-800">{req.reason}</span>
                        </p>
                      )}
                      {req.managerComment && (
                        <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-1">
                          <strong>Manager Remark:</strong> {req.managerComment}
                        </p>
                      )}
                      {req.attachmentUrl && (
                        <a
                          href={getFileUrl(req.attachmentUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-800"
                        >
                          <Paperclip className="w-3.5 h-3.5" /> {req.attachmentName || 'View Document'}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 2: Team Approvals */}
      {activeTab === 'team' && (
        <>
          {/* Half Day Regularization Requests */}
          {teamRegularizations.length > 0 && (
            <div className="bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-100 bg-orange-50/40 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Half Day Leave Regularization Requests ({teamRegularizations.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {teamRegularizations.map((reg: any) => (
                  <div key={reg._id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-slate-900">{reg.employeeName}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{reg.employeeId}</span>
                        {renderStatusBadge(reg.regularizationStatus)}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {format(new Date(reg.date), 'EEE, MMM d, yyyy')} • Signed out at {formatTime(reg.checkOut)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="text-slate-400">Remark: </span>{reg.regularizationRemark}
                      </p>
                    </div>
                    {reg.regularizationStatus === 'PENDING' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setRegularizeReviewModal({ isOpen: true, record: reg, status: 'APPROVED', comment: '' })}
                          className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </button>
                        <button
                          onClick={() => setRegularizeReviewModal({ isOpen: true, record: reg, status: 'REJECTED', comment: '' })}
                          className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl border border-rose-200 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {teamRequests.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center text-slate-400 text-xs border border-slate-200 shadow-card">
              No permission requests received from your team.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/75">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Timing</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamRequests.map((req) => (
                        <tr key={req._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-xs">
                            <p className="font-bold text-slate-900">{req.employeeName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{req.employeeId}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-800">
                            {format(new Date(req.date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                            {formatTime12(req.startTime)} – {formatTime12(req.endTime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs">
                            <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                              {req.totalHoursFormatted || `${req.totalHours} hrs`}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-xs">
                            <p className="truncate">{req.reason || <span className="text-slate-400 italic">No reason</span>}</p>
                            {req.attachmentUrl && (
                              <a
                                href={getFileUrl(req.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-800 mt-1"
                              >
                                <Paperclip className="w-3 h-3" /> {req.attachmentName || 'View Document'}
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs">
                            {renderStatusBadge(req.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                            {req.status === 'PENDING' ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => setReviewModal({ isOpen: true, request: req, status: 'APPROVED', comment: '' })}
                                  className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                </button>
                                <button
                                  onClick={() => setReviewModal({ isOpen: true, request: req, status: 'REJECTED', comment: '' })}
                                  className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Reviewed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {teamRequests.map((req) => (
                  <div key={req._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{req.employeeName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{req.employeeId}</p>
                      </div>
                      {renderStatusBadge(req.status)}
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Timing:</span>
                        <span className="font-mono text-slate-800">
                          {format(new Date(req.date), 'dd MMM')} • {formatTime12(req.startTime)} – {formatTime12(req.endTime)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Duration:</span>
                        <span className="font-mono font-bold text-teal-700">
                          {req.totalHoursFormatted || `${req.totalHours} hrs`}
                        </span>
                      </div>
                    </div>

                    {req.attachmentUrl && (
                      <a
                        href={getFileUrl(req.attachmentUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800"
                      >
                        <Paperclip className="w-3.5 h-3.5" /> {req.attachmentName || 'View Document'}
                      </a>
                    )}

                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setReviewModal({ isOpen: true, request: req, status: 'APPROVED', comment: '' })}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => setReviewModal({ isOpen: true, request: req, status: 'REJECTED', comment: '' })}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Request Permission / WFH / Leave Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full rounded-3xl shadow-2xl max-w-lg border border-slate-100 animate-slide-up flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 rounded-t-3xl">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-teal-50 rounded-xl text-teal-700 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">New Work Request</h2>
                  <p className="text-[11px] text-slate-500">
                    {isSsc
                      ? 'Apply for compensatory week off, WFH remote day, full/half leave, or permission'
                      : 'Apply for WFH remote day, full/half leave, or permission'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Request Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Request Category
                </label>
                <div className={`grid gap-2 ${isSsc ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                  {[
                    ...(isSsc
                      ? [{ id: 'WEEK_OFF', label: 'Week Off', icon: '🏖️', desc: 'Compensatory weekday off', highlight: true }]
                      : []),
                    { id: 'WFH', label: 'Work From Home', icon: '🏠', desc: 'Remote day request', highlight: false },
                    { id: 'LEAVE', label: 'Leave', icon: '🌴', desc: 'Full or Half Day off', highlight: false },
                    { id: 'PERMISSION', label: 'Permission', icon: '⏱️', desc: 'Short 1-2h errand', highlight: false },
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => {
                        setForm({ ...form, requestType: cat.id as any });
                        setDayType('FULL_DAY');
                        if (cat.id !== 'LEAVE') setExtraLeaveDates([]);
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition-all relative ${
                        form.requestType === cat.id
                          ? cat.id === 'WEEK_OFF'
                            ? 'bg-amber-50/90 border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
                            : 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {cat.highlight && (
                        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-black rounded-full shadow-2xs">
                          SSC
                        </span>
                      )}
                      <div className="text-base mb-1">{cat.icon}</div>
                      <p className={`text-xs font-bold ${
                        form.requestType === cat.id 
                          ? cat.id === 'WEEK_OFF' ? 'text-amber-900' : 'text-teal-900' 
                          : 'text-slate-800'
                      }`}>
                        {cat.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{cat.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Leave, Week Off, or WFH: Duration Selector (Full Day vs Half Day) */}
              {(form.requestType === 'LEAVE' || form.requestType === 'WFH' || form.requestType === 'WEEK_OFF') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. Duration Option
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDayType('FULL_DAY')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        dayType === 'FULL_DAY'
                          ? form.requestType === 'WEEK_OFF' ? 'bg-amber-600 text-white shadow-xs border-amber-600' : 'bg-teal-600 text-white shadow-xs border-teal-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {form.requestType === 'WEEK_OFF' ? '🏖️ Full Day Week Off' : form.requestType === 'LEAVE' ? '🌴 Full Day Leave' : '🏠 Full Day WFH'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDayType('HALF_DAY')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        dayType === 'HALF_DAY'
                          ? form.requestType === 'WEEK_OFF' ? 'bg-amber-600 text-white shadow-xs border-amber-600' : 'bg-teal-600 text-white shadow-xs border-teal-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {form.requestType === 'WEEK_OFF' ? '🌓 Half Day Week Off' : form.requestType === 'LEAVE' ? '🌓 Half Day Leave' : '🌓 Half Day WFH'}
                    </button>
                  </div>

                  {/* Half Day Slot Selection */}
                  {dayType === 'HALF_DAY' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setHalfDaySlot('FIRST_HALF')}
                        className={`p-2 rounded-lg border text-[11px] font-semibold transition-all text-center ${
                          halfDaySlot === 'FIRST_HALF'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-400'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        🌅 1st Half (09:00 - 01:30 PM)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHalfDaySlot('SECOND_HALF')}
                        className={`p-2 rounded-lg border text-[11px] font-semibold transition-all text-center ${
                          halfDaySlot === 'SECOND_HALF'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-400'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        🌇 2nd Half (01:30 - 06:00 PM)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Date Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="form-input text-xs"
                />
              </div>

              {/* Leave only: select additional dates to apply for multiple days at once */}
              {form.requestType === 'LEAVE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Additional Leave Dates (optional)
                  </label>
                  <div className="space-y-2">
                    {extraLeaveDates.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={d}
                          onChange={(e) => {
                            const updated = [...extraLeaveDates];
                            updated[idx] = e.target.value;
                            setExtraLeaveDates(updated);
                          }}
                          className="form-input text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setExtraLeaveDates(extraLeaveDates.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                          title="Remove date"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setExtraLeaveDates([...extraLeaveDates, todayStr])}
                      className="flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add another date
                    </button>
                  </div>
                  {allSelectedLeaveDates.length > 1 && (
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      This will submit {allSelectedLeaveDates.length} separate leave requests, one for each date.
                    </p>
                  )}
                </div>
              )}

              {/* Time Picker ONLY for PERMISSION (Hidden for Full Day Leave/WFH/Week Off) */}
              {form.requestType === 'PERMISSION' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Start Time</label>
                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="form-input font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">End Time</label>
                    <input
                      type="time"
                      required
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="form-input font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Live Info Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  {form.requestType === 'WEEK_OFF'
                    ? dayType === 'FULL_DAY' ? '🏖️ Full Day Week Off (Compensatory for Holiday/Sunday Work)' : `🌓 Half Day Week Off (${halfDaySlot === 'FIRST_HALF' ? 'Morning 9:00 - 1:30' : 'Afternoon 1:30 - 6:00'})`
                    : form.requestType === 'LEAVE'
                    ? dayType === 'FULL_DAY' ? '🌴 Full Day Off (1 Working Day)' : `🌓 Half Day Off (${halfDaySlot === 'FIRST_HALF' ? 'Morning 9:00 - 1:30' : 'Afternoon 1:30 - 6:00'})`
                    : form.requestType === 'WFH'
                    ? dayType === 'FULL_DAY' ? '🏠 Full Day Remote (09:00 AM – 06:00 PM)' : `🏠 Half Day Remote (${halfDaySlot === 'FIRST_HALF' ? 'Morning' : 'Afternoon'})`
                    : `⏱️ Short Permission (${durationInfo.formatted})`}
                </span>
                <span className="font-bold text-teal-700">
                  {user?.reportingManager ? `→ ${user.reportingManager.name}` : '→ Admin'}
                </span>
              </div>

              {/* Leave Attachment: required once the 2 free leaves/month are used up */}
              {form.requestType === 'LEAVE' && (
                <div>
                  <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs mb-2 ${
                    attachmentRequired ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200/80 text-slate-500'
                  }`}>
                    <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      You've taken <strong>{leavesTakenThisMonth}</strong> leave{leavesTakenThisMonth === 1 ? '' : 's'} in {leaveMonth}.
                      {attachmentRequired && ' You get 2 free leaves per month — attach a supporting document (e.g. medical certificate, marriage invitation) for this one.'}
                    </span>
                  </div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Supporting Document {attachmentRequired && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required={attachmentRequired}
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    className="form-input text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">PDF, JPG or PNG, up to 5MB.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder={
                    form.requestType === 'WEEK_OFF'
                      ? 'Specify compensatory week off reason (e.g. Worked on Sunday or Company Holiday)...'
                      : form.requestType === 'WFH'
                      ? 'Explain reason for working from home...'
                      : form.requestType === 'LEAVE'
                      ? 'Specify reason for taking leave...'
                      : 'Specify reason for short permission...'
                  }
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="form-input text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-3 text-white text-xs font-bold rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 ${
                    form.requestType === 'WEEK_OFF'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                      : 'bg-teal-600 hover:bg-teal-700 shadow-glow-teal'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting
                    ? 'Submitting Request...'
                    : `Submit ${form.requestType === 'WEEK_OFF' ? 'Compensatory Week Off' : form.requestType === 'WFH' ? 'WFH' : form.requestType === 'LEAVE' ? 'Leave' : 'Permission'} Application${form.requestType === 'LEAVE' && allSelectedLeaveDates.length > 1 ? ` (${allSelectedLeaveDates.length} dates)` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Review Modal */}
      {reviewModal.isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full rounded-3xl shadow-2xl max-w-md overflow-hidden border border-slate-100 animate-slide-up flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-900">
                {reviewModal.status === 'APPROVED' ? 'Approve' : 'Reject'} {reviewModal.request?.requestType || 'Request'}
              </h3>
              <button
                onClick={() => setReviewModal({ isOpen: false, request: null, status: 'APPROVED', comment: '' })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl text-xs space-y-1.5 border border-slate-100">
                <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Type:</span>
                  {renderTypeBadge(reviewModal.request?.requestType)}
                </div>
                <p><strong className="text-slate-700">Employee:</strong> {reviewModal.request?.employeeName} ({reviewModal.request?.employeeId})</p>
                <p><strong className="text-slate-700">Date:</strong> {reviewModal.request?.date}</p>
                <p>
                  <strong className="text-slate-700">Duration:</strong> {
                    reviewModal.request?.startTime === '09:00' && reviewModal.request?.endTime === '18:00'
                      ? 'Full Day'
                      : `${reviewModal.request?.startTime} – ${reviewModal.request?.endTime} (${reviewModal.request?.totalHoursFormatted || ''})`
                  }
                </p>
                <p><strong className="text-slate-700">Reason:</strong> {reviewModal.request?.reason || 'None'}</p>
              </div>

              {reviewModal.request?.requestType === 'WFH' && reviewModal.status === 'APPROVED' && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-800">
                  ⭐ <strong>WFH Approval:</strong> Employee's work login is authorized and office GPS perimeter is waived on {reviewModal.request?.date}.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Manager Remark / Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter feedback for employee..."
                  value={reviewModal.comment}
                  onChange={(e) => setReviewModal({ ...reviewModal, comment: e.target.value })}
                  className="form-input text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setReviewModal({ isOpen: false, request: null, status: 'APPROVED', comment: '' })}
                  className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all ${
                    reviewModal.status === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {reviewModal.status === 'APPROVED' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Regularization Review Modal */}
      {regularizeReviewModal.isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full rounded-3xl shadow-2xl max-w-md overflow-hidden border border-slate-100 animate-slide-up flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-900">
                {regularizeReviewModal.status === 'APPROVED' ? 'Approve' : 'Reject'} Half Day Regularization
              </h3>
              <button
                onClick={() => setRegularizeReviewModal({ isOpen: false, record: null, status: 'APPROVED', comment: '' })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl text-xs space-y-1.5 border border-slate-100">
                <p><strong className="text-slate-700">Employee:</strong> {regularizeReviewModal.record?.employeeName} ({regularizeReviewModal.record?.employeeId})</p>
                <p><strong className="text-slate-700">Date:</strong> {regularizeReviewModal.record && format(new Date(regularizeReviewModal.record.date), 'EEE, MMM d, yyyy')}</p>
                <p><strong className="text-slate-700">Signed Out:</strong> {formatTime(regularizeReviewModal.record?.checkOut)}</p>
                <p><strong className="text-slate-700">Remark:</strong> {regularizeReviewModal.record?.regularizationRemark || 'None'}</p>
              </div>

              {regularizeReviewModal.status === 'APPROVED' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800">
                  Approving will clear the Half Day Leave flag for this attendance record.
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800">
                  Rejecting will keep this day marked as Half Day Leave.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Manager Remark / Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter feedback for employee..."
                  value={regularizeReviewModal.comment}
                  onChange={(e) => setRegularizeReviewModal({ ...regularizeReviewModal, comment: e.target.value })}
                  className="form-input text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRegularizeReviewModal({ isOpen: false, record: null, status: 'APPROVED', comment: '' })}
                  className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegularizeReview}
                  className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all ${
                    regularizeReviewModal.status === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {regularizeReviewModal.status === 'APPROVED' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EmployeePermissions;
