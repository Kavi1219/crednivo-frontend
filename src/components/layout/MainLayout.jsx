import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileDrawer from './MobileDrawer';
import MobileBottomNav from './MobileBottomNav';
import AuthLoading from '../common/AuthLoading';
import GlobalBackButton from '../GlobalBackButton';
import NavigationMemory from '../NavigationMemory';
import { useCrednivo } from '../../context/CrednivoContext';
import './MainLayout.css';

export default function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isFirstLoad } = useCrednivo();

  // Only for a genuinely first-ever session (no cached data at all) — a
  // returning user's cached data shows immediately as before, refreshing
  // silently in the background once the real fetch completes.
  if (isFirstLoad) return <AuthLoading />;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-shell is-framed">
        <Header onOpenMenu={() => setDrawerOpen(true)} />
        <main className="page-content"><NavigationMemory /><GlobalBackButton /><Outlet /></main>
      </div>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MobileBottomNav />
    </div>
  );
}
