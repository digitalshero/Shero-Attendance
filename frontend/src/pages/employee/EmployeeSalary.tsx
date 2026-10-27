import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { IndianRupee, MinusCircle, Calculator, FileText, PlusCircle, Calendar, ChevronDown, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EmployeeSalary = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrollData, setPayrollData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSalary = async () => {
      try {
        setLoading(true);
        const res = await api.get('/attendance/salary', { params: { month, year } });
        setPayrollData(res.data);
      } catch (error) {
        toast.error('Failed to load salary data');
      } finally {
        setLoading(false);
      }
    };
    fetchSalary();
  }, [month, year]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-80 space-y-3">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Calculating your payroll slip...</p>
      </div>
    );
  }

  if (!payrollData) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center">
          <FileText className="w-6 h-6 mr-2 text-teal-600" /> My Salary Slip
        </h1>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-12 text-center text-slate-500">
          No salary data found for the selected month.
        </div>
      </div>
    );
  }

  const totalDeductions = (payrollData.employeePF || 0) + (payrollData.employeeESI || 0) + (payrollData.otherDeductions || 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-700 border border-teal-100">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Monthly Payslip Statement</h1>
            <p className="text-xs text-slate-500 mt-0.5">Transparent breakdown of earned wages & statutory deductions</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
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
              onChange={(e) => setYear(Number(e.target.value))}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 py-2.5 pl-3.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            >
              <option value={now.getFullYear() - 1}>{now.getFullYear() - 1}</option>
              <option value={now.getFullYear()}>{now.getFullYear()}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Net Pay Banner (Emotional Reassurance / Peak-End Rule) */}
      <div className="bg-gradient-to-tr from-teal-900 via-teal-800 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-card relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block mb-1">Net Take-Home Salary</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl sm:text-4xl font-black tracking-tight">
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

      {/* 3 Overview Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Earned Gross</p>
          </div>
          <p className="text-xl font-extrabold text-slate-900 font-mono">
            ₹{Math.round(payrollData.earnedGross).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <MinusCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deductions</p>
          </div>
          <p className="text-xl font-extrabold text-rose-600 font-mono">
            - ₹{Math.round(totalDeductions).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Calculator className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payable Net</p>
          </div>
          <p className="text-xl font-extrabold text-emerald-600 font-mono">
            ₹{Math.round(payrollData.netSalary).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Detailed Breakdown Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="bg-slate-50/75 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-teal-600" /> Itemized Payslip Ledger
          </h3>
          <span className="text-xs font-mono font-semibold text-slate-500">{MONTHS[month - 1]} {year}</span>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Earnings Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-700 pb-2 border-b border-slate-100">
                <PlusCircle className="w-4 h-4" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider">Earnings & Allowances</h4>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Gross Base (Full Month)</span>
                  <span className="font-mono font-medium text-slate-800">₹{(payrollData.grossSalary || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Earned Basic ({payrollData.eligibleDays} days)</span>
                  <span className="font-mono font-medium text-slate-800">₹{Math.round(payrollData.earnedBasic).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Earned Gross Pay</span>
                  <span className="font-mono font-medium text-slate-800">₹{Math.round(payrollData.earnedGross).toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100">
                  <span className="font-bold text-slate-900">Total Gross Earnings</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-sm">
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
                  <span>Provident Fund (Employee PF 12%)</span>
                  <span className="font-mono font-medium text-slate-800">
                    {payrollData.employeePF > 0 ? `₹${Math.round(payrollData.employeePF).toLocaleString('en-IN')}` : '₹0 (N/A)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>ESI (Employee ESI 0.75%)</span>
                  <span className="font-mono font-medium text-slate-800">
                    {payrollData.employeeESI > 0 ? `₹${Math.round(payrollData.employeeESI).toLocaleString('en-IN')}` : '₹0 (N/A)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Other Authorized Deductions</span>
                  <span className="font-mono font-medium text-slate-800">
                    {payrollData.otherDeductions > 0 ? `₹${Math.round(payrollData.otherDeductions).toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100">
                  <span className="font-bold text-slate-900">Total Deductions</span>
                  <span className="font-mono font-extrabold text-rose-600 text-sm">
                    - ₹{Math.round(totalDeductions).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Final Net Pay Footer Box */}
          <div className="mt-8 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Net Disbursable Salary</p>
              <p className="text-[11px] text-slate-500">Credited to registered employee bank account</p>
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

export default EmployeeSalary;
