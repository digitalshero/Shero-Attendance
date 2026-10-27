import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { IndianRupee, Download, Eye, Calculator, Users, CheckCircle2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AdminPayroll = () => {
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const navigate = useNavigate();

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/payroll', { params: { month, year } });
      setPayroll(res.data);
    } catch (error) {
      console.error('Failed to fetch payroll', error);
      toast.error('Failed to calculate payroll');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [month, year]);

  const totalDisbursal = payroll.reduce((acc, curr) => acc + (curr.netSalary || 0), 0);
  const totalGross = payroll.reduce((acc, curr) => acc + (curr.earnedGross || 0), 0);

  const downloadCSV = () => {
    if (!payroll.length) return;
    
    const headers = ['Employee ID', 'Name', 'Gross Salary', 'Basic Salary', 'Eligible Days', 'Days in Month', 'Earned Gross', 'Earned Basic', 'Employee PF', 'Employee ESI', 'Other Deductions', 'Net Salary'];
    const rows = payroll.map(p => [
      p.employeeId,
      `"${p.name}"`,
      p.grossSalary || 0,
      p.basicSalary || 0,
      p.eligibleDays,
      p.daysInMonth,
      p.earnedGross.toFixed(2),
      p.earnedBasic.toFixed(2),
      p.employeePF.toFixed(2),
      p.employeeESI.toFixed(2),
      p.otherDeductions,
      p.netSalary.toFixed(2)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Shero_Payroll_${MONTHS[month-1]}_${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-700 border border-teal-100">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Executive Payroll Engine</h1>
            <p className="text-xs text-slate-500 mt-0.5">Automated statutory computations, PF/ESI & bank payouts</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            onClick={downloadCSV}
            disabled={loading || payroll.length === 0}
            className="btn-primary shadow-glow-teal text-xs"
            title="Export CSV Statement"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Disbursal Pool</p>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            ₹{Math.round(totalDisbursal).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Headcount</p>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {payroll.length} Employees
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Calculator className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Labor Cost</p>
          </div>
          <p className="text-2xl font-black text-indigo-700 font-mono">
            ₹{Math.round(totalGross).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white shadow-card rounded-3xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/75">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Base</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Eligible Days</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Net Payable</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs">Computing payroll ledger...</td></tr>
              ) : payroll.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">No payroll data available for this month.</td></tr>
              ) : (
                payroll.map((p) => (
                  <tr key={p.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center text-xs border border-teal-100">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{p.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-slate-700">
                      {p.grossSalary ? `₹${p.grossSalary.toLocaleString('en-IN')}` : 'Not set'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-center text-slate-800">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                        {p.eligibleDays} / {p.daysInMonth}d
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                        ₹{Math.round(p.netSalary).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => navigate(`/admin/payroll/${p.employeeId}?month=${month}&year=${year}`)}
                        className="inline-flex items-center text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-xl border border-teal-200 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Itemized Slip
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
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-card">Computing payroll...</div>
        ) : payroll.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-card">No payroll data available.</div>
        ) : (
          payroll.map((p) => (
            <div key={p.employeeId} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-3">
              <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                <div>
                  <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                  <span className="text-[10px] font-mono text-slate-400">{p.employeeId}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Pay</span>
                  <span className="text-xs font-black font-mono text-emerald-700">₹{Math.round(p.netSalary).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Gross Salary</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px] block">{p.grossSalary ? `₹${p.grossSalary.toLocaleString('en-IN')}` : 'Not set'}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Worked</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px] block">{p.eligibleDays} / {p.daysInMonth} Days</span>
                </div>
              </div>

              <button 
                onClick={() => navigate(`/admin/payroll/${p.employeeId}?month=${month}&year=${year}`)}
                className="w-full py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs rounded-xl border border-teal-200 flex items-center justify-center gap-1 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> View Itemized Payslip
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPayroll;
