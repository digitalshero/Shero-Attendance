import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import EmployeeLayout from './layouts/EmployeeLayout';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';

import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminEmployeeDetail from './pages/admin/AdminEmployeeDetail';
import AdminEmployeeAttendance from './pages/admin/AdminEmployeeAttendance';
import AdminSettings from './pages/admin/AdminSettings';
import AttendanceHistory from './pages/employee/AttendanceHistory';
import EmployeePermissions from './pages/employee/EmployeePermissions';
import AdminPermissions from './pages/admin/AdminPermissions';
import AdminMonthlyReport from './pages/admin/AdminMonthlyReport';
import { Toaster } from 'react-hot-toast';

const PrivateRoute = ({ children, role }: { children: React.ReactElement, role?: string }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/employee'} />;
  }
  return children;
};

const IndexRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/employee'} replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/" element={<IndexRedirect />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="/employee" element={
            <PrivateRoute role="EMPLOYEE">
              <EmployeeLayout />
            </PrivateRoute>
          }>
            <Route index element={<EmployeeDashboard />} />
            <Route path="attendance" element={<AttendanceHistory />} />
            <Route path="permissions" element={<EmployeePermissions />} />
          </Route>

          <Route path="/admin" element={
            <PrivateRoute role="ADMIN">
              <AdminLayout />
            </PrivateRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="employees/:id" element={<AdminEmployeeDetail />} />
            <Route path="employees/:id/attendance" element={<AdminEmployeeAttendance />} />
            <Route path="permissions" element={<AdminPermissions />} />
            <Route path="reports" element={<AdminMonthlyReport />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          
          <Route path="*" element={<IndexRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
