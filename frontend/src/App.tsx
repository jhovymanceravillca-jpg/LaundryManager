import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Bell, Boxes, CalendarDays, Check, ChevronDown, CircleDollarSign,
  ClipboardList, Clock3, Droplets, LayoutDashboard, LogOut, Menu, Plus, Search, Settings,
  Shirt, Sparkles, Truck, Users, X
} from 'lucide-react';
import { api } from './api';

type User = { id: number; fullName: string; email?: string; role: 'ADMIN' | 'STAFF' };
type Customer = { id: number; firstName: string; lastName: string; phone: string; email?: string; address?: string };
type Service = { id: number; name: string; unitType: 'PRENDA' | 'KILOGRAMO' | 'FIJO'; basePrice: number };
type Garment = { id: number; name: string };
type OrderItem = { garmentName: string; serviceName: string; quantity: number; weightKg?: number; unitPrice: number; subtotal: number; notes?: string };
type Payment = { id: number; amount: number; paymentMethod: string; reference?: string; paidAt: string; voidedAt?: string };
type Order = {
  id: number; orderCode: string; customerName: string; customerId: number; status: string;
  total: number; paid: number; expectedDeliveryAt: string; subtotal?: number; discount?: number;
  receivedAt?: string; notes?: string; items?: OrderItem[]; payments?: Payment[];
  history?: Array<{ previousStatus?: string; newStatus: string; changedAt: string }>;
};
type Summary = {
  orderCount: number; pendingCount: number; processingCount: number; readyCount: number;
  deliveredCount: number; collected: number; balance: number; recent: Order[];
};
type Page = 'Inicio' | 'Pedidos' | 'Clientes' | 'Prendas' | 'Servicios' | 'Pagos' | 'Entregas' | 'Reportes' | 'Usuarios' | 'Configuración';
const FONT_OPTIONS = [
  { id: 'system', name: 'Sistema', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'arial', name: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'verdana', name: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'trebuchet', name: 'Trebuchet MS', stack: '"Trebuchet MS", Arial, sans-serif' },
  { id: 'georgia', name: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', name: 'Monoespaciada', stack: '"Courier New", monospace' }
] as const;
type FontFamily = typeof FONT_OPTIONS[number]['id'];
type BackgroundMode = 'light' | 'dark';
type Appearance = { accentColor: string; fontFamily: FontFamily; backgroundMode: BackgroundMode };
const DEFAULT_APPEARANCE: Appearance = { accentColor: '#2863e9', fontFamily: 'system', backgroundMode: 'light' };
const COLOR_PALETTE = [
  { name: 'Azul', hex: '#2863e9' },
  { name: 'Índigo', hex: '#4f46e5' },
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Fucsia', hex: '#c026d3' },
  { name: 'Rosa', hex: '#e11d48' },
  { name: 'Rojo', hex: '#dc2626' },
  { name: 'Naranja', hex: '#ea580c' },
  { name: 'Ámbar', hex: '#ca8a04' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Turquesa', hex: '#0d9488' },
  { name: 'Cian', hex: '#0891b2' }
] as const;

function applyAppearance(appearance: Appearance) {
  const font = FONT_OPTIONS.find(option => option.id === appearance.fontFamily);
  if (!font) throw new Error('La tipografía guardada no es válida.');
  const root = document.documentElement;
  root.dataset.theme = appearance.backgroundMode;
  root.style.setProperty('--theme-accent', appearance.accentColor);
  root.style.setProperty('--theme-accent-hover', `color-mix(in srgb, ${appearance.accentColor} 84%, black)`);
  root.style.setProperty('--theme-accent-soft', `color-mix(in srgb, ${appearance.accentColor} 9%, white)`);
  root.style.setProperty('--theme-accent-border', `color-mix(in srgb, ${appearance.accentColor} 20%, white)`);
  root.style.setProperty('--theme-font-family', font.stack);
}

const money = (amount: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(amount || 0));
const date = (value: string) => new Date(value).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeLocalValue = (value: string) => {
  const parsed = new Date(value);
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>('Inicio');
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
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
        } catch (error) {
          setLoginError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    applyAppearance(appearancePreview ?? appearance);
  }, [appearance, appearancePreview]);

  const saveAppearance = async (value: Appearance) => {
    const saved = await api<Appearance>('/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify(value)
    });
    setAppearance(saved);
    setAppearancePreview(null);
    setAppearanceLoadError('');
    return saved;
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  };

  if (loading) return <div className="loading-screen"><div className="brand-mark"><Droplets /></div></div>;
  if (!user) return <Login onLogin={setUser} error={loginError} setError={setLoginError} setupRequired={setupRequired} />;

  const nav = [
    { label: 'Inicio' as Page, icon: LayoutDashboard, group: 'GENERAL' },
    { label: 'Pedidos' as Page, icon: ClipboardList, group: 'OPERACIONES' },
    { label: 'Clientes' as Page, icon: Users, group: 'OPERACIONES' },
    { label: 'Prendas' as Page, icon: Shirt, group: 'OPERACIONES' },
    { label: 'Servicios' as Page, icon: Sparkles, group: 'OPERACIONES' },
    { label: 'Pagos' as Page, icon: CircleDollarSign, group: 'GESTIÓN' },
    { label: 'Entregas' as Page, icon: Truck, group: 'GESTIÓN' },
    { label: 'Reportes' as Page, icon: Boxes, group: 'GESTIÓN' },
    { label: 'Usuarios' as Page, icon: Users, group: 'OTROS' },
    { label: 'Configuración' as Page, icon: Settings, group: 'OTROS' }
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('Inicio'); }}>
        <span className="brand-mark"><Droplets size={21} /></span><span>Laundry<span className="brand-light">Manager</span></span>
      </a>
      <div className="workspace"><span className="workspace-avatar">LM</span><span><b>Lavandería Central</b><small>Panel de administración</small></span><ChevronDown size={15} /></div>
      <nav className="navigation">
        {nav.map((item, index) => <div key={item.label}>
          {(index === 0 || nav[index - 1].group !== item.group) && <div className="nav-group">{item.group}</div>}
          <button className={`nav-item ${page === item.label ? 'active' : ''}`} onClick={() => { setPage(item.label); setMobileMenu(false); }}>
            <item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
          </button>
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><Sparkles size={16} /></div><b>¿Necesitas ayuda?</b><p>Consulta la guía de uso del sistema.</p><button onClick={() => setPage('Configuración')}>Ver documentación <ArrowUpRight size={14} /></button></div>
        <div className="profile">
          <div className="avatar">{user.fullName.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div className="profile-copy"><b>{user.fullName}</b><small>{user.role === 'ADMIN' ? 'Administrador' : 'Personal'}</small></div>
          <button className="icon-button logout" title="Cerrar sesión" onClick={logout}><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú" />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu /></button>
        <div className="breadcrumbs"><span>Lavandería</span><span className="crumb-slash">/</span><b>{page}</b></div>
        <div className="top-actions"><span className="today-label"><CalendarDays size={15} />{new Date().toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })}</span><button className="icon-button notification" aria-label="Notificaciones"><Bell size={18} /><i /></button></div>
      </header>
      <div className="page-content">{page === 'Inicio' ? <Dashboard onNavigate={setPage} /> : page === 'Clientes' ? <Customers /> : page === 'Pedidos' ? <Orders /> : page === 'Prendas' ? <Catalog kind="garments" title="Tipos de prendas" isAdmin={user.role === 'ADMIN'} /> : page === 'Servicios' ? <Catalog kind="services" title="Servicios y precios" isAdmin={user.role === 'ADMIN'} /> : page === 'Pagos' ? <Payments isAdmin={user.role === 'ADMIN'} /> : page === 'Entregas' ? <Deliveries /> : page === 'Reportes' ? <Reports /> : page === 'Usuarios' ? <UsersPage isAdmin={user.role === 'ADMIN'} /> : <SettingsPage isAdmin={user.role === 'ADMIN'} appearance={appearance} loadError={appearanceLoadError} onSave={saveAppearance} onPreview={setAppearancePreview} />}</div>
      <footer className="footer"><span>© {new Date().getFullYear()} LaundryManager</span><span>Gestión simple, ropa impecable <Droplets size={13} /></span></footer>
    </main>
  </div>;
}

