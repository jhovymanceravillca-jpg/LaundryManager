import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Droplets, Heart, LogOut, MapPin, Package, User as UserIcon, Calendar } from 'lucide-react';
import type { User } from '../../types';

const NAV = [
  { label: 'Inicio', path: '/client', icon: Package },
  { label: 'Lavanderías cercanas', path: '/client/shops', icon: MapPin },
  { label: 'Favoritos', path: '/client/favorites', icon: Heart },
  { label: 'Mis turnos', path: '/client/bookings', icon: Calendar },
  { label: 'Mis pedidos', path: '/client/orders', icon: Package },
  { label: 'Mi perfil', path: '/profile', icon: UserIcon }
];

export function ClientLayout({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const current = NAV.find((item) => item.path === location.pathname) ?? NAV[0];

  return <div className="app-shell client-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <NavLink className="brand" to="/client" onClick={() => setMobileMenu(false)}>
        <span className="brand-mark"><Droplets size={21} /></span>
        <span>Laundry<span className="brand-light">Cliente</span></span>
      </NavLink>
      <div className="workspace">
        <span className="workspace-avatar">{user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
        <span><b>{user.fullName}</b><small>Cuenta de cliente</small></span>
      </div>
      <nav className="navigation">
        <div className="nav-group">MI CUENTA</div>
        {NAV.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/client'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenu(false)}>
            <item.icon size={18} strokeWidth={1.8} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon"><Droplets size={16} /></div>
          <b>¿Necesitas ayuda?</b>
          <p>Contáctanos y te asistimos.</p>
          <button onClick={() => navigate('/client/shops')}>Ver lavanderías <MapPin size={14} /></button>
        </div>
        <div className="profile">
          <button className="profile-trigger" onClick={() => navigate('/profile')} aria-label="Ver mi perfil">
            <div className="avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} /> : user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div>
            <div className="profile-copy"><b>{user.fullName}</b><small>Cliente</small></div>
          </button>
          <button className="icon-button logout" title="Cerrar sesión" onClick={onLogout}><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú" />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><span style={{ fontSize: 18 }}>☰</span></button>
        <div className="breadcrumbs"><span>Cliente</span><span className="crumb-slash">/</span><b>{current.label}</b></div>
        <div className="top-actions">
          <span className="today-label">{new Date().toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
      </header>
      <div className="page-content page-enter" key={location.pathname}><Outlet /></div>
      <footer className="footer"><span>© {new Date().getFullYear()} LaundryManager</span><span>Tu ropa, impecable <Droplets size={13} /></span></footer>
    </main>
  </div>;
}
