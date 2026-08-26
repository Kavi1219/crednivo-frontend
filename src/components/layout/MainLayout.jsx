import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileDrawer from './MobileDrawer';
import MobileBottomNav from './MobileBottomNav';
import './MainLayout.css';

export default function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-shell">
        <Header onOpenMenu={() => setDrawerOpen(true)} />
        <main className="page-content"><Outlet /></main>
      </div>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MobileBottomNav />
    </div>
  );
}
