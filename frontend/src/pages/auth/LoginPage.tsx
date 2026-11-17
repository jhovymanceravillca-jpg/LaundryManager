import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Droplets } from 'lucide-react';
import { api } from '../../services/api';
import type { User } from '../../types';

export function LoginPage({ onLogin, error, setError, setupRequired }: {
  onLogin: (user: User) => void;
  error: string;
  setError: (message: string) => void;
  setupRequired: boolean;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    if (setupRequired && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      setBusy(false);
      return;
    }
    try {
      const payload = setupRequired ? { fullName, email, password } : { email, password };
      const result = await api<{ user: User }>(setupRequired ? '/auth/setup' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="login-page">
    <div className="login-decoration">
      <div className="wash-circle wash-one" />
      <div className="wash-circle wash-two" />
      <div className="login-note"><Droplets size={20} /><span>Tu lavandería,<br /><b>en orden.</b></span></div>
    </div>
    <form className="login-card" onSubmit={submit}>
      <div className="login-brand"><span className="brand-mark"><Droplets /></span><b>Laundry<span className="brand-light">Manager</span></b></div>
      <span className="eyebrow">{setupRequired ? 'CONFIGURACIÓN INICIAL' : 'BIENVENIDO DE NUEVO'}</span>
      <h1>{setupRequired ? 'Crea la cuenta administradora' : 'Inicia sesión'}</h1>
      <p className="muted">{setupRequired ? 'Esta cuenta inicial será administradora del sistema.' : 'Ingresa tus datos para acceder al panel.'}</p>
      {setupRequired && <label>Nombre completo
        <input autoComplete="name" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
      </label>}
      <label>Correo electrónico
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@lavanderia.com" />
      </label>
      <label>{setupRequired ? 'Contraseña (mínimo 12 caracteres)' : 'Contraseña'}
        <input type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} minLength={setupRequired ? 12 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" />
      </label>
      {setupRequired && <label>Confirma la contraseña
        <input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••••••" />
      </label>}
      {error && <div className="error-banner">{error}</div>}
      <button className="primary-button login-submit" disabled={busy}>
        {busy ? 'Un momento…' : setupRequired ? 'Crear cuenta administradora' : 'Ingresar al sistema'}<ArrowUpRight size={17} />
      </button>
      <small className="login-footnote">Cuenta de acceso creada por el administrador del sistema.</small>
    </form>
  </div>;
}
