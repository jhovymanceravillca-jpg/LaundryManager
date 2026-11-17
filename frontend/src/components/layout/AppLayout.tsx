import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, Bell, CalendarDays, ChevronDown, ClipboardList, CircleDollarSign,
  Droplets, LayoutDashboard, LogOut, Menu, Settings, Shirt, Sparkles, Truck, Users, Boxes
} from 'lucide-react';
import type { Page, User } from '../../types';

type NavItem = { label: Page; path: string; icon: typeof LayoutDashboard; group: string };

const NAV: NavItem[] = [
  { label: 'Inicio', path: '/', icon: LayoutDashboard, group: 'GENERAL' },
  { label: 'Pedidos', path: '/orders', icon: ClipboardList, group: 'OPERACIONES' },
  { label: 'Clientes', path: '/customers', icon: Users, group: 'OPERACIONES' },
  { label: 'Prendas', path: '/garments', icon: Shirt, group: 'OPERACIONES' },
  { label: 'Servicios', path: '/services', icon: Sparkles, group: 'OPERACIONES' },
  { label: 'Pagos', path: '/payments', icon: CircleDollarSign, group: 'GESTIÓN' },
  { label: 'Entregas', path: '/deliveries', icon: Truck, group: 'GESTIÓN' },
  { label: 'Reportes', path: '/reports', icon: Boxes, group: 'GESTIÓN' },
  { label: 'Mi perfil', path: '/profile', icon: Users, group: 'OTROS' },
  { label: 'Usuarios', path: '/users', icon: Users, group: 'OTROS' },
  { label: 'Configuración', path: '/settings', icon: Settings, group: 'OTROS' }
];

export function AppLayout({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const current = NAV.find((item) => item.path === location.pathname) ?? NAV[0];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <NavLink className="brand" to="/" onClick={() => setMobileMenu(false)}>
        <span className="brand-mark"><Droplets size={21} /></span>
        <span>Laundry<span className="brand-light">Manager</span></span>
      </NavLink>
      <div className="workspace">
        <span className="workspace-avatar">LM</span>
        <span><b>Lavandería Central</b><small>Panel de administración</small></span>
        <ChevronDown size={15} />
      </div>
      <nav className="navigation">
        {NAV.map((item, index) => <div key={item.path}>
          {(index === 0 || NAV[index - 1].group !== item.group) && <div className="nav-group">{item.group}</div>}
          <NavLink
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenu(false)}
          >
            <item.icon size={18} strokeWidth={1.8} />
            <span>{item.label}</span>
          </NavLink>
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon"><Sparkles size={16} /></div>
          <b>¿Necesitas ayuda?</b>
          <p>Consulta la guía de uso del sistema.</p>
          <button onClick={() => navigate('/settings')}>Ver documentación <ArrowUpRight size={14} /></button>
        </div>
        <div className="profile">
          <button className="profile-trigger" onClick={() => navigate('/profile')} aria-label="Ver mi perfil">
            <div className="avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} /> : user.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
            <div className="profile-copy"><b>{user.fullName}</b><small>{user.role === 'ADMIN' ? 'Administrador' : 'Personal'}</small></div>
          </button>
          <button className="icon-button logout" title="Cerrar sesión" onClick={onLogout}><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú" />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu /></button>
        <div className="breadcrumbs"><span>Lavandería</span><span className="crumb-slash">/</span><b>{current.label}</b></div>
        <div className="top-actions">
          <span className="today-label"><CalendarDays size={15} />{new Date().toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <button className="icon-button notification" aria-label="Notificaciones"><Bell size={18} /><i /></button>
        </div>
      </header>
      <div className="page-content page-enter" key={location.pathname}><Outlet /></div>
      <footer className="footer"><span>© {new Date().getFullYear()} LaundryManager</span><span>Gestión simple, ropa impecable <Droplets size={13} /></span></footer>
    </main>
  </div>;
}
