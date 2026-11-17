import { useState } from 'react';
import { Building2, Droplets, MapPin, Shirt, Sparkles, Truck, User, Zap } from 'lucide-react';
import { api } from '../../services/api';
import type { User as UserType } from '../../types';

type Mode = 'login' | 'register-client' | 'register-business';

export function LandingPage({ onLogin, setupRequired }: { onLogin: (user: UserType) => void; setupRequired: boolean }) {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let endpoint = '/auth/login';
      let body: Record<string, unknown> = { email: form.email, password: form.password };
      if (mode === 'register-client') {
        endpoint = '/auth/register-client';
        body = { fullName: form.fullName, email: form.email, password: form.password, phone: form.phone };
      } else if (mode === 'register-business') {
        endpoint = '/auth/setup';
        body = { fullName: form.fullName, email: form.email, password: form.password };
      }
      const result = await api<{ user: UserType }>(endpoint, { method: 'POST', body: JSON.stringify(body) });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode !== 'login';

  return <div className="landing">
    <div className="landing-bg">
      <div className="landing-blob b1" />
      <div className="landing-blob b2" />
      <div className="landing-blob b3" />
    </div>
    <header className="landing-nav">
      <div className="landing-brand">
        <span className="brand-mark"><Droplets size={20} /></span>
        <span>Laundry<span className="brand-light">Manager</span></span>
      </div>
      <div className="landing-nav-actions">
        <button className={`landing-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Iniciar sesión</button>
      </div>
    </header>

    <main className="landing-hero">
      <div className="landing-hero-text">
        <span className="landing-eyebrow"><Sparkles size={14} /> Tu lavandería, a un clic</span>
        <h1>Ropa impecable,<br /><span className="landing-gradient">sin salir de casa.</span></h1>
        <p>Registra tu cuenta, encuentra la lavandería más cercana y sigue tus pedidos en tiempo real. Rápido, seguro y en bolivianos.</p>
        <div className="landing-features">
          <div className="landing-feature"><MapPin size={18} /><span>Lavanderías cercanas</span></div>
          <div className="landing-feature"><Truck size={18} /><span>Seguimiento en vivo</span></div>
          <div className="landing-feature"><Shirt size={18} /><span>Precios transparentes</span></div>
          <div className="landing-feature"><Zap size={18} /><span>Pago rápido</span></div>
        </div>

        <div className="landing-register-options">
          <h3>¿Aún no tienes cuenta?</h3>
          <div className="landing-register-cards">
            <button className={`landing-register-card ${mode === 'register-client' ? 'active' : ''}`} onClick={() => setMode('register-client')}>
              <span className="landing-register-icon client"><User size={22} /></span>
              <div>
                <b>Registrarse como cliente</b>
                <small>Crea tu cuenta y encuentra lavanderías cerca de ti.</small>
              </div>
            </button>
            <button className={`landing-register-card ${mode === 'register-business' ? 'active' : ''}`} onClick={() => setMode('register-business')}>
              <span className="landing-register-icon business"><Building2 size={22} /></span>
              <div>
                <b>Registrarse como negocio</b>
                <small>Registra tu lavandería y gestiona tus pedidos.</small>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="landing-card">
        <h2>
          {mode === 'login' && 'Bienvenido de nuevo'}
          {mode === 'register-client' && 'Crear cuenta de cliente'}
          {mode === 'register-business' && 'Registrar mi lavandería'}
        </h2>
        <p className="muted">
          {mode === 'login' && 'Ingresa para ver tus pedidos y lavanderías cercanas.'}
          {mode === 'register-client' && 'Únete y gestiona tus pedidos fácilmente.'}
          {mode === 'register-business' && (setupRequired ? 'Configura la cuenta administradora inicial.' : 'El registro de negocios está cerrado. Contacta al administrador.')}
        </p>

        {mode === 'register-business' && !setupRequired ? (
          <div className="error-banner">Ya existe un negocio registrado. Inicia sesión con tu cuenta de administrador.</div>
        ) : (
          <form className="landing-form" onSubmit={submit}>
            {isRegister && mode === 'register-client' && <>
              <label>Nombre completo
                <input required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Tu nombre" />
              </label>
              <label>Teléfono
                <input maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+591 ..." />
              </label>
            </>}
            {isRegister && mode === 'register-business' && <>
              <label>Nombre del negocio / administrador
                <input required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Tu nombre" />
              </label>
            </>}
            <label>Correo electrónico
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@correo.com" />
            </label>
            <label>Contraseña
              <input type="password" required minLength={mode === 'register-client' ? 8 : (mode === 'register-business' ? 12 : 1)} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </label>
            {error && <div className="error-banner">{error}</div>}
            <button className="primary-button landing-submit" disabled={busy || (mode === 'register-business' && !setupRequired)}>
              {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : mode === 'register-client' ? 'Crear cuenta de cliente' : 'Registrar negocio'}
            </button>
          </form>
        )}
        <p className="landing-switch">
          {mode !== 'login' ? '¿Ya tienes cuenta?' : '¿Quieres otra opción?'}
          <button className="link-button" onClick={() => setMode('login')}>
            {mode !== 'login' ? 'Inicia sesión' : ''}
          </button>
        </p>
      </div>
    </main>

    <footer className="landing-footer">
      <span>© {new Date().getFullYear()} LaundryManager</span>
      <span>Gestión simple, ropa impecable <Droplets size={13} /></span>
    </footer>
  </div>;
}
