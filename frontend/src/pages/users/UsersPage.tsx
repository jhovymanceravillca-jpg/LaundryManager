import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, Modal, PageHeading } from '../../components/ui';
import type { Role, User } from '../../types';

export function UsersPage({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: number }) {
  const [rows, setRows] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'STAFF' as Role });

  const load = useCallback(() => api<User[]>('/users').then(setRows).catch((e) => setError(e.message)), []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setOpen(false);
      setForm({ fullName: '', email: '', password: '', role: 'STAFF' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (target: User, changes: { role?: Role; active?: boolean }) => {
    setSavingUserId(target.id);
    setError('');
    try {
      await api(`/users/${target.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    } finally {
      setSavingUserId(null);
    }
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (password !== confirmPassword) { setPasswordError('Las contraseñas no coinciden.'); return; }
    setResettingPassword(true);
    setPasswordError('');
    try {
      await api(`/users/${passwordUser.id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) });
      setPasswordUser(null);
      setPassword('');
      setConfirmPassword('');
      await load();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setResettingPassword(false);
    }
  };

  if (!isAdmin) return <>
    <PageHeading eyebrow="ACCESO" title="Usuarios" description="Solo los administradores pueden gestionar usuarios." />
    <div className="panel"><EmptyState title="Acceso restringido" text="Solicita a un administrador que gestione las cuentas." /></div>
  </>;

  return <>
    <PageHeading eyebrow="ADMINISTRACIÓN" title="Usuarios" description="Crea cuentas para el personal de la lavandería." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nuevo usuario</button>} />
    <div className="panel data-panel">
      <div className="table-toolbar"><div><h2>Cuentas del sistema</h2><p>{rows.length} usuarios</p></div></div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><table><thead><tr><th>NOMBRE</th><th>CORREO</th><th>ROL</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>
        {rows.map((row) => {
          const isCurrentUser = row.id === currentUserId;
          const isSaving = savingUserId === row.id;
          return <tr key={row.id}>
            <td><b>{row.fullName}</b></td><td>{row.email}</td>
            <td><select aria-label={`Rol de ${row.fullName}`} value={row.role} disabled={isCurrentUser || isSaving} onChange={(e) => updateUser(row, { role: e.target.value as Role })}>
              <option value="STAFF">Personal</option><option value="ADMIN">Administrador</option>
            </select></td>
            <td><span className={`badge ${row.active ? 'status-green' : 'status-gray'}`}>{row.active ? 'Activo' : 'Inactivo'}</span></td>
            <td><div className="row-actions">
              <button className="small-action" disabled={isCurrentUser || isSaving} onClick={() => {
                const active = !row.active;
                if (active || window.confirm(`¿Desactivar la cuenta de ${row.fullName}? Su sesión quedará invalidada.`)) updateUser(row, { active });
              }}>{row.active ? 'Desactivar' : 'Activar'}</button>
              <button className="small-action payment-action" disabled={isCurrentUser || isSaving || !row.active} onClick={() => { setPasswordUser(row); setPassword(''); setConfirmPassword(''); setPasswordError(''); }}>Restablecer contraseña</button>
            </div></td>
          </tr>;
        })}
        {!rows.length && <tr><td colSpan={5}><EmptyState title="No se encontraron usuarios" text="Crea una cuenta para el equipo." /></td></tr>}
      </tbody></table></div>
    </div>
    {open && <Modal title="Crear usuario" close={() => setOpen(false)}>
      <form className="form-grid" onSubmit={save}>
        <label className="full-field">Nombre completo<input required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
        <label className="full-field">Correo electrónico<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="full-field">Contraseña inicial<input type="password" minLength={12} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small className="field-note">Usa al menos 12 caracteres.</small></label>
        <label className="full-field">Rol<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="STAFF">Personal</option><option value="ADMIN">Administrador</option></select></label>
        {error && <div className="form-error full-field">{error}</div>}
        <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Crear usuario'}</button></div>
      </form>
    </Modal>}
    {passwordUser && <Modal title={`Restablecer contraseña · ${passwordUser.fullName}`} close={() => setPasswordUser(null)}>
      <form className="form-grid" onSubmit={resetPassword}>
        <p className="full-field">Al guardar, se cerrarán todas las sesiones abiertas de esta cuenta.</p>
        <label className="full-field">Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={200} required value={password} onChange={(e) => setPassword(e.target.value)} /><small className="field-note">Usa al menos 12 caracteres.</small></label>
        <label className="full-field">Confirmar contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={200} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
        {passwordError && <div className="form-error full-field">{passwordError}</div>}
        <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setPasswordUser(null)}>Cancelar</button><button className="primary-button" disabled={resettingPassword}>{resettingPassword ? 'Guardando…' : 'Restablecer contraseña'}</button></div>
      </form>
    </Modal>}
  </>;
}