function Login({ onLogin, error, setError, setupRequired }: { onLogin: (user: User) => void; error: string; setError: (message: string) => void; setupRequired: boolean }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    if (setupRequired && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      setBusy(false);
      return;
    }
    try {
      const payload = setupRequired ? { fullName, email, password } : { email, password };
      const result = await api<{ user: User }>(setupRequired ? '/auth/setup' : '/auth/login', {
        method: 'POST', body: JSON.stringify(payload)
      });
      onLogin(result.user);
    }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.'); }
    finally { setBusy(false); }
  };
  return <div className="login-page"><div className="login-decoration"><div className="wash-circle wash-one" /><div className="wash-circle wash-two" /><div className="login-note"><Droplets size={20} /><span>Tu lavandería,<br /><b>en orden.</b></span></div></div>
    <form className="login-card" onSubmit={submit}><div className="login-brand"><span className="brand-mark"><Droplets /></span><b>Laundry<span className="brand-light">Manager</span></b></div>
      <span className="eyebrow">{setupRequired ? 'CONFIGURACIÓN INICIAL' : 'BIENVENIDO DE NUEVO'}</span><h1>{setupRequired ? 'Crea la cuenta administradora' : 'Inicia sesión'}</h1><p className="muted">{setupRequired ? 'Esta cuenta inicial será administradora del sistema.' : 'Ingresa tus datos para acceder al panel.'}</p>
      {setupRequired && <label>Nombre completo<input autoComplete="name" required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre" /></label>}
      <label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@lavanderia.com" /></label>
      <label>{setupRequired ? 'Contraseña (mínimo 12 caracteres)' : 'Contraseña'}<input type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} minLength={setupRequired ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••••" /></label>
      {setupRequired && <label>Confirma la contraseña<input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••••••" /></label>}
      {error && <div className="error-banner">{error}</div>}<button className="primary-button login-submit" disabled={busy}>{busy ? 'Un momento…' : setupRequired ? 'Crear cuenta administradora' : 'Ingresar al sistema'}<ArrowUpRight size={17} /></button>
      <small className="login-footnote">Cuenta de acceso creada por el administrador del sistema.</small>
    </form>
  </div>;
}

function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<Array<{ date: string; total: number }>>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    try {
      const [overview, sales] = await Promise.all([
        api<Summary>('/dashboard/summary'),
        api<Array<{ date: string; total: number }>>(`/reports/sales?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`)
      ]);
      setSummary(overview); setRevenue(sales); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const stats = [
    { label: 'Pedidos de hoy', value: summary?.orderCount ?? 0, icon: ClipboardList, color: 'blue', note: 'Pedidos recibidos hoy' },
    { label: 'En proceso', value: summary?.processingCount ?? 0, icon: Droplets, color: 'purple', note: 'En limpieza ahora' },
    { label: 'Listos para entregar', value: summary?.readyCount ?? 0, icon: Check, color: 'green', note: 'Esperando al cliente' },
    { label: 'Saldo pendiente', value: money(summary?.balance ?? 0), icon: Clock3, color: 'orange', note: 'Por cobrar' }
  ];
  return <><div className="welcome-row"><div><div className="eyebrow">RESUMEN GENERAL</div><h1>¡Buen día! <span className="wave">✦</span></h1><p className="muted">Aquí tienes el resumen de tu lavandería.</p></div><button className="primary-button" onClick={() => onNavigate('Pedidos')}><Plus size={17} /> Nuevo pedido</button></div>
    {error && <ErrorBanner message={error} retry={load} />}
    <section className="stats-grid">{stats.map(s => <article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><span className={`stat-icon ${s.color}`}><s.icon size={18} /></span></div><div className="stat-value">{summary ? s.value : '—'}</div><div className="stat-note">{s.note}</div></article>)}</section>
    <section className="dashboard-grid"><div className="panel orders-panel"><div className="panel-heading"><div><h2>Pedidos recientes</h2><p>Últimos pedidos recibidos</p></div><button className="text-button" onClick={() => onNavigate('Pedidos')}>Ver todos <ArrowUpRight size={15} /></button></div>
      <OrderTable orders={summary?.recent ?? []} compact /></div>
      <div className="right-stack"><div className="panel collection-panel"><div className="panel-heading"><div><h2>Ingresos cobrados</h2><p>Últimos 30 días</p></div><span className="stat-icon green"><ArrowDownLeft size={17} /></span></div><div className="income-total">{money(summary?.collected ?? 0)}</div><div className="income-caption"><span className="dot green-dot" /> Pagos registrados</div><div className="mini-chart" aria-label="Ingresos por día">
        {revenue.length ? revenue.slice(-12).map(row => {
          const max = Math.max(...revenue.map(item => Number(item.total)), 1);
          return <i key={row.date} title={`${date(row.date)}: ${money(row.total)}`} style={{height:`${Math.max(8, Number(row.total) / max * 100)}%`}} />;
        }) : <span className="chart-empty">Sin ingresos en el periodo</span>}
      </div><div className="chart-labels"><span>12 días</span><span>Hoy</span></div></div>
      <div className="panel status-panel"><div className="panel-heading"><div><h2>Estado de pedidos</h2><p>Pedidos del día</p></div></div><div className="status-row"><span><i className="status-dot blue-dot" /> Pendientes</span><b>{summary?.pendingCount ?? '—'}</b></div><div className="status-row"><span><i className="status-dot purple-dot" /> En proceso</span><b>{summary?.processingCount ?? '—'}</b></div><div className="status-row"><span><i className="status-dot green-dot" /> Terminados</span><b>{summary?.readyCount ?? '—'}</b></div><div className="status-row"><span><i className="status-dot gray-dot" /> Entregados</span><b>{summary?.deliveredCount ?? '—'}</b></div></div></div></section>
    <section className="bottom-callout"><span className="callout-icon"><Sparkles size={18} /></span><span><b>Todo listo para un nuevo día</b><small>Registra un pedido y mantén tu operación al día.</small></span><button className="secondary-button" onClick={() => onNavigate('Pedidos')}>Crear pedido <ArrowUpRight size={15} /></button></section>
  </>;
}

function Customers() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [history, setHistory] = useState<{ customer: Customer; orders: Order[] } | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '' });
  const load = useCallback(() => api<Customer[]>(`/customers?search=${encodeURIComponent(search)}`).then(setRows).catch(e => setError(e.message)), [search]);
  useEffect(() => { load(); }, [load]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api(editing ? `/customers/${editing.id}` : '/customers', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(form)
      });
      setOpen(false); setEditing(null); setForm({ firstName: '', lastName: '', phone: '', email: '', address: '' }); await load();
    }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  };
  const edit = (customer: Customer) => {
    setEditing(customer);
    setForm({ firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, email: customer.email ?? '', address: customer.address ?? '' });
    setOpen(true);
  };
  const showHistory = async (customer: Customer) => {
    try { setHistory(await api(`/customers/${customer.id}/history`)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); }
  };
  return <><PageHeading eyebrow="RELACIONES" title="Clientes" description="Administra la información de tus clientes." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nuevo cliente</button>} />
    <div className="panel data-panel"><div className="table-toolbar"><div><h2>Todos los clientes</h2><p>{rows.length} clientes registrados</p></div><label className="search-box"><Search size={16} /><input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>TELÉFONO</th><th>CORREO</th><th>ACCIONES</th></tr></thead><tbody>
      {rows.map(c => <tr key={c.id}><td><div className="customer-cell"><span className="customer-avatar">{c.firstName[0]}{c.lastName[0]}</span><b>{c.firstName} {c.lastName}</b></div></td><td>{c.phone}</td><td>{c.email || '—'}</td><td><div className="row-actions"><button className="small-action" onClick={() => showHistory(c)}>Historial</button><button className="small-action" onClick={() => edit(c)}>Editar</button></div></td></tr>)}
      {!rows.length && <tr><td colSpan={4}><EmptyState title="Aún no hay clientes" text="Registra tu primer cliente para comenzar a crear pedidos." /></td></tr>}
      </tbody></table></div></div>
    {open && <Modal title={editing ? 'Editar cliente' : 'Registrar cliente'} close={() => { setOpen(false); setEditing(null); }}><form className="form-grid" onSubmit={save}>
      <label>Nombre<input required maxLength={80} value={form.firstName} onChange={e => setForm({...form, firstName:e.target.value})} /></label>
      <label>Apellido<input required maxLength={80} value={form.lastName} onChange={e => setForm({...form, lastName:e.target.value})} /></label>
      <label>Teléfono<input required maxLength={40} value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} /></label>
      <label>Correo electrónico<input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></label>
      <label className="full-field">Dirección<input value={form.address} onChange={e => setForm({...form, address:e.target.value})} /></label>
      {error && <div className="form-error full-field">{error}</div>}<div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar cliente'}</button></div>
    </form></Modal>}
    {history && <Modal title={`Historial de ${history.customer.firstName} ${history.customer.lastName}`} close={() => setHistory(null)}><div className="history-content"><p>{history.customer.phone} · {history.customer.email || 'Sin correo'}</p>{history.orders.length ? history.orders.map(order => <div className="history-order" key={order.id}><div><b>{order.orderCode}</b><small>{date(order.receivedAt ?? '')}</small></div><Status status={order.status} /><strong>{money(order.total)}</strong></div>) : <EmptyState title="Sin pedidos previos" text="El historial aparecerá cuando se creen pedidos para este cliente." />}</div></Modal>}
  </>;
}

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', expectedDeliveryAt: '' });
  const [items, setItems] = useState([{ garmentTypeId: '', serviceId: '', quantity: '1', weightKg: '' }]);
  const [initialPayment, setInitialPayment] = useState({ amount: '', method: 'EFECTIVO' });
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'EFECTIVO', reference: '' });
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editDetails, setEditDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ expectedDeliveryAt: '', notes: '' });
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const load = useCallback(async () => {
    try {
      const [o, c, s, g] = await Promise.all([api<Order[]>('/orders'), api<Customer[]>('/customers'), api<Service[]>('/services'), api<Garment[]>('/garments')]);
      setOrders(o); setCustomers(c); setServices(s); setGarments(g); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const visible = orders.filter(o => `${o.orderCode} ${o.customerName} ${o.status}`.toLowerCase().includes(query.toLowerCase()));
  const create = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const expected = new Date(form.expectedDeliveryAt);
      await api('/orders', { method: 'POST', body: JSON.stringify({
        customerId: Number(form.customerId), expectedDeliveryAt: expected.toISOString(), discount: 0,
        ...(Number(initialPayment.amount) > 0 ? { initialPayment: Number(initialPayment.amount), initialPaymentMethod: initialPayment.method } : {}),
        items: items.map(item => ({
          garmentTypeId: Number(item.garmentTypeId), serviceId: Number(item.serviceId), quantity: Number(item.quantity),
          ...(services.find(service => String(service.id) === item.serviceId)?.unitType === 'KILOGRAMO' ? { weightKg: Number(item.weightKg) } : {})
        }))
      }) });
      setOpen(false); setForm({ customerId: '', expectedDeliveryAt: '' }); setItems([{ garmentTypeId: '', serviceId: '', quantity: '1', weightKg: '' }]); setInitialPayment({ amount: '', method: 'EFECTIVO' }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el pedido.'); }
    finally { setSaving(false); }
  };
  const advance = async (o: Order, actionType: 'advance' | 'payment') => {
    if (actionType === 'payment') {
      const balance = Number(o.total) - Number(o.paid);
      if (balance <= 0) { setError('Este pedido ya está pagado por completo.'); return; }
      setPaymentOrder(o);
      setPaymentForm({ amount: balance.toFixed(2), method: 'EFECTIVO', reference: '' });
      return;
    }
    const next: Record<string,string> = { RECIBIDO:'EN_PROCESO', EN_PROCESO:'TERMINADO' };
    if (next[o.status]) try { await api(`/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next[o.status] }) }); await load(); } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.'); }
    else if (o.status === 'TERMINADO') setDeliveryOrder(o);
  };
  const showDetails = async (order: Order) => {
    try {
      const detail = await api<Order>(`/orders/${order.id}`);
      setDetailOrder(detail);
      setDetailsForm({ expectedDeliveryAt: dateTimeLocalValue(detail.expectedDeliveryAt), notes: detail.notes ?? '' });
      setEditDetails(false);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle del pedido.'); }
  };
  const savePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!paymentOrder) return;
    setSaving(true); setError('');
    try {
      await api(`/orders/${paymentOrder.id}/payments`, { method: 'POST', body: JSON.stringify({
        amount: Number(paymentForm.amount), paymentMethod: paymentForm.method, reference: paymentForm.reference || undefined
      }) });
      setPaymentOrder(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el pago.'); }
    finally { setSaving(false); }
  };
  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!detailOrder) return;
    setSaving(true); setError('');
    try {
      await api(`/orders/${detailOrder.id}`, { method: 'PUT', body: JSON.stringify({
        expectedDeliveryAt: new Date(detailsForm.expectedDeliveryAt).toISOString(), notes: detailsForm.notes
      }) });
      await load();
      const updated = await api<Order>(`/orders/${detailOrder.id}`);
      setDetailOrder(updated);
      setDetailsForm({ expectedDeliveryAt: dateTimeLocalValue(updated.expectedDeliveryAt), notes: updated.notes ?? '' });
      setEditDetails(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron guardar los cambios.'); }
    finally { setSaving(false); }
  };
  return <><PageHeading eyebrow="OPERACIONES" title="Pedidos" description="Controla el recorrido de cada pedido." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nuevo pedido</button>} />
    <div className="panel data-panel"><div className="table-toolbar"><div><h2>Todos los pedidos</h2><p>{orders.length} pedidos</p></div><label className="search-box"><Search size={16} /><input placeholder="Buscar por código o cliente..." value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><OrderTable orders={visible} onAction={advance} onView={showDetails} /></div></div>
    {open && <Modal title="Crear pedido" close={() => setOpen(false)}><form className="form-grid" onSubmit={create}>
      <label className="full-field">Cliente<select required value={form.customerId} onChange={e => setForm({...form, customerId:e.target.value})}><option value="">Selecciona un cliente</option>{customers.map(c => <option value={c.id} key={c.id}>{c.firstName} {c.lastName} · {c.phone}</option>)}</select>{!customers.length && <small className="field-note">Primero registra un cliente.</small>}</label>
      <div className="order-items full-field">{items.map((item, index) => {
        const selectedService = services.find(service => String(service.id) === item.serviceId);
        const setItem = (key: keyof typeof item, value: string) => setItems(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
        return <div className="order-item" key={index}><div className="order-item-heading"><b>Prenda {index + 1}</b>{items.length > 1 && <button className="remove-item" type="button" onClick={() => setItems(current => current.filter((_, lineIndex) => lineIndex !== index))} aria-label="Quitar prenda"><X size={14} /></button>}</div>
          <label>Tipo de prenda<select required value={item.garmentTypeId} onChange={e => setItem('garmentTypeId', e.target.value)}><option value="">Seleccionar</option>{garments.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
          <label>Servicio<select required value={item.serviceId} onChange={e => setItem('serviceId', e.target.value)}><option value="">Seleccionar</option>{services.map(s => <option value={s.id} key={s.id}>{s.name} · {money(s.basePrice)}/{s.unitType === 'KILOGRAMO' ? 'kg' : s.unitType === 'FIJO' ? 'servicio' : 'prenda'}</option>)}</select></label>
          <label>Cantidad<input type="number" min="1" step="1" required value={item.quantity} onChange={e => setItem('quantity', e.target.value)} /></label>
          {selectedService?.unitType === 'KILOGRAMO' && <label>Peso (kg)<input type="number" min="0.01" step="0.01" required value={item.weightKg} onChange={e => setItem('weightKg', e.target.value)} /></label>}
        </div>;
      })}<button type="button" className="add-item-button" onClick={() => setItems(current => [...current, { garmentTypeId: '', serviceId: '', quantity: '1', weightKg: '' }])}><Plus size={14} /> Añadir prenda o servicio</button></div>
      <label className="full-field">Fecha estimada de entrega<input type="datetime-local" required value={form.expectedDeliveryAt} onChange={e => setForm({...form, expectedDeliveryAt:e.target.value})} /></label>
      <label>Pago inicial (Bs)<input type="number" min="0" step="0.01" value={initialPayment.amount} onChange={e => setInitialPayment({...initialPayment, amount:e.target.value})} /></label>
      <label>Método de pago<select value={initialPayment.method} onChange={e => setInitialPayment({...initialPayment, method:e.target.value})}><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option><option value="QR">QR</option></select></label>
      <div className="price-hint full-field"><CircleDollarSign size={17} /> El precio vigente se calcula en el servidor al guardar el pedido.</div>
      {error && <div className="form-error full-field">{error}</div>}<div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving || !customers.length}>{saving ? 'Guardando…' : 'Crear pedido'}</button></div>
    </form></Modal>}
    {paymentOrder && <Modal title={`Registrar pago · ${paymentOrder.orderCode}`} close={() => setPaymentOrder(null)}><form className="form-grid" onSubmit={savePayment}>
      <div className="balance-callout full-field">Saldo pendiente: <b>{money(Number(paymentOrder.total) - Number(paymentOrder.paid))}</b></div>
      <label>Monto (Bs)<input type="number" min="0.01" max={(Number(paymentOrder.total) - Number(paymentOrder.paid)).toFixed(2)} step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount:e.target.value})} /></label>
      <label>Método<select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method:e.target.value})}><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option><option value="QR">QR</option></select></label>
      <label className="full-field">Referencia (opcional)<input maxLength={120} value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference:e.target.value})} /></label>
      {error && <div className="form-error full-field">{error}</div>}<div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setPaymentOrder(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Registrar pago'}</button></div>
    </form></Modal>}
    {detailOrder && <Modal title={`Pedido ${detailOrder.orderCode}`} close={() => { setDetailOrder(null); setEditDetails(false); }}><div className="order-detail">
      <div className="detail-summary"><div><span>CLIENTE</span><b>{detailOrder.customerName}</b></div><div><span>ESTADO</span><Status status={detailOrder.status} /></div><div><span>TOTAL</span><b>{money(Number(detailOrder.total))}</b></div><div><span>SALDO</span><b>{money(Number(detailOrder.total) - Number(detailOrder.paid))}</b></div></div>
      {editDetails ? <form className="form-grid details-edit" onSubmit={saveDetails}>
        <label className="full-field">Fecha estimada de entrega<input type="datetime-local" required value={detailsForm.expectedDeliveryAt} onChange={e => setDetailsForm({...detailsForm, expectedDeliveryAt:e.target.value})} /></label>
        <label className="full-field">Notas<input maxLength={1000} value={detailsForm.notes} onChange={e => setDetailsForm({...detailsForm, notes:e.target.value})} /></label>
        <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setEditDetails(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form> : <>
        <div className="detail-section"><h3>Prendas y servicios</h3>{detailOrder.items?.map((item, index) => <div className="detail-line" key={index}><span>{item.quantity} × {item.garmentName} · {item.serviceName}</span><b>{money(Number(item.subtotal))}</b></div>)}<div className="detail-line total-line"><span>Subtotal</span><b>{money(Number(detailOrder.subtotal))}</b></div>{Number(detailOrder.discount) > 0 && <div className="detail-line"><span>Descuento</span><b>-{money(Number(detailOrder.discount))}</b></div>}</div>
        <div className="detail-section"><h3>Pagos</h3>{detailOrder.payments?.length ? detailOrder.payments.map(payment => <div className="detail-line" key={payment.id}><span>{payment.paymentMethod} · {date(payment.paidAt)}</span><b>{money(Number(payment.amount))}</b></div>) : <p className="muted">Sin pagos registrados.</p>}</div>
        <div className="detail-section"><h3>Historial de estado</h3>{detailOrder.history?.map((event, index) => <div className="detail-line" key={index}><span>{event.previousStatus ? `${event.previousStatus} → ` : ''}{event.newStatus}</span><small>{date(event.changedAt)}</small></div>)}</div>
        {detailOrder.notes && <p className="muted">Notas: {detailOrder.notes}</p>}
        <div className="modal-actions"><button className="secondary-button" onClick={() => setPrintOrder(detailOrder)}>Imprimir comprobante</button>{!['ENTREGADO','CANCELADO'].includes(detailOrder.status) && <button className="primary-button" onClick={() => setEditDetails(true)}>Editar pedido</button>}</div>
      </>}
    </div></Modal>}
    {printOrder && <PrintableReceipt order={printOrder} onPrinted={() => setPrintOrder(null)} />}
    {deliveryOrder && <DeliveryModal order={deliveryOrder} close={() => setDeliveryOrder(null)} onComplete={load} />}
  </>;
}

function OrderTable({ orders, compact = false, onAction, onView }: { orders: Order[]; compact?: boolean; onAction?: (order: Order, action: 'advance' | 'payment') => void; onView?: (order: Order) => void }) {
  return <table><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>ENTREGA</th><th>ESTADO</th><th>TOTAL</th>{!compact && <th>ACCIÓN</th>}</tr></thead><tbody>
    {orders.map(o => <tr key={o.id}><td><button className="link-button order-code" onClick={() => onView?.(o)}>{o.orderCode}</button><small className="cell-subtitle">#{o.id}</small></td><td>{o.customerName}</td><td>{date(o.expectedDeliveryAt)}</td><td><Status status={o.status} /></td><td><b>{money(o.total)}</b><small className="cell-subtitle">Pagado {money(o.paid)}</small></td>{!compact && <td><div className="row-actions">{!['ENTREGADO','CANCELADO'].includes(o.status) && <button className="small-action" onClick={() => onAction?.(o, 'advance')}>{o.status === 'RECIBIDO' ? 'Iniciar' : o.status === 'EN_PROCESO' ? 'Terminar' : 'Entregar'} <ArrowUpRight size={13} /></button>}{!['ENTREGADO','CANCELADO'].includes(o.status) && Number(o.paid) < Number(o.total) && <button className="small-action payment-action" onClick={() => onAction?.(o, 'payment')}>Cobrar</button>}</div></td>}</tr>)}
    {!orders.length && <tr><td colSpan={compact ? 5 : 6}><EmptyState title="No hay pedidos para mostrar" text="Cuando registres pedidos, aparecerán aquí." /></td></tr>}
  </tbody></table>;
}

function PrintableReceipt({ order, onPrinted }: { order: Order; onPrinted: () => void }) {
  useEffect(() => {
    const onAfterPrint = () => onPrinted();
    window.addEventListener('afterprint', onAfterPrint);
    const timer = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [onPrinted]);
  return <article className="print-only">
    <header><h1>LaundryManager</h1><p>Comprobante de servicio de lavandería</p></header>
    <div className="receipt-meta"><b>Pedido: {order.orderCode}</b><span>Fecha: {date(order.receivedAt ?? new Date().toISOString())}</span><span>Cliente: {order.customerName}</span><span>Entrega estimada: {date(order.expectedDeliveryAt)}</span></div>
    <table><thead><tr><th>PRENDA Y SERVICIO</th><th>CANTIDAD / PESO</th><th>IMPORTE</th></tr></thead><tbody>
      {order.items?.map((item, index) => <tr key={index}><td>{item.garmentName} · {item.serviceName}</td><td>{item.quantity}{item.weightKg ? ` · ${item.weightKg} kg` : ''}</td><td>{money(Number(item.subtotal))}</td></tr>)}
    </tbody></table>
    <div className="receipt-totals"><span>Subtotal <b>{money(Number(order.subtotal))}</b></span>{Number(order.discount) > 0 && <span>Descuento <b>-{money(Number(order.discount))}</b></span>}<span>Total <b>{money(Number(order.total))}</b></span><span>Pagado <b>{money(Number(order.paid))}</b></span><span>Saldo pendiente <b>{money(Number(order.total) - Number(order.paid))}</b></span></div>
    {order.notes && <p>Notas: {order.notes}</p>}<footer>Gracias por confiar en nosotros.</footer>
  </article>;
}

function Status({ status }: { status: string }) {
  const cls: Record<string, string> = { RECIBIDO: 'status-blue', EN_PROCESO: 'status-purple', TERMINADO: 'status-green', ENTREGADO: 'status-gray', CANCELADO: 'status-red' };
  const label: Record<string, string> = { RECIBIDO: 'Recibido', EN_PROCESO: 'En proceso', TERMINADO: 'Terminado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' };
  return <span className={`badge ${cls[status] ?? 'status-gray'}`}><i />{label[status] ?? status}</span>;
}

type CatalogEntry = { id: number; name: string; description?: string; unitType?: Service['unitType']; basePrice?: number };
function Catalog({ kind, title, isAdmin }: { kind: 'garments' | 'services'; title: string; isAdmin: boolean }) {
  const [rows, setRows] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<CatalogEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api<CatalogEntry[]>(`/${kind}`).then(setRows).catch(e => setError(e.message)), [kind]);
  useEffect(() => { load(); }, [load]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!editor) return;
    setSaving(true); setError('');
    const body = kind === 'services'
      ? { name: editor.name, description: editor.description, unitType: editor.unitType, basePrice: Number(editor.basePrice) }
      : { name: editor.name, description: editor.description };
    try {
      await api(`/${kind}${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setEditor(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el elemento.'); }
    finally { setSaving(false); }
  };
  return <><PageHeading eyebrow="CATÁLOGO" title={title} description="Los precios y tipos activos se utilizan para calcular nuevos pedidos." action={isAdmin ? <button className="primary-button" onClick={() => setEditor({ id: 0, name: '', description: '', unitType: 'PRENDA', basePrice: 0 })}><Plus size={17} /> Agregar</button> : undefined} />
    <div className="panel data-panel"><div className="table-toolbar"><div><h2>{kind === 'services' ? 'Servicios disponibles' : 'Tipos de prendas'}</h2><p>Datos consultados desde la base de datos</p></div></div>{error && <ErrorBanner message={error} retry={load} />}
      <div className="catalog-grid">{rows.map(row => <article className="catalog-card" key={row.id}><span className={`catalog-icon ${kind}`} >{kind === 'services' ? <Sparkles size={19} /> : <Shirt size={19} />}</span><div><b>{row.name}</b><small>{row.description || (kind === 'services' ? `Cobro por ${row.unitType === 'KILOGRAMO' ? 'kilogramo' : row.unitType === 'FIJO' ? 'servicio fijo' : 'prenda'}` : 'Prenda')}</small></div>{kind === 'services' && <strong>{money(row.basePrice ?? 0)}</strong>}{isAdmin && <button className="icon-button" aria-label={`Editar ${row.name}`} onClick={() => setEditor({ ...row })}><Settings size={15} /></button>}</article>)}
      {!rows.length && <EmptyState title="No hay elementos en el catálogo" text="Los elementos activos aparecerán aquí." />}</div></div>
    {editor && <Modal title={`${editor.id ? 'Editar' : 'Agregar'} ${kind === 'services' ? 'servicio' : 'tipo de prenda'}`} close={() => setEditor(null)}><form className="form-grid" onSubmit={save}>
      <label className="full-field">Nombre<input required maxLength={100} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></label>
      <label className="full-field">Descripción<input maxLength={255} value={editor.description ?? ''} onChange={e => setEditor({ ...editor, description: e.target.value })} /></label>
      {kind === 'services' && <>
        <label>Tipo de cobro<select value={editor.unitType} onChange={e => setEditor({ ...editor, unitType: e.target.value as Service['unitType'] })}><option value="PRENDA">Por prenda</option><option value="KILOGRAMO">Por kilogramo</option><option value="FIJO">Servicio fijo</option></select></label>
        <label>Precio (Bs)<input type="number" min="0" step="0.01" required value={editor.basePrice} onChange={e => setEditor({ ...editor, basePrice: Number(e.target.value) })} /></label>
      </>}
      {error && <div className="form-error full-field">{error}</div>}<div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setEditor(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
    </form></Modal>}
  </>;
}

function Payments({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidError, setVoidError] = useState('');
  const [voiding, setVoiding] = useState(false);
  const load = useCallback(() => api<any[]>('/payments').then(setRows).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const voidPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    setVoiding(true); setVoidError('');
    try { await api(`/payments/${voidTarget.id}/void`, { method: 'PATCH' }); setVoidTarget(null); await load(); setError(''); }
    catch (e) { setVoidError(e instanceof Error ? e.message : 'No se pudo anular el pago.'); }
    finally { setVoiding(false); }
  };
  return <><PageHeading eyebrow="GESTIÓN" title="Pagos" description="Consulta los pagos y cobros registrados." /><div className="panel data-panel"><div className="table-toolbar"><div><h2>Últimos pagos</h2><p>{rows.length} movimientos</p></div></div>{error && <ErrorBanner message={error} retry={load} />}<div className="table-scroll"><table><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>MÉTODO</th><th>FECHA</th><th>MONTO</th><th>ESTADO</th></tr></thead><tbody>{rows.map(p => <tr key={p.id}><td><b className="order-code">{p.orderCode}</b></td><td>{p.customerName}</td><td>{p.paymentMethod}</td><td>{date(p.paidAt)}</td><td><b>{money(p.amount)}</b></td><td>{p.voidedAt ? <span className="badge status-red">Anulado</span> : <div className="row-actions"><span className="badge status-green">Vigente</span>{isAdmin && <button className="small-action payment-action" onClick={() => { setVoidError(''); setVoidTarget(p); }}>Anular</button>}</div>}</td></tr>)}{!rows.length && <tr><td colSpan={6}><EmptyState title="Aún no hay pagos" text="Los pagos registrados desde un pedido aparecerán aquí." /></td></tr>}</tbody></table></div></div>
    {voidTarget && <Modal title="Anular pago" close={() => setVoidTarget(null)}><form className="form-grid" onSubmit={voidPayment}>
      <p className="full-field">Se anulará el pago de <b>{money(voidTarget.amount)}</b>. El registro se conservará en el historial y dejará de contar en el saldo cobrado.</p>
      {voidError && <div className="form-error full-field">{voidError}</div>}
      <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setVoidTarget(null)}>Cancelar</button><button className="primary-button" disabled={voiding}>{voiding ? 'Anulando…' : 'Confirmar anulación'}</button></div>
    </form></Modal>}
  </>;
}

function DeliveryModal({ order, close, onComplete }: { order: Order; close: () => void; onComplete: () => Promise<void> }) {
  const [receivedByName, setReceivedByName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api(`/orders/${order.id}/deliver`, { method: 'POST', body: JSON.stringify({ receivedByName: receivedByName.trim() }) });
      await onComplete();
      close();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo confirmar la entrega.'); }
    finally { setSaving(false); }
  };
  return <Modal title={`Confirmar entrega · ${order.orderCode}`} close={close}><form className="form-grid" onSubmit={submit}>
    <p className="full-field">Cliente: <b>{order.customerName}</b></p>
    <label className="full-field">Nombre de quien recibe<input required maxLength={120} value={receivedByName} onChange={e => setReceivedByName(e.target.value)} /></label>
    {error && <div className="form-error full-field">{error}</div>}
    <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={close}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Confirmando…' : 'Confirmar entrega'}</button></div>
  </form></Modal>;
}

function Deliveries() {
  const [rows, setRows] = useState<any[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const load = useCallback(async () => {
    try {
      const [delivered, ready] = await Promise.all([
        api<any[]>('/deliveries'),
        api<Order[]>(`/orders?status=TERMINADO&search=${encodeURIComponent(search)}`)
      ]);
      setRows(delivered); setReadyOrders(ready); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las entregas.'); }
  }, [search]);
  useEffect(() => { load(); }, [load]);
  return <><PageHeading eyebrow="GESTIÓN" title="Entregas" description="Busca pedidos terminados por código o cliente y confirma la entrega." />
    <div className="panel data-panel"><div className="table-toolbar"><div><h2>Listos para entregar</h2><p>{readyOrders.length} pedidos pendientes de entrega</p></div><label className="search-box"><Search size={16} /><input placeholder="Código de pedido o cliente..." value={search} onChange={e => setSearch(e.target.value)} /></label></div>{error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><table><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>FECHA LÍMITE</th><th>TOTAL</th><th>ENTREGA</th></tr></thead><tbody>{readyOrders.map(order => <tr key={order.id}><td><b className="order-code">{order.orderCode}</b></td><td>{order.customerName}</td><td>{date(order.expectedDeliveryAt)}</td><td><b>{money(Number(order.total))}</b></td><td><button className="small-action" onClick={() => setDeliveryOrder(order)}>Confirmar entrega <Check size={14} /></button></td></tr>)}{!readyOrders.length && <tr><td colSpan={5}><EmptyState title="No se encontraron pedidos listos" text="Ajusta la búsqueda o termina un pedido para entregarlo." /></td></tr>}</tbody></table></div>
    </div>
    <div className="panel data-panel delivery-history"><div className="table-toolbar"><div><h2>Entregas realizadas</h2><p>{rows.length} entregas</p></div></div><div className="table-scroll"><table><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>RECIBIDO POR</th><th>FECHA</th></tr></thead><tbody>{rows.map(d => <tr key={d.id}><td><b className="order-code">{d.orderCode}</b></td><td>{d.customerName}</td><td>{d.receivedByName}</td><td>{date(d.deliveredAt)}</td></tr>)}{!rows.length && <tr><td colSpan={4}><EmptyState title="Aún no hay entregas" text="Las entregas confirmadas aparecerán aquí." /></td></tr>}</tbody></table></div></div>
    {deliveryOrder && <DeliveryModal order={deliveryOrder} close={() => setDeliveryOrder(null)} onComplete={load} />}
  </>;
}

function UsersPage({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'STAFF' as User['role'] });
  const load = useCallback(() => api<User[]>('/users').then(setRows).catch(e => setError(e.message)), []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setOpen(false); setForm({ fullName: '', email: '', password: '', role: 'STAFF' }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el usuario.'); }
    finally { setSaving(false); }
  };
  if (!isAdmin) return <><PageHeading eyebrow="ACCESO" title="Usuarios" description="Solo los administradores pueden gestionar usuarios." /><div className="panel"><EmptyState title="Acceso restringido" text="Solicita a un administrador que gestione las cuentas." /></div></>;
  return <><PageHeading eyebrow="ADMINISTRACIÓN" title="Usuarios" description="Crea cuentas para el personal de la lavandería." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nuevo usuario</button>} />
    <div className="panel data-panel"><div className="table-toolbar"><div><h2>Cuentas del sistema</h2><p>{rows.length} usuarios</p></div></div>{error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><table><thead><tr><th>NOMBRE</th><th>CORREO</th><th>ROL</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><b>{row.fullName}</b></td><td>{row.email}</td><td><span className="badge status-blue">{row.role === 'ADMIN' ? 'Administrador' : 'Personal'}</span></td></tr>)}{!rows.length && <tr><td colSpan={3}><EmptyState title="No se encontraron usuarios" text="Crea una cuenta para el equipo." /></td></tr>}</tbody></table></div>
    </div>
    {open && <Modal title="Crear usuario" close={() => setOpen(false)}><form className="form-grid" onSubmit={save}>
      <label className="full-field">Nombre completo<input required maxLength={120} value={form.fullName} onChange={e => setForm({...form, fullName:e.target.value})} /></label>
      <label className="full-field">Correo electrónico<input type="email" required value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></label>
      <label className="full-field">Contraseña inicial<input type="password" minLength={12} required value={form.password} onChange={e => setForm({...form, password:e.target.value})} /><small className="field-note">Usa al menos 12 caracteres.</small></label>
      <label className="full-field">Rol<select value={form.role} onChange={e => setForm({...form, role:e.target.value as User['role']})}><option value="STAFF">Personal</option><option value="ADMIN">Administrador</option></select></label>
      {error && <div className="form-error full-field">{error}</div>}<div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Crear usuario'}</button></div>
    </form></Modal>}
  </>;
}

function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(); start.setDate(start.getDate() - 29);
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [sales, setSales] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const [s, st] = await Promise.all([api<any[]>(`/reports/sales?from=${from}&to=${to}`), api<any[]>('/reports/orders')]); setSales(s); setStates(st); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los reportes.'); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const exportCsv = () => {
    const csv = ['Fecha,Ingresos,Pagos', ...sales.map(r => `${r.date},${r.total},${r.payments}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'reporte-ventas.csv'; link.click(); URL.revokeObjectURL(url);
  };
  const total = useMemo(() => sales.reduce((sum, row) => sum + Number(row.total), 0), [sales]);
  return <><PageHeading eyebrow="ANÁLISIS" title="Reportes" description="Ingresos cobrados y distribución de pedidos." action={<button className="secondary-button" onClick={exportCsv}>Exportar CSV <ArrowDownLeft size={15} /></button>} />
    <div className="report-filters"><label>Desde<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label><label>Hasta<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label><button className="primary-button" onClick={load}>Aplicar filtros</button></div>
    {error && <ErrorBanner message={error} retry={load} />}
    <div className="report-grid"><div className="panel report-panel"><div className="panel-heading"><div><h2>Ingresos cobrados</h2><p>Pagos recibidos en el periodo seleccionado</p></div><span className="stat-icon green"><CircleDollarSign size={19} /></span></div><div className="report-total">{money(total)}</div><div className="table-scroll"><table><thead><tr><th>FECHA</th><th>PAGOS</th><th>INGRESOS</th></tr></thead><tbody>{sales.map(row => <tr key={row.date}><td>{date(row.date)}</td><td>{row.payments}</td><td>{money(row.total)}</td></tr>)}{!sales.length && <tr><td colSpan={3}><EmptyState title="Sin ingresos en el periodo" text="Prueba con otro rango de fechas." /></td></tr>}</tbody></table></div></div>
      <div className="panel report-panel"><div className="panel-heading"><div><h2>Pedidos por estado</h2><p>Totales registrados</p></div></div>{states.map(row => <div className="report-state" key={row.status}><Status status={row.status} /><b>{row.count}</b><span>{money(row.total)}</span></div>)}{!states.length && <EmptyState title="Sin pedidos" text="La distribución aparecerá cuando existan pedidos." />}</div></div>
  </>;
}

function SettingsPage({ isAdmin, appearance, loadError, onSave, onPreview }: {
  isAdmin: boolean;
  appearance: Appearance;
  loadError: string;
  onSave: (appearance: Appearance) => Promise<Appearance>;
  onPreview: (appearance: Appearance | null) => void;
}) {
  const [health, setHealth] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(appearance);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const check = () => api('/health/database').then(() => { setHealth('Conectada'); setError(''); }).catch(e => { setHealth(''); setError(e.message); });
  useEffect(() => {
    setDraft(appearance);
  }, [appearance]);
  useEffect(() => {
    onPreview(draft);
  }, [draft, onPreview]);
  useEffect(() => () => onPreview(null), [onPreview]);
  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await onSave(draft);
      setDraft(result);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar las preferencias.');
    } finally {
      setSaving(false);
    }
  };
  const reset = () => {
    setDraft(DEFAULT_APPEARANCE);
    setSaved(false);
  };
  const selectedFont = FONT_OPTIONS.find(option => option.id === draft.fontFamily) ?? FONT_OPTIONS[0];
  return <><PageHeading eyebrow="PREFERENCIAS" title="Configuración" description="Información general, apariencia y estado de los servicios." />
    {loadError && <div className="error-banner error-row">{loadError}</div>}
    <div className="settings-grid">
      {isAdmin && <section className="panel settings-card appearance-card">
        <div className="appearance-title"><span className="stat-icon blue"><Sparkles size={18} /></span><div><h2>Apariencia de la aplicación</h2><p>Elige los colores y la tipografía para todo el sistema.</p></div></div>
        <div className="appearance-section">
          <div className="appearance-section-heading"><b>Color principal</b><span>12 colores</span></div>
          <div className="color-palette" role="group" aria-label="Colores de la aplicación">
            {COLOR_PALETTE.map(color => <button key={color.hex} type="button" className={`color-choice ${draft.accentColor === color.hex ? 'selected' : ''}`} aria-label={`Usar color ${color.name}`} aria-pressed={draft.accentColor === color.hex} title={color.name} onClick={() => { setDraft(value => ({ ...value, accentColor: color.hex })); setSaved(false); }}>
              <span className="color-swatch" style={{ backgroundColor: color.hex }}>{draft.accentColor === color.hex && <Check size={16} />}</span><small>{color.name}</small>
            </button>)}
          </div>
        </div>
        <label className="font-setting">Tipografía
          <select value={draft.fontFamily} onChange={event => {
            const font = FONT_OPTIONS.find(option => option.id === event.target.value);
            if (!font) {
              setError('La tipografía seleccionada no es válida.');
              return;
            }
            setDraft(value => ({ ...value, fontFamily: font.id }));
            setSaved(false);
          }}>
            {FONT_OPTIONS.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}
          </select>
        </label>
        <label className="font-setting background-setting">Fondo de la aplicación
          <select value={draft.backgroundMode} onChange={event => {
            const mode = event.target.value;
            if (mode !== 'light' && mode !== 'dark') {
              setError('El fondo seleccionado no es válido.');
              return;
            }
            setDraft(value => ({ ...value, backgroundMode: mode }));
            setSaved(false);
          }}>
            <option value="light">Blanco</option>
            <option value="dark">Casi negro</option>
          </select>
        </label>
        <div className={`appearance-preview ${draft.backgroundMode === 'dark' ? 'appearance-preview-dark' : ''}`}>
          <div><small>VISTA PREVIA</small><strong style={{ fontFamily: selectedFont.stack }}>LaundryManager</strong><span style={{ fontFamily: selectedFont.stack }}>Gestión simple, ropa impecable</span></div>
          <button type="button" className="primary-button">Botón principal</button>
        </div>
        <div className="appearance-actions">
          {saved && <span className="form-success" role="status">Apariencia guardada para toda la aplicación.</span>}
          {error && <span className="form-error" role="alert">{error}</span>}
          <button type="button" className="secondary-button" onClick={reset} disabled={saving}>Restablecer</button>
          <button type="button" className="primary-button" onClick={save} disabled={saving || (draft.accentColor === appearance.accentColor && draft.fontFamily === appearance.fontFamily && draft.backgroundMode === appearance.backgroundMode)}>{saving ? 'Guardando…' : 'Guardar apariencia'}</button>
        </div>
      </section>}
      {!isAdmin && <div className="panel settings-card"><span className="stat-icon blue"><Droplets /></span><h2>LaundryManager</h2><p>La apariencia de la aplicación es administrada por el administrador.</p><div className="setting-line"><span>Moneda</span><b>Boliviano (Bs)</b></div><div className="setting-line"><span>Idioma</span><b>Español</b></div></div>}
      <div className="panel settings-card"><span className="stat-icon green"><Check /></span><h2>Conexión de datos</h2><p>Verifica la disponibilidad de la base de datos.</p><div className="setting-line"><span>Base de datos</span><b>{health || 'No comprobada'}</b></div>{error && !isAdmin && <div className="form-error">{error}</div>}<button className="secondary-button" onClick={check}>Comprobar conexión</button></div>
      {isAdmin && <div className="panel settings-card"><span className="stat-icon blue"><Droplets /></span><h2>LaundryManager</h2><p>Gestión de lavandería con precios en bolivianos (BOB).</p><div className="setting-line"><span>Moneda</span><b>Boliviano (Bs)</b></div><div className="setting-line"><span>Idioma</span><b>Español</b></div></div>}
    </div>
  </>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="welcome-row page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>;
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Droplets size={20} /></span><b>{title}</b><p>{text}</p></div>;
}
function ErrorBanner({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-banner error-row"><span>{message}</span><button onClick={retry}>Reintentar</button></div>;
}
function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [close]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal"><div className="modal-heading"><div><span className="eyebrow">LAVANDERÍA</span><h2>{title}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X size={19} /></button></div>{children}</section></div>;
}
