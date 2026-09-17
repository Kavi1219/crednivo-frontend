import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { CrednivoProvider } from '../context/CrednivoContext';
import { useAuth } from '../context/AuthContext';
import Login, { AuthLoading } from '../pages/Auth/Login';
import RegisterCompany from '../pages/Auth/RegisterCompany';
import RegisterAgent from '../pages/Auth/RegisterAgent';
import DownloadApp from '../pages/DownloadApp/DownloadApp';
import Dashboard from '../pages/Dashboard/Dashboard';
import TodayReport from '../pages/TodayReport/TodayReport';
import Customers from '../pages/Customers/Customers';
import NewCustomer from '../pages/Customers/NewCustomer';
import CustomerDetails from '../pages/Customers/CustomerDetails';
import Loans from '../pages/Loans/Loans';
import CreateLoan from '../pages/Loans/CreateLoan';
import Collection from '../pages/Collection/Collection';
import Payments from '../pages/Payments/Payments';
import Capital from '../pages/Capital/Capital';
import Savings from '../pages/Savings/Savings';
import Expenses from '../pages/Expenses/Expenses';
import Reports from '../pages/Reports/Reports';
import Agents from '../pages/Agents/Agents';
import Settings from '../pages/Settings/Settings';

function ProtectedWorkspace() {
  const { loading, user, status } = useAuth();
  if (loading) return <AuthLoading />;
  if (status?.ownerSetupRequired) return <Navigate to="/register/company" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <CrednivoProvider><MainLayout /></CrednivoProvider>;
}

function OwnerOnly() {
  const { user } = useAuth();
  return user?.role === 'OWNER' ? <Outlet /> : <Navigate to="/settings" replace />;
}

function PermissionOnly({ permission }) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <Outlet /> : <Navigate to="/settings" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/download" element={<DownloadApp />} />
      <Route path="/register/company" element={<RegisterCompany />} />
      <Route path="/register/agent" element={<RegisterAgent />} />
      <Route path="/setup-owner" element={<Navigate to="/register/company" replace />} />
      <Route element={<ProtectedWorkspace />}>
        <Route element={<PermissionOnly permission="overview.view" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/overview" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
        </Route>
        <Route element={<PermissionOnly permission="todayReport.view" />}><Route path="/today-report" element={<TodayReport />} /></Route>
        <Route element={<PermissionOnly permission="customers.view" />}>
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/daily" element={<Customers />} />
          <Route path="/customers/weekly" element={<Customers />} />
          <Route path="/customers/monthly" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetails />} />
        </Route>
        <Route element={<PermissionOnly permission="customers.add" />}><Route path="/customers/new" element={<NewCustomer />} /></Route>
        <Route element={<PermissionOnly permission="loans.view" />}><Route path="/loans" element={<Loans />} /></Route>
        <Route element={<PermissionOnly permission="loans.create" />}><Route path="/loans/create" element={<CreateLoan />} /></Route>
        <Route element={<PermissionOnly permission="collections.view" />}><Route path="/collection" element={<Collection />} /></Route>
        <Route element={<PermissionOnly permission="payments.view" />}><Route path="/payments" element={<Payments />} /></Route>
        <Route element={<PermissionOnly permission="expenses.view" />}><Route path="/expenses" element={<Expenses />} /></Route>
        <Route element={<PermissionOnly permission="capital.view" />}><Route path="/capital" element={<Capital />} /></Route>
        <Route element={<OwnerOnly />}><Route path="/savings" element={<Savings />} /></Route>
        <Route element={<PermissionOnly permission="reports.full" />}><Route path="/reports" element={<Reports />} /></Route>
        <Route element={<OwnerOnly />}><Route path="/agents" element={<Agents />} /></Route>
        {/* Personal Settings are intentionally available to both Owner and Agent. */}
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
