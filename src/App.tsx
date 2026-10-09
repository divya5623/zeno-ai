import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ShopPage } from './pages/ShopPage';
import { AuthorizationsPage } from './pages/AuthorizationsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SecurityCenterPage } from './pages/SecurityCenterPage';
import { AttackLabPage } from './pages/AttackLabPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="authorizations" element={<AuthorizationsPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="security" element={<SecurityCenterPage />} />
            <Route path="attack-lab" element={<AttackLabPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
