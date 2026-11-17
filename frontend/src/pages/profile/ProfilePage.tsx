import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  KeyRound, LogOut, Package, Receipt, Save, Truck, User as UserIcon
} from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, PageHeading, Status } from '../../components/ui';
import { date } from '../../utils/format';
import type { User } from '../../types';

type ProfileData = {
  user: User & { phone?: string | null; avatarUrl?: string | null; createdAt?: string; active?: boolean; lastLoginAt?: string };
  stats: { ordersCreated: number; paymentsRegistered: number; paymentsVoided: number; deliveriesConfirmed: number };
  recentOrders: Array<{ id: number; orderCode: string; status: string; total: number; receivedAt: string }>;
};

export function ProfilePage({ onLogout }: { onLogout: () => Promise<void> }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', avatarUrl: '' });
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<ProfileData>('/auth/profile');
      setData(result);
      setForm({ fullName: result.user.fullName, phone: result.user.phone ?? '', avatarUrl: result.user.avatarUrl ?? '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setForm((f) => ({ ...f, avatarUrl: dataUrl }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: form.fullName.trim(), phone: form.phone.trim(), avatarUrl: form.avatarUrl.trim() })
      });
      setSuccess('Perfil actualizado correctamente.');
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const user = data?.user;
  const initials = (user?.fullName ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return <>
    <PageHeading eyebrow="CUENTA" title="Mi perfil" description="Información de tu cuenta, actividad en la lavandería y seguridad." />

    {error && <ErrorBanner message={error} retry={load} />}

    {loading && <div className="panel"><p className="muted">Cargando perfil…</p></div>}

    {user && <>
      <div className="profile-page-grid">
        {/* Identidad */}
        <section className="panel profile-identity">
          <div className="profile-avatar-large">
            {user.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} /> : initials}
          </div>
          <div className="profile-identity-body">
            <h2>{user.fullName}</h2>
            <p className="muted">{user.email}</p>
            <div className="profile-badges">
              <span className={`badge ${user.role === 'ADMIN' ? 'status-blue' : 'status-purple'}`}><i />{user.role === 'ADMIN' ? 'Administrador' : 'Personal'}</span>
              <span className={`badge ${user.active === false ? 'status-gray' : 'status-green'}`}><i />{user.active === false ? 'Inactivo' : 'Activo'}</span>
            </div>
          </div>
          {editing ? (
            <form className="profile-edit-form" onSubmit={save}>
              <label>Nombre completo
                <input required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </label>
              <label>Teléfono
                <input maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Opcional" />
              </label>
              <div className="profile-avatar-upload">
                <div className="profile-avatar-large" style={{ width: 64, height: 64, fontSize: 22, borderRadius: 16 }}>
                  {form.avatarUrl ? <img src={form.avatarUrl} alt="preview" /> : (user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase())}
                </div>
                <div className="profile-avatar-upload-actions">
                  <label className="secondary-button" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
                    Subir foto
                  </label>
                  {form.avatarUrl && <button type="button" className="small-action" onClick={() => setForm({ ...form, avatarUrl: '' })}>Quitar</button>}
                  <small className="field-note">Se redimensiona a 256×256 y se guarda en tu perfil.</small>
                </div>
              </div>
              <label>Foto de perfil (URL)
                <input maxLength={500} value={form.avatarUrl ?? ''} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} placeholder="https://..." />
              </label>
              <div className="row-actions">
                <button type="button" className="secondary-button" onClick={() => { setEditing(false); setForm({ fullName: user.fullName, phone: user.phone ?? '', avatarUrl: user.avatarUrl ?? '' }); }}>Cancelar</button>
                <button className="primary-button" disabled={saving}><Save size={15} /> {saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
              {success && <span className="form-success" role="status">{success}</span>}
            </form>
          ) : (
            <button className="secondary-button profile-edit-btn" onClick={() => setEditing(true)}>
              <UserIcon size={15} /> Editar perfil
            </button>
          )}
        </section>

        {/* Datos de cuenta */}
        <section className="panel profile-section">
          <h3><UserIcon size={15} /> Datos de la cuenta</h3>
          <div className="profile-kv">
            <div><span>ID de usuario</span><b>#{user.id}</b></div>
            <div><span>Correo</span><b>{user.email}</b></div>
            <div><span>Teléfono</span><b>{user.phone || 'No registrado'}</b></div>
            <div><span>Rol</span><b>{user.role === 'ADMIN' ? 'Administrador' : 'Personal'}</b></div>
            <div><span>Miembro desde</span><b>{date(user.createdAt ?? '')}</b></div>
            <div><span>Último acceso</span><b>{user.lastLoginAt ? date(user.lastLoginAt) : '—'}</b></div>
          </div>
        </section>

        {/* Actividad */}
        <section className="panel profile-section">
          <h3><Package size={15} /> Actividad en la lavandería</h3>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-icon blue"><Receipt size={20} /></span>
              <b>{data.stats.ordersCreated}</b>
              <small>Pedidos creados</small>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-icon green"><Package size={20} /></span>
              <b>{data.stats.paymentsRegistered}</b>
              <small>Pagos registrados</small>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-icon purple"><Truck size={20} /></span>
              <b>{data.stats.deliveriesConfirmed}</b>
              <small>Entregas confirmadas</small>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-icon orange"><Receipt size={20} /></span>
              <b>{data.stats.paymentsVoided}</b>
              <small>Pagos anulados</small>
            </div>
          </div>
        </section>

        {/* Pedidos recientes */}
        <section className="panel profile-section">
          <h3><Receipt size={15} /> Mis últimos pedidos</h3>
          {data.recentOrders.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>PEDIDO</th><th>FECHA</th><th>ESTADO</th><th>TOTAL</th></tr></thead>
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td><b className="order-code">{o.orderCode}</b></td>
                      <td>{date(o.receivedAt)}</td>
                      <td><Status status={o.status} /></td>
                      <td><b>{new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(o.total)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="Sin pedidos creados" text="Los pedidos que registres aparecerán aquí." />}
        </section>

        {/* Seguridad */}
        <section className="panel profile-section">
          <h3><KeyRound size={15} /> Seguridad</h3>
          <div className="profile-kv">
            <div><span>Sesión</span><b>8 horas · cookie HttpOnly</b></div>
            <div><span>Contraseña</span><b>Mínimo 12 caracteres</b></div>
          </div>
          <div className="row-actions" style={{ marginTop: 8 }}>
            <button className="secondary-button" onClick={() => window.location.assign('/settings')}>
              <KeyRound size={15} /> Cambiar contraseña
            </button>
            <button className="primary-button" onClick={onLogout}>
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        </section>
      </div>
    </>}
  </>;
}
