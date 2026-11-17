import { useCallback, useEffect, useState } from 'react';
import { Calendar, KeyRound, LogOut, Package, Receipt, Truck, User as UserIcon } from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../ui';
import { date } from '../../utils/format';
import type { User } from '../../types';

type ProfileData = {
  user: User & { createdAt?: string; active?: boolean };
  stats: { ordersCreated: number; paymentsRegistered: number; deliveriesConfirmed: number };
};

export function ProfileModal({ user, close, onLogout, onSettings }: {
  user: User;
  close: () => void;
  onLogout: () => Promise<void>;
  onSettings: () => void;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api<ProfileData>('/auth/profile'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const initials = user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return <Modal title="Mi perfil" close={close}>
    <div className="profile-modal">
      <div className="profile-modal-header">
        <div className="profile-modal-avatar">{initials}</div>
        <div className="profile-modal-identity">
          <h3>{user.fullName}</h3>
          <p className="muted">{user.email ?? 'Sin correo registrado'}</p>
          <div className="profile-modal-badges">
            <span className={`badge ${user.role === 'ADMIN' ? 'status-blue' : 'status-purple'}`}>
              <i />{user.role === 'ADMIN' ? 'Administrador' : 'Personal'}
            </span>
            <span className={`badge ${data?.user.active === false ? 'status-gray' : 'status-green'}`}>
              <i />{data?.user.active === false ? 'Inactivo' : 'Activo'}
            </span>
          </div>
        </div>
      </div>

      {loading && <div className="profile-modal-loading"><span className="spinner" /> Cargando información…</div>}
      {error && <div className="error-banner">{error}</div>}

      {data && <>
        <div className="profile-modal-section">
          <h4><UserIcon size={14} /> Datos de la cuenta</h4>
          <div className="profile-modal-grid">
            <div><span>ID de usuario</span><b>#{data.user.id}</b></div>
            <div><span>Miembro desde</span><b>{date(data.user.createdAt ?? '')}</b></div>
            <div><span>Correo</span><b>{data.user.email}</b></div>
            <div><span>Rol</span><b>{data.user.role === 'ADMIN' ? 'Administrador' : 'Personal'}</b></div>
          </div>
        </div>

        <div className="profile-modal-section">
          <h4><Package size={14} /> Actividad en la lavandería</h4>
          <div className="profile-modal-stats">
            <div className="profile-stat">
              <span className="profile-stat-icon blue"><Receipt size={18} /></span>
              <b>{data.stats.ordersCreated}</b>
              <small>Pedidos creados</small>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-icon green"><Package size={18} /></span>
              <b>{data.stats.paymentsRegistered}</b>
              <small>Pagos registrados</small>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-icon purple"><Truck size={18} /></span>
              <b>{data.stats.deliveriesConfirmed}</b>
              <small>Entregas confirmadas</small>
            </div>
          </div>
        </div>

        <div className="profile-modal-section">
          <h4><Calendar size={14} /> Preferencias</h4>
          <p className="muted small">Moneda: Boliviano (BOB) · Idioma: Español · Sesión: 8 horas</p>
        </div>
      </>}

      <div className="modal-actions profile-modal-actions">
        <button type="button" className="secondary-button" onClick={() => { close(); onSettings(); }}>
          <KeyRound size={15} /> Cambiar contraseña
        </button>
        <button type="button" className="primary-button" onClick={async () => { await onLogout(); close(); }}>
          <LogOut size={15} /> Cerrar sesión
        </button>
      </div>
    </div>
  </Modal>;
}
