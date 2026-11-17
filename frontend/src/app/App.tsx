import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Droplets } from 'lucide-react';
import { api } from '../services/api';
import { applyAppearance } from '../utils/appearance';
import { AppLayout } from '../components/layout/AppLayout';
import { LandingPage } from '../pages/landing/LandingPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { CustomersPage } from '../pages/customers/CustomersPage';
import { OrdersPage } from '../pages/orders/OrdersPage';
import { GarmentsPage } from '../pages/garments/GarmentsPage';
import { ServicesPage } from '../pages/services/ServicesPage';
import { PaymentsPage } from '../pages/payments/PaymentsPage';
import { DeliveriesPage } from '../pages/deliveries/DeliveriesPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { UsersPage } from '../pages/users/UsersPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { ClientLayout } from '../components/layout/ClientLayout';
import { ClientDashboard } from '../pages/client/ClientDashboard';
import { ClientOrdersPage } from '../pages/client/ClientOrdersPage';
import { ClientShopsPage } from '../pages/client/ClientShopsPage';
import { ClientFavoritesPage } from '../pages/client/ClientFavoritesPage';
import { ClientBookingsPage } from '../pages/client/ClientBookingsPage';
import { DEFAULT_APPEARANCE, type Appearance, type User } from '../types';

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [appearancePreview, setAppearancePreview] = useState<Appearance | null>(null);
  const [appearanceLoadError, setAppearanceLoadError] = useState('');

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then(async ({ user: current }) => {
        setUser(current);
        try {
          setAppearance(await api<Appearance>('/settings/appearance'));
        } catch (error) {
          setAppearanceLoadError(error instanceof Error ? error.message : 'No se pudo cargar la apariencia.');
        }
      })
      .catch(async () => {
        try {
          const status = await api<{ setupRequired: boolean }>('/auth/setup-status');
          setSetupRequired(status.setupRequired);
        } catch {
          // ignore connection errors on landing
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    applyAppearance(appearancePreview ?? appearance);
  }, [appearance, appearancePreview]);

  const handleLogin = useCallback(async (current: User) => {
    setUser(current);
    setSetupRequired(false);
    try {
      setAppearance(await api<Appearance>('/settings/appearance'));
      setAppearanceLoadError('');
    } catch (error) {
      setAppearanceLoadError(error instanceof Error ? error.message : 'No se pudo cargar la apariencia.');
    }
  }, []);

  const saveAppearance = useCallback(async (value: Appearance) => {
    const saved = await api<Appearance>('/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify(value)
    });
    setAppearance(saved);
    setAppearancePreview(null);
    setAppearanceLoadError('');
    return saved;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    navigate('/');
  }, [navigate]);

  if (loading) return <div className="loading-screen"><div className="brand-mark"><Droplets /></div></div>;
  if (!user) {
    return <LandingPage onLogin={handleLogin} setupRequired={setupRequired} />;
  }

  const isAdmin = user.role === 'ADMIN';
  const isClient = user.role === 'CLIENT' || user.isClient === true;

  if (isClient) {
    return <Routes>
      <Route element={<ClientLayout user={user} onLogout={logout} />}>
        <Route path="/client" element={<ClientDashboard />} />
        <Route path="/client/shops" element={<ClientShopsPage />} />
        <Route path="/client/favorites" element={<ClientFavoritesPage />} />
        <Route path="/client/bookings" element={<ClientBookingsPage />} />
        <Route path="/client/orders" element={<ClientOrdersPage />} />
        <Route path="/profile" element={<ProfilePage onLogout={logout} />} />
        <Route path="*" element={<Navigate to="/client" replace />} />
      </Route>
    </Routes>;
  }

  return <Routes>
    <Route element={<AppLayout user={user} onLogout={logout} />}>
      <Route index element={<DashboardPage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="garments" element={<GarmentsPage isAdmin={isAdmin} />} />
      <Route path="services" element={<ServicesPage isAdmin={isAdmin} />} />
      <Route path="payments" element={<PaymentsPage isAdmin={isAdmin} />} />
      <Route path="deliveries" element={<DeliveriesPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="users" element={<UsersPage isAdmin={isAdmin} currentUserId={user.id} />} />
      <Route path="settings" element={<SettingsPage isAdmin={isAdmin} appearance={appearance} loadError={appearanceLoadError} onSave={saveAppearance} onPreview={setAppearancePreview} />} />
      <Route path="profile" element={<ProfilePage onLogout={logout} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>;
}
