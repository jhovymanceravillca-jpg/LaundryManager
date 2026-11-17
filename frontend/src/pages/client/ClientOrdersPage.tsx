import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, PageHeading } from '../../components/ui';
import { date, money } from '../../utils/format';

type Order = { id: number; orderCode: string; status: string; total: number; expectedDeliveryAt: string; receivedAt: string; paid: number };

export function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await api<Order[]>('/client/orders'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusClass = (s: string) => ({ RECIBIDO: 'status-blue', EN_PROCESO: 'status-purple', TERMINADO: 'status-green', ENTREGADO: 'status-gray', CANCELADO: 'status-red' } as Record<string, string>)[s] ?? 'status-gray';
  const statusLabel = (s: string) => ({ RECIBIDO: 'Recibido', EN_PROCESO: 'En proceso', TERMINADO: 'Terminado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' } as Record<string, string>)[s] ?? s;

  return <>
    <PageHeading eyebrow="MIS PEDIDOS" title="Mis pedidos" description="Historial de todos tus servicios de lavandería." />
    {error && <ErrorBanner message={error} retry={load} />}
    <div className="panel data-panel">
      <div className="table-toolbar"><div><h2>Pedidos</h2><p>{orders.length} pedidos registrados</p></div></div>
      {loading ? <p className="muted">Cargando…</p> : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>PEDIDO</th><th>RECIBIDO</th><th>ENTREGA ESTIMADA</th><th>ESTADO</th><th>TOTAL</th><th>PAGADO</th><th>SALDO</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><b className="order-code">{o.orderCode}</b></td>
                  <td>{date(o.receivedAt)}</td>
                  <td>{date(o.expectedDeliveryAt)}</td>
                  <td><span className={`badge ${statusClass(o.status)}`}><i />{statusLabel(o.status)}</span></td>
                  <td><b>{money(o.total)}</b></td>
                  <td>{money(o.paid)}</td>
                  <td><b style={{ color: o.total - o.paid > 0 ? '#dc2626' : '#16a34a' }}>{money(o.total - o.paid)}</b></td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={7}><EmptyState title="Sin pedidos aún" text="Cuando registres un pedido en una lavandería, aparecerá aquí." /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </>;
}
