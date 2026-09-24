import { lazy, Suspense } from 'react';
import { recoverFromStaleChunk } from '../utils/runtimeRecovery';
import { Capacitor } from '@capacitor/core';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { CrednivoProvider } from '../context/CrednivoContext';
import { useAuth } from '../context/AuthContext';
import AuthLoading from '../components/common/AuthLoading';

const lazyPage = (importer) => lazy(() => importer().catch((error) => {
  if (recoverFromStaleChunk(error)) return new Promise(() => {});
  throw error;
}));

// Every page below loads on demand instead of all at once — visiting the
// Dashboard shouldn't cost downloading the Reports or Work Assignment code
// too. AuthLoading itself stays a normal (non-lazy) import since it's what
// shows *while* everything else is loading.
const Login = lazyPage(() => import('../pages/Auth/Login'));
const RegisterCompany = lazyPage(() => import('../pages/Auth/RegisterCompany'));
const RegisterAgent = lazyPage(() => import('../pages/Auth/RegisterAgent'));
const DownloadApp = lazyPage(() => import('../pages/DownloadApp/DownloadApp'));
const LandingPage = lazyPage(() => import('../pages/Landing/LandingPage'));
const Dashboard = lazyPage(() => import('../pages/Dashboard/Dashboard'));
const TodayReport = lazyPage(() => import('../pages/TodayReport/TodayReport'));
const Customers = lazyPage(() => import('../pages/Customers/Customers'));
const NewCustomer = lazyPage(() => import('../pages/Customers/NewCustomer'));
const CustomerDetails = lazyPage(() => import('../pages/Customers/CustomerDetails'));
const Loans = lazyPage(() => import('../pages/Loans/Loans'));
const CreateLoan = lazyPage(() => import('../pages/Loans/CreateLoan'));
const Collection = lazyPage(() => import('../pages/Collection/Collection'));
const Payments = lazyPage(() => import('../pages/Payments/Payments'));
const Capital = lazyPage(() => import('../pages/Capital/Capital'));
const Savings = lazyPage(() => import('../pages/Savings/Savings'));
const Expenses = lazyPage(() => import('../pages/Expenses/Expenses'));
const Reports = lazyPage(() => import('../pages/Reports/Reports'));
const Agents = lazyPage(() => import('../pages/Agents/Agents'));
const Settings = lazyPage(() => import('../pages/Settings/Settings'));
const Work = lazyPage(() => import('../pages/Work/Work'));


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
