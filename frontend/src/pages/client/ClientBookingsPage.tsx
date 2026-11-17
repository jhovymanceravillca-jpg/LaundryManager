import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, PageHeading } from '../../components/ui';
import { date } from '../../utils/format';

type Booking = { id: number; shopId: number; shopName: string; service: string; scheduledAt: string; status: string; notes: string | null; createdAt: string };

const statusClass = (s: string) => ({ PENDIENTE: 'status-blue', CONFIRMADO: 'status-green', CANCELADO: 'status-red', COMPLETADO: 'status-gray' } as Record<string, string>)[s] ?? 'status-gray';
const statusLabel = (s: string) => ({ PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', CANCELADO: 'Cancelado', COMPLETADO: 'Completado' } as Record<string, string>)[s] ?? s;

export function ClientBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBookings(await api<Booking[]>('/client/bookings'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los turnos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return <>
    <PageHeading eyebrow="TURNOS" title="Mis turnos reservados" description="Tus reservas en las lavanderías." />
    {error && <ErrorBanner message={error} retry={load} />}
    {loading ? <div className="panel"><p className="muted">Cargando…</p></div> : (
      <div className="panel data-panel">
        <div className="table-toolbar"><div><h2>Turnos</h2><p>{bookings.length} reservas</p></div></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>LAVANDERÍA</th><th>SERVICIO</th><th>FECHA Y HORA</th><th>ESTADO</th><th>NOTAS</th></tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.shopName}</b></td>
                  <td>{b.service}</td>
                  <td><Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />{date(b.scheduledAt)}</td>
                  <td><span className={`badge ${statusClass(b.status)}`}><i />{statusLabel(b.status)}</span></td>
                  <td className="muted small">{b.notes || '—'}</td>
                </tr>
              ))}
              {!bookings.length && <tr><td colSpan={5}><EmptyState title="Sin turnos" text="Reserva un turno desde el detalle de una lavandería." /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </>;
}
