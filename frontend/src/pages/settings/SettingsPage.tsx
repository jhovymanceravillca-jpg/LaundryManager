import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Droplets, KeyRound, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { PageHeading } from '../../components/ui';
import { COLOR_PALETTE, DEFAULT_APPEARANCE, FONT_OPTIONS, type Appearance } from '../../types';

export function SettingsPage({ isAdmin, appearance, loadError, onSave, onPreview }: {
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
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const check = () => api('/health/database').then(() => { setHealth('Conectada'); setError(''); }).catch((e) => { setHealth(''); setError(e.message); });

  useEffect(() => { setDraft(appearance); }, [appearance]);
  useEffect(() => { onPreview(draft); }, [draft, onPreview]);
  useEffect(() => () => onPreview(null), [onPreview]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await onSave(draft);
      setDraft(result);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las preferencias.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft(DEFAULT_APPEARANCE);
    setSaved(false);
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSuccess('Contraseña actualizada. Las demás sesiones de tu cuenta fueron cerradas.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const selectedFont = FONT_OPTIONS.find((option) => option.id === draft.fontFamily) ?? FONT_OPTIONS[0];

  return <>
    <PageHeading eyebrow="PREFERENCIAS" title="Configuración" description="Información general, apariencia y estado de los servicios." />
    {loadError && <div className="error-banner error-row">{loadError}</div>}
    <div className="settings-grid">
      {isAdmin && <section className="panel settings-card appearance-card">
        <div className="appearance-title"><span className="stat-icon blue"><Sparkles size={18} /></span><div><h2>Apariencia de la aplicación</h2><p>Elige los colores y la tipografía para todo el sistema.</p></div></div>
        <div className="appearance-section">
          <div className="appearance-section-heading"><b>Color principal</b><span>12 colores</span></div>
          <div className="color-palette" role="group" aria-label="Colores de la aplicación">
            {COLOR_PALETTE.map((color) => <button key={color.hex} type="button" className={`color-choice ${draft.accentColor === color.hex ? 'selected' : ''}`} aria-label={`Usar color ${color.name}`} aria-pressed={draft.accentColor === color.hex} title={color.name} onClick={() => { setDraft((value) => ({ ...value, accentColor: color.hex })); setSaved(false); }}>
              <span className="color-swatch" style={{ backgroundColor: color.hex }}>{draft.accentColor === color.hex && <Check size={16} />}</span><small>{color.name}</small>
            </button>)}
          </div>
        </div>
        <label className="font-setting">Tipografía
          <select value={draft.fontFamily} onChange={(event) => {
            const font = FONT_OPTIONS.find((option) => option.id === event.target.value);
            if (!font) { setError('La tipografía seleccionada no es válida.'); return; }
            setDraft((value) => ({ ...value, fontFamily: font.id }));
            setSaved(false);
          }}>
            {FONT_OPTIONS.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}
          </select>
        </label>
        <label className="font-setting background-setting">Fondo de la aplicación
          <select value={draft.backgroundMode} onChange={(event) => {
            const mode = event.target.value;
            if (mode !== 'light' && mode !== 'dark') { setError('El fondo seleccionado no es válido.'); return; }
            setDraft((value) => ({ ...value, backgroundMode: mode }));
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
      <section className="panel settings-card">
        <span className="stat-icon blue"><KeyRound size={18} /></span>
        <h2>Cambiar contraseña</h2>
        <p>Actualiza la contraseña de tu propia cuenta. Se cerrarán las demás sesiones abiertas.</p>
        <form className="form-grid" onSubmit={changePassword}>
          <label className="full-field">Contraseña actual
            <input type="password" autoComplete="current-password" required maxLength={200} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
          </label>
          <label className="full-field">Nueva contraseña
            <input type="password" autoComplete="new-password" minLength={12} maxLength={200} required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
            <small className="field-note">Usa al menos 12 caracteres.</small>
          </label>
          <label className="full-field">Confirmar nueva contraseña
            <input type="password" autoComplete="new-password" minLength={12} maxLength={200} required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
          </label>
          {passwordSuccess && <span className="form-success full-field" role="status">{passwordSuccess}</span>}
          {passwordError && <div className="form-error full-field" role="alert">{passwordError}</div>}
          <div className="modal-actions full-field">
            <button className="primary-button" disabled={passwordSaving}>{passwordSaving ? 'Guardando…' : 'Cambiar contraseña'}</button>
          </div>
        </form>
      </section>
      <div className="panel settings-card"><span className="stat-icon green"><Check /></span><h2>Conexión de datos</h2><p>Verifica la disponibilidad de la base de datos.</p><div className="setting-line"><span>Base de datos</span><b>{health || 'No comprobada'}</b></div>{error && !isAdmin && <div className="form-error">{error}</div>}<button className="secondary-button" onClick={check}>Comprobar conexión</button></div>
      {isAdmin && <div className="panel settings-card"><span className="stat-icon blue"><Droplets /></span><h2>LaundryManager</h2><p>Gestión de lavandería con precios en bolivianos (BOB).</p><div className="setting-line"><span>Moneda</span><b>Boliviano (Bs)</b></div><div className="setting-line"><span>Idioma</span><b>Español</b></div></div>}
    </div>
  </>;
}
