import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, IndianRupee, MinusCircle, Calculator, Building, FileText, PlusCircle, Calendar, ChevronDown, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AdminEmployeePayrollDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const now = new Date();
  
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;
  const year = Number(searchParams.get('year')) || new Date().getFullYear();

  const [payrollData, setPayrollData] = useState<any | null>(null);
  const [allPayroll, setAllPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayroll = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/payroll', { params: { month, year } });
        setAllPayroll(res.data);
        const employeePayroll = res.data.find((p: any) => p.employeeId === id);
        setPayrollData(employeePayroll);
      } catch (error) {
        console.error('Failed to fetch payroll details', error);
        toast.error('Failed to load employee payroll details');
      } finally {
        setLoading(false);
      }
    };
    fetchPayroll();
  }, [id, month, year]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-80 space-y-3">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading detailed employee payslip...</p>
      </div>
    );
  }

  if (!payrollData) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <button onClick={() => navigate('/admin/payroll')} className="btn-secondary text-xs">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Payroll
        </button>
        <div className="text-center p-12 text-slate-500 bg-white rounded-3xl shadow-card border border-slate-200">
          No payroll records found for this employee in {MONTHS[month - 1]} {year}.
        </div>
      </div>
    );
  }

  const totalDeductions = (payrollData.employeePF || 0) + (payrollData.employeeESI || 0) + (payrollData.otherDeductions || 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header with Switcher & Back Button */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/payroll')}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200/80 transition-colors"
            title="Back to master list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Individual Payslip Statement</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{payrollData.name} <span className="font-mono text-teal-600">({payrollData.employeeId})</span></p>
          </div>
        </div>
        
        {/* Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={id}
              onChange={(e) => navigate(`/admin/payroll/${e.target.value}?month=${month}&year=${year}`)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 py-2.5 pl-3.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            >
              {allPayroll.map((p) => (
                <option key={p.employeeId} value={p.employeeId}>{p.name} ({p.employeeId})</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={month}
              onChange={(e) => navigate(`/admin/payroll/${id}?month=${e.target.value}&year=${year}`)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 py-2.5 pl-3.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={year}
              onChange={(e) => navigate(`/admin/payroll/${id}?month=${month}&year=${e.target.value}`)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 py-2.5 pl-3.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            >
              <option value={now.getFullYear() - 1}>{now.getFullYear() - 1}</option>
              <option value={now.getFullYear()}>{now.getFullYear()}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Net Pay Highlight Banner */}
      <div className="bg-gradient-to-tr from-teal-900 via-teal-800 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-card relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block mb-1">Total Net Disbursable</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl sm:text-4xl font-black tracking-tight font-mono">
                ₹{Math.round(payrollData.netSalary).toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-teal-200/80 font-medium">/ month</span>
            </div>
            <p className="text-xs text-teal-100/80 mt-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Calculated on {payrollData.eligibleDays} eligible days out of {payrollData.totalWorkingDays || payrollData.daysInMonth} working days (excl. {payrollData.holidaysInMonth || 0} holidays & {payrollData.weeklyOffsInMonth || 0} weekly offs).
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/10 text-right">
            <p className="text-[10px] text-teal-200 uppercase font-semibold">Attendance Ratio</p>
            <p className="text-xl font-extrabold font-mono text-white mt-0.5">
              {Math.round((payrollData.eligibleDays / (payrollData.totalWorkingDays || payrollData.daysInMonth || 1)) * 100)}%
            </p>
            <p className="text-[10px] text-teal-200/70">{payrollData.eligibleDays} / {payrollData.totalWorkingDays || payrollData.daysInMonth} Working Days</p>
          </div>
        </div>
      </div>

      {/* Attendance & Salary Config Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attendance Summary */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-teal-600" /> Attendance Overview
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <p className="text-xs text-slate-400 font-semibold mb-1">Calendar Days</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono">{payrollData.daysInMonth}</p>
            </div>
            <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-100 text-center">
              <p className="text-xs text-teal-700 font-bold mb-1">Worked Days</p>
              <p className="text-xl font-extrabold text-teal-800 font-mono">{payrollData.eligibleDays}</p>
            </div>
          </div>
        </div>

        {/* Salary Configuration summary */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center">
            <FileText className="w-4 h-4 mr-2 text-teal-600" /> Compensation Profile
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Gross Base (Full Month)</span>
              <span className="font-mono font-bold text-slate-800">₹{(payrollData.grossSalary || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Basic Base (Full Month)</span>
              <span className="font-mono font-bold text-slate-800">₹{(payrollData.basicSalary || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 pt-2 border-t border-slate-100">
              <span>PF Participation</span>
              <span className={`font-bold ${payrollData.employeePF > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                {payrollData.employeePF > 0 ? 'Applicable (12%)' : 'Exempt'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>ESI Coverage</span>
              <span className={`font-bold ${payrollData.employeeESI > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                {payrollData.employeeESI > 0 ? 'Applicable (0.75%)' : 'Exempt'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Salary Payslip Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="bg-slate-50/75 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-teal-600" /> Itemized Payroll Ledger
          </h3>
          <span className="text-xs font-mono font-semibold text-slate-500">{MONTHS[month - 1]} {year}</span>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Earnings Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-700 pb-2 border-b border-slate-100">
                <PlusCircle className="w-4 h-4" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider">Earned Allowances</h4>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Earned Gross Pay</span>
                  <span className="font-mono font-medium text-slate-800">₹{Math.round(payrollData.earnedGross).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 italic text-[11px]">
                  <span>(Computed on {payrollData.eligibleDays} days present)</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100">
                  <span className="font-bold text-slate-900">Total Gross</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    ₹{Math.round(payrollData.earnedGross).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Deductions Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-rose-700 pb-2 border-b border-slate-100">
                <MinusCircle className="w-4 h-4" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider">Statutory & Other Deductions</h4>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Employee PF (12%)</span>
                  <span className="font-mono font-medium text-slate-800">
                    {payrollData.employeePF > 0 ? `₹${Math.round(payrollData.employeePF).toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Employee ESI (0.75%)</span>
                  <span className="font-mono font-medium text-slate-800">
                    {payrollData.employeeESI > 0 ? `₹${Math.round(payrollData.employeeESI).toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Other Deductions</span>
                  <span className="font-mono font-medium text-slate-800">
                    {payrollData.otherDeductions > 0 ? `₹${Math.round(payrollData.otherDeductions).toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100">
                  <span className="font-bold text-slate-900">Total Deductions</span>
                  <span className="font-mono font-black text-rose-600 text-sm">
                    - ₹{Math.round(totalDeductions).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Employer Contributions */}
          {(payrollData.employerPF > 0 || payrollData.employerESI > 0) && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                <Building className="w-4 h-4 mr-1.5 text-slate-400" /> Employer Statutory Liability (Non-Deductible)
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between">
                  <span className="text-slate-500">Employer PF Contribution (12%):</span>
                  <span className="font-mono font-bold text-slate-800">₹{Math.round(payrollData.employerPF).toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between">
                  <span className="text-slate-500">Employer ESI Contribution (3.25%):</span>
                  <span className="font-mono font-bold text-slate-800">₹{Math.round(payrollData.employerESI).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Final Net Pay Footer Box */}
          <div className="mt-8 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Disbursable Amount</p>
              <p className="text-[11px] text-slate-500">Net salary to transfer to employee</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-teal-700">
                ₹{Math.round(payrollData.netSalary).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEmployeePayrollDetail;
