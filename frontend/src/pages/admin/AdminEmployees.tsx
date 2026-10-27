import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import { 
  Eye, 
  EyeOff, 
  X, 
  Calendar, 
  Plus, 
  IndianRupee, 
  Edit, 
  UserCheck, 
  UserCog, 
  Pencil, 
  Search, 
  ShieldCheck, 
  Users, 
  Building2, 
  Briefcase, 
  Home, 
  ArrowRight, 
  ArrowLeft,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileUp,
  RefreshCw,
  FileText,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

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

const AdminEmployees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  
  const initialForm = {
    name: '',
    email: '',
    password: '',
    employeeId: '',
    department: '',
    designation: '',
    dateOfBirth: '',
    status: 'ACTIVE',
    workMode: 'WFO',
    isSsc: false,
    rollType: 'ON_ROLL',
    reportingManagerId: '',
    basicSalary: '',
    grossSalary: '',
    pfApplicable: false,
    esiApplicable: false,
    otherDeductions: '',
  };
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Excel Import State
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelParsedRows, setExcelParsedRows] = useState<any[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [importingExcel, setImportingExcel] = useState(false);
  const [excelFilter, setExcelFilter] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');
  
  // Edit Employee State
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    employee: any;
    form: typeof initialForm;
    showPassword: boolean;
  }>({
    isOpen: false,
    employee: null,
    form: initialForm,
    showPassword: false,
  });

  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        'Employee ID': 'SH001',
        'Full Name': 'Priya Sharma',
        'Email': 'priya.sharma@sherohomefood.com',
        'Password': 'Password@123',
        'Department': 'TECH',
        'Work Mode': 'WFO',
        'Status': 'ACTIVE',
        'Is SSC': 'NO',
        'Reporting Manager ID': 'ADMIN01',
      },
      {
        'Employee ID': 'SH002',
        'Full Name': 'Karthik Raja',
        'Email': 'karthik.raja@sherohomefood.com',
        'Password': 'Password@123',
        'Department': 'HR',
        'Work Mode': 'HYBRID',
        'Status': 'ACTIVE',
        'Is SSC': 'NO',
        'Reporting Manager ID': '',
      },
      {
        'Employee ID': 'SH003',
        'Full Name': 'Ananya Nair',
        'Email': 'ananya.nair@sherohomefood.com',
        'Password': 'Password@123',
        'Department': 'DST',
        'Work Mode': 'WFH',
        'Status': 'ACTIVE',
        'Is SSC': 'YES',
        'Reporting Manager ID': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'Shero_Employee_Import_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          toast.error('The uploaded Excel file appears to be empty.');
          return;
        }

        const parsedRows = data.map((row, idx) => {
          const findField = (...names: string[]) => {
            for (const key of Object.keys(row)) {
              const cleanKey = key.trim().toLowerCase().replace(/[\s_\-.]+/g, '');
              for (const name of names) {
                const cleanName = name.toLowerCase().replace(/[\s_\-.]+/g, '');
                if (cleanKey === cleanName) return row[key];
              }
            }
            return undefined;
          };

          const name = String(findField('Full Name', 'Name', 'Employee Name', 'employeeName', 'fullname', 'Staff Name') || '').trim();
          const email = String(findField('Email', 'Email ID', 'emailAddress', 'Email Address', 'Mail') || '').trim().toLowerCase();
          const employeeId = String(findField('Employee ID', 'EmployeeID', 'Emp ID', 'EmpID', 'ID', 'Staff ID', 'Code') || '').trim();
          const password = String(findField('Password', 'Pass', 'PWD') || '').trim();
          const department = String(findField('Department', 'Dept', 'team', 'Division') || '').trim();
          const workModeRaw = String(findField('Work Mode', 'WorkMode', 'Mode') || 'WFO').trim().toUpperCase();
          const workMode = ['WFO', 'WFH', 'HYBRID'].includes(workModeRaw) ? workModeRaw : 'WFO';
          const statusRaw = String(findField('Status', 'Emp Status', 'Account Status') || 'ACTIVE').trim().toUpperCase();
          const status = ['ACTIVE', 'INACTIVE', 'STOPPED'].includes(statusRaw) ? statusRaw : 'ACTIVE';
          const isSscRaw = findField('Is SSC', 'IsSSC', 'SSC', 'Special');
          const isSsc = Boolean(
            isSscRaw === true || 
            String(isSscRaw).toLowerCase() === 'true' || 
            String(isSscRaw).toLowerCase() === 'yes' || 
            String(isSscRaw) === '1'
          );
          const reportingManagerId = String(findField('Reporting Manager ID', 'Manager ID', 'Manager', 'Reporting Manager') || '').trim();

          const errors: string[] = [];
          if (!name) errors.push('Name missing');
          if (!email) errors.push('Email missing');
          else if (!email.includes('@')) errors.push('Invalid email');
          if (!employeeId) errors.push('Employee ID missing');

          return {
            id: idx + 1,
            name,
            email,
            employeeId,
            password: password || `${employeeId || 'Welcome'}@123`,
            department,
            workMode,
            status,
            isSsc,
            reportingManagerId,
            isValid: errors.length === 0,
            errors,
          };
        });

        // Check for duplicate emails/IDs within file
        const seenEmails = new Set<string>();
        const seenEmpIds = new Set<string>();
        for (const r of parsedRows) {
          if (r.email) {
            if (seenEmails.has(r.email)) {
              r.isValid = false;
              r.errors.push(`Duplicate email in file`);
            } else {
              seenEmails.add(r.email);
            }
          }
          if (r.employeeId) {
            if (seenEmpIds.has(r.employeeId.toLowerCase())) {
              r.isValid = false;
              r.errors.push(`Duplicate Emp ID in file`);
            } else {
              seenEmpIds.add(r.employeeId.toLowerCase());
            }
          }
        }

        setExcelParsedRows(parsedRows);
        setExcelFileName(file.name);
        toast.success(`Successfully loaded ${parsedRows.length} rows from ${file.name}`);
      } catch (error) {
        console.error('Failed to parse Excel file', error);
        toast.error('Failed to read Excel file. Please ensure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportExcelData = async () => {
    const validRows = excelParsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid rows found to import.');
      return;
    }

    setImportingExcel(true);
    try {
      const res = await api.post('/admin/employees/bulk-import', {
        employees: validRows.map((r) => ({
          name: r.name,
          email: r.email,
          employeeId: r.employeeId,
          password: r.password,
          department: r.department,
          workMode: r.workMode,
          status: r.status,
          isSsc: r.isSsc,
          reportingManagerId: r.reportingManagerId,
        })),
      });

      toast.success(res.data.message || `Imported ${res.data.importedCount} employees successfully!`);
      if (res.data.skippedCount > 0) {
        toast(
          `${res.data.skippedCount} records skipped (already exist in database).`,
          { icon: 'ℹ️' }
        );
      }
      setShowExcelModal(false);
      setExcelParsedRows([]);
      setExcelFileName('');
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to import employees');
    } finally {
      setImportingExcel(false);
    }
  };

  const viewAttendanceHistory = (emp: any) => {
    navigate(`/admin/employees/${emp.employeeId}/attendance`);
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const [empRes, mgrRes, settingsRes] = await Promise.all([
        api.get('/admin/employees'),
        api.get('/admin/managers'),
        api.get('/admin/settings').catch(() => ({ data: { departments: DEFAULT_DEPARTMENTS } })),
      ]);
      setEmployees(empRes.data);
      setManagers(mgrRes.data);
      if (settingsRes?.data?.departments && Array.isArray(settingsRes.data.departments) && settingsRes.data.departments.length > 0) {
        setDepartments(settingsRes.data.departments);
      }
    } catch (error) {
      console.error('Failed to fetch employees/managers', error);
      toast.error('Failed to load employee directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setEditModal({
      ...editModal,
      form: { ...editModal.form, [e.target.name]: value },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Please enter employee full name');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Please enter email address');
      return;
    }
    if (!form.employeeId.trim()) {
      toast.error('Please enter Employee ID');
      return;
    }
    if (!form.password.trim()) {
      toast.error('Please enter a secure password');
      return;
    }
    try {
      await api.post('/admin/employees', form);
      toast.success('Employee created successfully!');
      setForm(initialForm);
      setShowForm(false);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create employee');
    }
  };

  const openEditModal = (emp: any) => {
    setEditModal({
      isOpen: true,
      employee: emp,
      showPassword: false,
      form: {
        name: emp.name || '',
        email: emp.email || '',
        password: '',
        employeeId: emp.employeeId || '',
        department: emp.department || '',
        designation: emp.designation || '',
        dateOfBirth: emp.dateOfBirth || '',
        status: emp.status || 'ACTIVE',
        workMode: emp.workMode || 'WFO',
        isSsc: Boolean(emp.isSsc),
        rollType: emp.rollType || emp.roleType || emp.employmentType || 'ON_ROLL',
        reportingManagerId: emp.reportingManager?.id || emp.reportingManagerId || '',
        basicSalary: emp.basicSalary !== undefined ? String(emp.basicSalary) : '',
        grossSalary: emp.grossSalary !== undefined ? String(emp.grossSalary) : '',
        pfApplicable: Boolean(emp.pfApplicable),
        esiApplicable: Boolean(emp.esiApplicable),
        otherDeductions: emp.otherDeductions !== undefined ? String(emp.otherDeductions) : '',
      },
    });
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.employee) return;
    try {
      await api.put(`/admin/employees/${editModal.employee._id}`, editModal.form);
      toast.success('Employee details & profile updated successfully!');
      setEditModal({ isOpen: false, employee: null, form: initialForm, showPassword: false });
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update employee');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDept = departmentFilter === 'ALL' || emp.department === departmentFilter;

    let matchesStatus = true;
    if (statusFilter === 'WFO') matchesStatus = emp.workMode === 'WFO' || !emp.workMode;
    else if (statusFilter === 'WFH') matchesStatus = emp.workMode === 'WFH';
    else if (statusFilter === 'HYBRID') matchesStatus = emp.workMode === 'HYBRID';
    else if (statusFilter === 'SSC') matchesStatus = Boolean(emp.isSsc);
    else if (statusFilter === 'ON_ROLL') matchesStatus = !['OFF_ROLL', 'OFF_ROLE'].includes(emp.rollType) && !['OFF_ROLL', 'OFF_ROLE'].includes(emp.roleType) && !['OFF_ROLL', 'OFF_ROLE'].includes(emp.employmentType);
    else if (statusFilter === 'OFF_ROLL') matchesStatus = ['OFF_ROLL', 'OFF_ROLE'].includes(emp.rollType) || ['OFF_ROLL', 'OFF_ROLE'].includes(emp.roleType) || ['OFF_ROLL', 'OFF_ROLE'].includes(emp.employmentType);
    else if (statusFilter !== 'ALL') matchesStatus = emp.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-700 border border-teal-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Staff Master Directory</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage work modes (WFO / WFH / Hybrid / SSC), credentials & account settings</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setShowExcelModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-2xs flex-1 sm:flex-initial"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import from Excel</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary w-full sm:w-auto shadow-glow-teal flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add New Employee
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1 max-w-xl">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, ID, email, dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
            />
          </div>

          <div className="relative w-full sm:w-48">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-56">
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
          >
            <option value="ALL">All Employees ({employees.length})</option>
            <option value="WFO">🏢 WFO Office</option>
            <option value="WFH">🏠 WFH Remote</option>
            <option value="HYBRID">🏢+🏠 Hybrid</option>
            <option value="SSC">⚡ SSC Employee</option>
            <option value="ON_ROLL">On-roll</option>
            <option value="OFF_ROLL">Off-roll</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="STOPPED">On Leave</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/75">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Employee ID</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Work Mode</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs">Loading directory...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">No matching employees found.</td></tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-800">
                      <Link to={`/admin/employees/${emp._id}`} className="hover:text-teal-600 transition-colors">
                        {emp.employeeId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/admin/employees/${emp._id}`} className="flex items-center space-x-3 group">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center text-xs border border-teal-100 group-hover:scale-105 transition-transform">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{emp.name}</p>
                          <p className="text-[10px] text-slate-400">{emp.email}</p>
                          {emp.designation && <p className="text-[10px] text-teal-600 font-semibold">{emp.designation}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {emp.department ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                          <Briefcase className="w-3 h-3 mr-1 text-teal-600" />
                          {emp.department}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {emp.workMode === 'HYBRID' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <span className="mr-1 text-xs">🏢+🏠</span>
                            Hybrid (Flex)
                          </span>
                        ) : emp.workMode === 'WFH' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Home className="w-3 h-3 mr-1 text-indigo-500" />
                            WFH (Remote)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            <Building2 className="w-3 h-3 mr-1 text-teal-600" />
                            WFO (Office)
                          </span>
                        )}
                        {emp.isSsc && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                            ⚡ SSC
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-[11px] font-bold rounded-full border ${
                        emp.status === 'ACTIVE' ? 'bg-slate-100 text-slate-700 border-slate-200' : 
                        emp.status === 'WORKING' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        emp.status === 'STOPPED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        emp.status === 'CHECKED_OUT' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {emp.status === 'STOPPED' ? 'LEAVE' : emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => viewAttendanceHistory(emp)}
                        className="inline-flex items-center text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-colors"
                        title="View Attendance History"
                      >
                        <Calendar className="w-3.5 h-3.5 mr-1" /> History
                      </button>
                      <button
                        onClick={() => openEditModal(emp)}
                        className="inline-flex items-center text-xs font-bold text-slate-700 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors"
                        title="Edit Employee Profile & Credentials"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1 text-teal-600" /> Edit
                      </button>
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
            Loading directory...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-card">
            No matching employees found.
          </div>
        ) : (
          filteredEmployees.map((emp) => (
            <div key={emp._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-3">
              <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                <Link to={`/admin/employees/${emp._id}`} className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center text-xs border border-teal-100">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">{emp.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{emp.employeeId}</p>
                  </div>
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  {emp.department && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {emp.department}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    emp.workMode === 'HYBRID' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    emp.workMode === 'WFH' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                    'bg-teal-50 text-teal-700 border-teal-200'
                  }`}>
                    {emp.workMode === 'HYBRID' ? '🏢+🏠 Hybrid' : emp.workMode === 'WFH' ? '🏠 WFH' : '🏢 WFO'}
                  </span>
                  {emp.isSsc && (
                    <span className="px-1.5 py-0.5 text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 rounded-full">
                      ⚡ SSC
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    emp.status === 'ACTIVE' ? 'bg-slate-100 text-slate-700 border-slate-200' : 
                    emp.status === 'WORKING' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    emp.status === 'STOPPED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    emp.status === 'CHECKED_OUT' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {emp.status === 'STOPPED' ? 'LEAVE' : emp.status}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => viewAttendanceHistory(emp)}
                  className="flex-1 py-2 px-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs rounded-xl border border-teal-200 flex items-center justify-center gap-1"
                >
                  <Calendar className="w-3.5 h-3.5" /> History
                </button>
                <button
                  onClick={() => openEditModal(emp)}
                  className="flex-1 py-2 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5 text-teal-600" /> Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Employee Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white w-full rounded-3xl shadow-2xl max-w-xl overflow-hidden border border-slate-100 animate-slide-up flex flex-col max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">Add New Employee</h2>
                    <p className="text-[11px] text-slate-500">Configure work mode policy, credentials & salary</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowForm(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form id="createEmployeeForm" onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Section 1: Work Mode Policy */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Work Mode Policy
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, workMode: 'WFO' })}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      form.workMode === 'WFO'
                        ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg ${form.workMode === 'WFO' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      {form.workMode === 'WFO' && <span className="w-2 h-2 rounded-full bg-teal-600"></span>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Office (WFO)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">500m Geofence required.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, workMode: 'WFH' })}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      form.workMode === 'WFH'
                        ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg ${form.workMode === 'WFH' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Home className="w-4 h-4" />
                      </div>
                      {form.workMode === 'WFH' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Home (WFH)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Remote sign-in anywhere.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, workMode: 'HYBRID' })}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      form.workMode === 'HYBRID'
                        ? 'bg-purple-50/90 border-purple-600 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg ${form.workMode === 'HYBRID' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <span className="text-xs font-bold">🏢+🏠</span>
                      </div>
                      {form.workMode === 'HYBRID' && <span className="w-2 h-2 rounded-full bg-purple-600"></span>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-purple-900">Hybrid (Flex)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Works office & home.</p>
                    </div>
                  </button>
                </div>

                {/* SSC Option Checkbox Card */}
                <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="isSscCheckbox"
                    name="isSsc"
                    checked={form.isSsc}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="isSscCheckbox" className="cursor-pointer">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <span>⚡</span> SSC Employee Policy (Works on Holidays & Weekends)
                    </p>
                    <p className="text-[11px] text-amber-700/90 mt-0.5 leading-snug">
                      Allows login & attendance on company holidays/Sundays and enables compensatory weekday week off requests (applies to WFO, WFH, and Hybrid employees).
                    </p>
                  </label>
                </div>
              </div>

              {/* Section 2: Basic Credentials */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Basic Credentials
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input name="name" required placeholder="e.g. John Doe" value={form.name} onChange={handleChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input name="email" required placeholder="john@company.com" type="email" value={form.email} onChange={handleChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
                    <input name="employeeId" required placeholder="EMP001" value={form.employeeId} onChange={handleChange} className="form-input font-mono text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input name="password" required placeholder="••••••••" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} className="form-input pr-10 text-xs" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Organization & Reporting */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  3. Organization & Reporting
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <select
                      name="department"
                      value={form.department}
                      onChange={handleChange}
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Manager</label>
                    <select
                      name="reportingManagerId"
                      value={form.reportingManagerId}
                      onChange={handleChange}
                      className="form-input text-xs"
                    >
                      <option value="">None (Independent / Admin)</option>
                      {managers.map((mgr) => (
                        <option key={mgr._id} value={mgr._id}>
                          {mgr.name} ({mgr.employeeId}) {mgr.role === 'ADMIN' ? '— Admin' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                    <input name="designation" placeholder="e.g. Software Engineer" type="text" value={form.designation} onChange={handleChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                    <select name="status" value={form.status} onChange={handleChange} className="form-input text-xs">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Type</label>
                    <select name="rollType" value={form.rollType} onChange={handleChange} className="form-input text-xs">
                      <option value="ON_ROLL">On-roll</option>
                      <option value="OFF_ROLL">Off-roll</option>
                    </select>
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer Controls - Sticky at bottom */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="btn-secondary px-5 py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="createEmployeeForm"
                className="btn-primary px-6 py-2.5 text-xs font-bold shadow-glow-teal"
              >
                Create Staff Member
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Full Employee Modal */}
      {editModal.isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white w-full rounded-3xl shadow-2xl max-w-xl overflow-hidden border border-slate-100 animate-slide-up flex flex-col max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Edit Staff Profile</h2>
                  <p className="text-[11px] text-slate-500">Switch work mode policy, ID & credentials</p>
                </div>
              </div>
              <button
                onClick={() => setEditModal({ isOpen: false, employee: null, form: initialForm, showPassword: false })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form id="editEmployeeForm" onSubmit={handleUpdateEmployee} className="p-6 space-y-5 overflow-y-auto flex-1">
              
              {/* Section 1: Work Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Work Mode Policy
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, workMode: 'WFO' } })}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      editModal.form.workMode === 'WFO'
                        ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg shrink-0 ${editModal.form.workMode === 'WFO' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      {editModal.form.workMode === 'WFO' && <span className="w-2 h-2 rounded-full bg-teal-600"></span>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Office (WFO)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">500m Geofence.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, workMode: 'WFH' } })}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      editModal.form.workMode === 'WFH'
                        ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg shrink-0 ${editModal.form.workMode === 'WFH' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Home className="w-4 h-4" />
                      </div>
                      {editModal.form.workMode === 'WFH' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Remote (WFH)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Remote sign-in.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, workMode: 'HYBRID' } })}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      editModal.form.workMode === 'HYBRID'
                        ? 'bg-purple-50/90 border-purple-600 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg shrink-0 ${editModal.form.workMode === 'HYBRID' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <span className="text-xs font-bold">🏢+🏠</span>
                      </div>
                      {editModal.form.workMode === 'HYBRID' && <span className="w-2 h-2 rounded-full bg-purple-600"></span>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-purple-900">Hybrid (Flex)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Office & Home.</p>
                    </div>
                  </button>
                </div>

                {/* SSC Option Checkbox Card */}
                <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="editIsSscCheckbox"
                    name="isSsc"
                    checked={editModal.form.isSsc}
                    onChange={handleEditChange}
                    className="mt-1 h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="editIsSscCheckbox" className="cursor-pointer">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <span>⚡</span> SSC Employee Policy (Works on Holidays & Weekends)
                    </p>
                    <p className="text-[11px] text-amber-700/90 mt-0.5 leading-snug">
                      Allows login & attendance on company holidays/Sundays and enables compensatory weekday week off requests (applies to WFO, WFH, and Hybrid employees).
                    </p>
                  </label>
                </div>
              </div>

              {/* Section 2: Account & Organization Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Account & Organization
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input name="name" required value={editModal.form.name} onChange={handleEditChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input name="email" required type="email" value={editModal.form.email} onChange={handleEditChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
                    <input name="employeeId" required value={editModal.form.employeeId} onChange={handleEditChange} className="form-input font-mono text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Password</label>
                    <div className="relative">
                      <input
                        name="password"
                        placeholder="Leave blank to keep current"
                        type={editModal.showPassword ? 'text' : 'password'}
                        value={editModal.form.password}
                        onChange={handleEditChange}
                        className="form-input pr-10 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setEditModal({ ...editModal, showPassword: !editModal.showPassword })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {editModal.showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <select
                      name="department"
                      value={editModal.form.department}
                      onChange={handleEditChange}
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
                    <input name="designation" placeholder="e.g. Software Engineer" type="text" value={editModal.form.designation} onChange={handleEditChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input name="dateOfBirth" type="date" value={editModal.form.dateOfBirth} onChange={handleEditChange} className="form-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                    <select name="status" value={editModal.form.status} onChange={handleEditChange} className="form-input text-xs">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Type</label>
                    <select name="rollType" value={editModal.form.rollType} onChange={handleEditChange} className="form-input text-xs">
                      <option value="ON_ROLL">On-roll</option>
                      <option value="OFF_ROLL">Off-roll</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Manager</label>
                    <select
                      name="reportingManagerId"
                      value={editModal.form.reportingManagerId}
                      onChange={handleEditChange}
                      className="form-input text-xs"
                    >
                      <option value="">None (Independent / Admin)</option>
                      {managers
                        .filter((m) => m._id !== editModal.employee?._id)
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

            {/* Modal Footer - Sticky at bottom */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditModal({ isOpen: false, employee: null, form: initialForm, showPassword: false })}
                className="btn-secondary px-5 py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="editEmployeeForm"
                className="btn-primary px-6 py-2.5 text-xs font-bold shadow-glow-teal"
              >
                Save All Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import Employees from Excel Modal */}
      {showExcelModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 sm:p-7 border border-slate-100 animate-slide-up space-y-5 my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Import Employees from Excel / CSV</h3>
                  <p className="text-xs text-slate-500">Upload your staff spreadsheet to batch-create employee accounts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setExcelParsedRows([]);
                  setExcelFileName('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & Instructions Card */}
            <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  Need the Excel Format?
                </h4>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  Download our pre-structured template containing standard columns (<code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[10px]">Employee ID</code>, <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[10px]">Full Name</code>, <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[10px]">Email</code>, <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[10px]">Department</code>, <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[10px]">Work Mode</code>, <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[10px]">Is SSC</code>) and sample rows.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSampleExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>

            {/* File Upload / Drop Area */}
            {excelParsedRows.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-3xl text-center space-y-3 bg-slate-50/50 hover:bg-emerald-50/30 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Click to browse or drag & drop your Excel / CSV file
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                {/* Stats & Filters Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      File: <span className="font-mono text-emerald-800">{excelFileName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setExcelParsedRows([]);
                        setExcelFileName('');
                      }}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 underline ml-1"
                    >
                      Remove & re-upload
                    </button>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExcelFilter('ALL')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                        excelFilter === 'ALL'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({excelParsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelFilter('VALID')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                        excelFilter === 'VALID'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Valid Ready ({excelParsedRows.filter((r) => r.isValid).length})
                    </button>
                    {excelParsedRows.filter((r) => !r.isValid).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExcelFilter('INVALID')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                          excelFilter === 'INVALID'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        Issues ({excelParsedRows.filter((r) => !r.isValid).length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Preview */}
                <div className="overflow-x-auto border border-slate-200/80 rounded-2xl flex-1 max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="px-3.5 py-2.5">#</th>
                        <th className="px-3.5 py-2.5">Status</th>
                        <th className="px-3.5 py-2.5">Emp ID</th>
                        <th className="px-3.5 py-2.5">Name</th>
                        <th className="px-3.5 py-2.5">Email</th>
                        <th className="px-3.5 py-2.5">Department</th>
                        <th className="px-3.5 py-2.5">Work Mode</th>
                        <th className="px-3.5 py-2.5">SSC Policy</th>
                        <th className="px-3.5 py-2.5">Validation Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {excelParsedRows
                        .filter((r) => {
                          if (excelFilter === 'VALID') return r.isValid;
                          if (excelFilter === 'INVALID') return !r.isValid;
                          return true;
                        })
                        .map((row) => (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              row.isValid ? 'hover:bg-slate-50/70' : 'bg-rose-50/30 hover:bg-rose-50/50'
                            }`}
                          >
                            <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-400">{row.id}</td>
                            <td className="px-3.5 py-2.5">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  Issue
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">{row.employeeId || '-'}</td>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-800">{row.name || '-'}</td>
                            <td className="px-3.5 py-2.5 text-slate-600 font-mono text-[11px]">{row.email || '-'}</td>
                            <td className="px-3.5 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                {row.department || 'General'}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                row.workMode === 'WFH' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                row.workMode === 'HYBRID' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                'bg-teal-50 text-teal-700 border-teal-200'
                              }`}>
                                {row.workMode}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5">
                              {row.isSsc ? (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  ⚡ SSC Yes
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">No</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5">
                              {row.errors.length > 0 ? (
                                <span className="text-[11px] text-rose-600 font-medium">{row.errors.join(', ')}</span>
                              ) : (
                                <span className="text-[11px] text-emerald-600">Password: {row.password}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
                  <span>
                    💡 Any records with existing email or employee ID already in database will be safely skipped.
                  </span>
                  <span className="font-semibold text-slate-700">
                    {excelParsedRows.filter((r) => r.isValid).length} of {excelParsedRows.length} valid
                  </span>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setExcelParsedRows([]);
                  setExcelFileName('');
                }}
                className="btn-secondary px-5 py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportExcelData}
                disabled={importingExcel || excelParsedRows.filter((r) => r.isValid).length === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importingExcel ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>
                  Import {excelParsedRows.filter((r) => r.isValid).length} Employees
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminEmployees;
