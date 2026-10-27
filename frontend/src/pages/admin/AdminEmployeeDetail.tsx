import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  UserCog, 
  Pencil,
  Calendar, 
  UserCheck, 
  Building2, 
  Briefcase,
  Home, 
  Mail, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  X, 
  Eye, 
  EyeOff, 
  Sparkles,
  Layers
} from 'lucide-react';

const DEFAULT_DEPARTMENTS = [
  'DST',
  'TECH',
  'HR',
  'OGB',
  'KOB',
  'Accounts',
  'Finance',
  'Compliance',
];

export const AdminEmployeeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);

  // Quick edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    department: '',
    designation: '',
    dateOfBirth: '',
    status: 'ACTIVE',
    workMode: 'WFO',
    rollType: 'ON_ROLL',
    reportingManagerId: '',
    basicSalary: '',
    grossSalary: '',
    pfApplicable: false,
    esiApplicable: false,
    otherDeductions: '',
  });

  const fetchEmployeeDetail = async () => {
    try {
      setLoading(true);
      const [detailRes, mgrRes, settingsRes] = await Promise.all([
        api.get(`/admin/employees/${id}/detail`),
        api.get('/admin/managers'),
        api.get('/admin/settings').catch(() => ({ data: { departments: DEFAULT_DEPARTMENTS } })),
      ]);
      setData(detailRes.data);
      setManagers(mgrRes.data);
      if (settingsRes?.data?.departments && Array.isArray(settingsRes.data.departments) && settingsRes.data.departments.length > 0) {
        setDepartments(settingsRes.data.departments);
      }

      const emp = detailRes.data.employee;
      setEditForm({
        name: emp.name || '',
        email: emp.email || '',
        password: '',
        employeeId: emp.employeeId || '',
        department: emp.department || '',
        designation: emp.designation || '',
        dateOfBirth: emp.dateOfBirth || '',
        status: emp.status || 'ACTIVE',
        workMode: emp.workMode || 'WFO',
        rollType: emp.rollType || emp.roleType || emp.employmentType || 'ON_ROLL',
        reportingManagerId: emp.reportingManager?.id || emp.reportingManagerId || '',
        basicSalary: emp.basicSalary !== undefined ? String(emp.basicSalary) : '',
        grossSalary: emp.grossSalary !== undefined ? String(emp.grossSalary) : '',
        pfApplicable: Boolean(emp.pfApplicable),
        esiApplicable: Boolean(emp.esiApplicable),
        otherDeductions: emp.otherDeductions !== undefined ? String(emp.otherDeductions) : '',
      });
    } catch (err: any) {
      toast.error('Failed to load employee details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeDetail();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.employee?._id) return;
    try {
      await api.put(`/admin/employees/${data.employee._id}`, editForm);
      toast.success('Employee profile updated successfully!');
      setEditOpen(false);
      fetchEmployeeDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update employee');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-600 rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold">Loading employee profile...</p>
      </div>
    );
  }

  if (!data?.employee) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-card max-w-lg mx-auto">
        <p className="text-base font-bold text-slate-800">Employee not found</p>
        <button
          onClick={() => navigate('/admin/employees')}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"
        >
          Back to Staff Directory
        </button>
      </div>
    );
  }

  const emp = data.employee;
  const recentAttendance = data.recentAttendance || [];
  const approvedLeaves = data.approvedLeaves || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin/employees')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-teal-700 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs transition-all w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Staff Directory</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to={`/admin/employees/${emp.employeeId}/attendance`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200/80 text-xs font-bold shadow-2xs transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>View Attendance History</span>
          </Link>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
              {emp.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{emp.name}</h1>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                  emp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {emp.status || 'ACTIVE'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  {emp.employeeId}
                </span>
                {emp.department && (
                  <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                    <Briefcase className="w-3.5 h-3.5 text-teal-600" />
                    {emp.department}
                  </span>
                )}
                {emp.designation && (
                  <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                    {emp.designation}
                  </span>
                )}
                {emp.dateOfBirth && (
                  <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                    🎂 {emp.dateOfBirth}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {emp.email}
                </span>
                <span className="flex items-center gap-1 text-teal-700 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {emp.role || 'EMPLOYEE'}
                </span>
              </div>
            </div>
          </div>

          {/* Work Mode Badge */}
          <div className="self-start sm:self-auto">
            {emp.workMode === 'SSC' ? (
              <div className="px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-2 shadow-2xs">
                <span className="text-sm">⚡</span>
                <div>
                  <p className="leading-tight">SSC Shift Employee</p>
                  <p className="text-[10px] text-amber-700 font-normal">Works Holidays & Weekends</p>
                </div>
              </div>
            ) : emp.workMode === 'HYBRID' ? (
              <div className="px-4 py-2.5 rounded-2xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold flex items-center gap-2 shadow-2xs">
                <span className="text-sm">🏢+🏠</span>
                <div>
                  <p className="leading-tight">Hybrid Flexible</p>
                  <p className="text-[10px] text-purple-600 font-normal">Remote & Office Sign-In</p>
                </div>
              </div>
            ) : emp.workMode === 'WFH' ? (
              <div className="px-4 py-2.5 rounded-2xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center gap-2 shadow-2xs">
                <Home className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="leading-tight">Work from Home</p>
                  <p className="text-[10px] text-indigo-600 font-normal">No Office GPS Restraint</p>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-2 shadow-2xs">
                <Building2 className="w-4 h-4 text-teal-600" />
                <div>
                  <p className="leading-tight">Work from Office</p>
                  <p className="text-[10px] text-teal-600 font-normal">500m Geofence GPS</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Reporting Manager & Recent Attendance Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Reporting Line Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Supervisor / Reporting Line</h3>
              <p className="text-[11px] text-slate-500">Assigned approval authority</p>
            </div>
          </div>

          {emp.reportingManager ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center text-sm">
                  {emp.reportingManager.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{emp.reportingManager.name}</p>
                  <p className="text-[11px] font-mono text-slate-500">{emp.reportingManager.employeeId}</p>
                </div>
              </div>
              <div className="pt-2 text-xs text-slate-600 border-t border-slate-200/60 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{emp.reportingManager.email}</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">No Direct Supervisor</p>
              <p className="text-[11px] text-slate-400 mt-1">Reports directly to System Administrators / Operations Head</p>
            </div>
          )}

          {/* Quick Stats Widget */}
          <div className="pt-2 space-y-2.5">
            <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-amber-50/70 border border-amber-200">
              <span className="text-amber-900 font-medium flex items-center gap-1">
                <span>⚡</span> Holidays Worked:
              </span>
              <span className="font-bold text-amber-900 font-mono">{data.holidaysWorkedCount || 0} Days</span>
            </div>
            <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Approved Leaves Taken:</span>
              <span className="font-bold text-slate-900 font-mono">{approvedLeaves.length} Days</span>
            </div>
            <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Logged Days on Record:</span>
              <span className="font-bold text-teal-700 font-mono">{recentAttendance.length} Days</span>
            </div>
          </div>
        </div>

        {/* Recent Attendance Log Snippet */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Attendance Logs</h3>
                <p className="text-[11px] text-slate-500">Most recent punches on record</p>
              </div>
            </div>
            <Link
              to={`/admin/employees/${emp.employeeId}/attendance`}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>Full History</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>

          {recentAttendance.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              No attendance records found for this employee yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Sign In</th>
                    <th className="px-4 py-2.5">Sign Out</th>
                    <th className="px-4 py-2.5">Total Hours</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAttendance.map((rec: any) => (
                    <tr key={rec._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {new Date(rec.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-teal-700">
                        {Math.floor(rec.totalWorkingSeconds / 3600)}h {Math.floor((rec.totalWorkingSeconds % 3600) / 60)}m
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          rec.status === 'CHECKED_OUT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          rec.status === 'WORKING' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Edit Full Profile Modal */}
      {editOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white w-full rounded-3xl shadow-2xl max-w-xl overflow-hidden border border-slate-100 animate-slide-up flex flex-col max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Edit Staff Profile</h2>
                  <p className="text-[11px] text-slate-500">Update work mode, credentials & compensation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form id="editStaffDetailForm" onSubmit={handleUpdate} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Work Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Work Mode Policy
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { mode: 'WFO', label: 'Office (WFO)', sub: 'GPS required', icon: Building2 },
                    { mode: 'WFH', label: 'Remote (WFH)', sub: 'Remote punch', icon: Home },
                    { mode: 'HYBRID', label: 'Hybrid (Flex)', sub: 'Office & Home', emoji: '🏢+🏠' },
                  ].map((m) => (
                    <button
                      key={m.mode}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, workMode: m.mode })}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        editForm.workMode === m.mode
                          ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <div className={`p-1.5 rounded-lg shrink-0 ${editForm.workMode === m.mode ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {m.icon ? <m.icon className="w-4 h-4" /> : <span className="text-xs font-bold">{m.emoji}</span>}
                        </div>
                        {editForm.workMode === m.mode && <span className="w-2 h-2 rounded-full bg-teal-600"></span>}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{m.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{m.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal & Account */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Account & Organization
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
                    <input
                      type="text"
                      required
                      value={editForm.employeeId}
                      onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                      className="form-input font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Password</label>
                    <div className="relative">
                      <input
                        placeholder="Leave blank to keep current"
                        type={showPassword ? 'text' : 'password'}
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        className="form-input pr-10 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <select
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="form-input text-xs"
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Software Engineer"
                      value={editForm.designation}
                      onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                      className="form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                      className="form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="form-input text-xs"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Type</label>
                    <select
                      value={editForm.rollType}
                      onChange={(e) => setEditForm({ ...editForm, rollType: e.target.value })}
                      className="form-input text-xs"
                    >
                      <option value="ON_ROLL">On-roll</option>
                      <option value="OFF_ROLL">Off-roll</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Manager</label>
                    <select
                      value={editForm.reportingManagerId}
                      onChange={(e) => setEditForm({ ...editForm, reportingManagerId: e.target.value })}
                      className="form-input text-xs"
                    >
                      <option value="">None (Independent / Admin)</option>
                      {managers
                        .filter((m) => m._id !== emp._id)
                        .map((mgr) => (
                          <option key={mgr._id} value={mgr._id}>
                            {mgr.name} ({mgr.employeeId}) {mgr.role === 'ADMIN' ? '— Admin' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="btn-secondary px-5 py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="editStaffDetailForm"
                className="btn-primary px-6 py-2.5 text-xs font-bold shadow-glow-teal"
              >
                Save All Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminEmployeeDetail;
