import { lazy, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { CrednivoProvider } from '../context/CrednivoContext';
import { useAuth } from '../context/AuthContext';
import AuthLoading from '../components/common/AuthLoading';

// Every page below loads on demand instead of all at once — visiting the
// Dashboard shouldn't cost downloading the Reports or Work Assignment code
// too. AuthLoading itself stays a normal (non-lazy) import since it's what
// shows *while* everything else is loading.
const Login = lazy(() => import('../pages/Auth/Login'));
const RegisterCompany = lazy(() => import('../pages/Auth/RegisterCompany'));
const RegisterAgent = lazy(() => import('../pages/Auth/RegisterAgent'));
const DownloadApp = lazy(() => import('../pages/DownloadApp/DownloadApp'));
const LandingPage = lazy(() => import('../pages/Landing/LandingPage'));
const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard'));
const TodayReport = lazy(() => import('../pages/TodayReport/TodayReport'));
const Customers = lazy(() => import('../pages/Customers/Customers'));
const NewCustomer = lazy(() => import('../pages/Customers/NewCustomer'));
const CustomerDetails = lazy(() => import('../pages/Customers/CustomerDetails'));
const Loans = lazy(() => import('../pages/Loans/Loans'));
const CreateLoan = lazy(() => import('../pages/Loans/CreateLoan'));
const Collection = lazy(() => import('../pages/Collection/Collection'));
const Payments = lazy(() => import('../pages/Payments/Payments'));
const Capital = lazy(() => import('../pages/Capital/Capital'));
const Savings = lazy(() => import('../pages/Savings/Savings'));
const Expenses = lazy(() => import('../pages/Expenses/Expenses'));
const Reports = lazy(() => import('../pages/Reports/Reports'));
const Agents = lazy(() => import('../pages/Agents/Agents'));
const Settings = lazy(() => import('../pages/Settings/Settings'));
const Work = lazy(() => import('../pages/Work/Work'));


function RootEntry() {
  const { loading, user, status } = useAuth();

  // The Android APK is a Capacitor shell around crednivo.in. It should open
  // like an app, not like the public marketing website.
  if (Capacitor.isNativePlatform()) {
    if (loading) return <AuthLoading />;
    if (status?.ownerSetupRequired) return <Navigate to="/register/company" replace />;
    return <Navigate to={user ? '/overview' : '/login'} replace />;
  }

  return <LandingPage />;
}

function DownloadEntry() {
  const { loading, user, status } = useAuth();

  // Download instructions only make sense on the website. Never show the APK
  // download page inside the already-installed Android app.
  if (Capacitor.isNativePlatform()) {
    if (loading) return <AuthLoading />;
    if (status?.ownerSetupRequired) return <Navigate to="/register/company" replace />;
    return <Navigate to={user ? '/overview' : '/login'} replace />;
  }

  return <DownloadApp />;
}

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
    <Suspense fallback={<AuthLoading />}>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/login" element={<Login />} />
        <Route path="/accounts" element={<Login />} />
        <Route path="/download" element={<DownloadEntry />} />
        <Route path="/register/company" element={<RegisterCompany />} />
        <Route path="/register/agent" element={<RegisterAgent />} />
        <Route path="/setup-owner" element={<Navigate to="/register/company" replace />} />
        <Route element={<ProtectedWorkspace />}>
          <Route element={<PermissionOnly permission="overview.view" />}>
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
          {/* Work is available to both roles too — owners assign it, agents act on it. */}
          <Route path="/work" element={<Work />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
