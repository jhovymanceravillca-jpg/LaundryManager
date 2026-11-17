import { useCallback, useEffect, useState } from 'react';
import { MapPin, Package, Receipt, Sparkles, Truck, Zap } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, PageHeading } from '../../components/ui';
import { date, money } from '../../utils/format';
import { useNavigate } from 'react-router-dom';

type Summary = { customerId: number | null; orderCount: number; totalSpent: number; averageOrderValue: number; lastOrderAt: string | null; pendingCount: number; deliveredCount: number };
type Shop = { id: number; name: string; address: string; phone: string; openingHours: string; rating: number; servicesSummary: string; distance: number | null };
type Order = { id: number; orderCode: string; status: string; total: number; expectedDeliveryAt: string; receivedAt: string; paid: number };

export function ClientDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadShops = useCallback(async (lat?: number, lng?: number) => {
    try {
      const qs = lat !== undefined && lng !== undefined ? `?lat=${lat}&lng=${lng}` : '';
      setShops(await api<Shop[]>(`/client/shops${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las lavanderías.');
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([
        api<Summary>('/client/summary'),
        api<Order[]>('/client/orders')
      ]);
      setSummary(s);
      setOrders(o);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadShops(coords?.lat, coords?.lng); }, [coords, loadShops]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { setError('No se pudo obtener tu ubicación. Mostrando todas las lavanderías.'); setLocating(false); },
      { timeout: 8000 }
    );
  };

  const stats = [
    { label: 'Pedidos activos', value: summary?.pendingCount ?? 0, icon: Package, color: 'blue', note: 'En proceso o listos' },
    { label: 'Entregados', value: summary?.deliveredCount ?? 0, icon: Truck, color: 'green', note: 'Completados' },
    { label: 'Total pedidos', value: summary?.orderCount ?? 0, icon: Receipt, color: 'purple', note: 'Histórico' },
    { label: 'Total gastado', value: money(summary?.totalSpent ?? 0), icon: Zap, color: 'orange', note: 'En servicios' },
    { label: 'Ticket promedio', value: money(summary?.averageOrderValue ?? 0), icon: Receipt, color: 'blue', note: 'Por pedido' },
    { label: 'Último pedido', value: summary?.lastOrderAt ? date(summary.lastOrderAt) : '—', icon: Package, color: 'green', note: 'Fecha' }
  ];

  return <>
    <PageHeading eyebrow="BIENVENIDO" title="Tu panel de cliente" description="Encuentra la mejor lavandería cerca de ti y sigue tus pedidos." />

    {error && <ErrorBanner message={error} retry={load} />}

    <section className="stats-grid">
      {stats.map((s) => <article className="stat-card" key={s.label}>
        <div className="stat-top"><span>{s.label}</span><span className={`stat-icon ${s.color}`}><s.icon size={18} /></span></div>
        <div className="stat-value">{summary ? s.value : '—'}</div>
        <div className="stat-note">{s.note}</div>
      </article>)}
    </section>

    <section className="client-dashboard-grid">
      {/* Lavanderías cercanas */}
      <div className="panel orders-panel">
        <div className="panel-heading">
          <div><h2>Lavanderías cercanas</h2><p>Ordenadas por distancia a tu ubicación</p></div>
          <button className="primary-button" onClick={locate} disabled={locating}>
            <MapPin size={15} /> {locating ? 'Localizando…' : 'Usar mi ubicación'}
          </button>
        </div>
        <div className="shops-grid">
          {shops.map((shop, i) => (
            <article className="shop-card" key={shop.id} style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="shop-card-top">
                <div className="shop-icon"><DropletsIcon /></div>
                <div className="shop-rating">★ {shop.rating}</div>
              </div>
              <h3>{shop.name}</h3>
              <p className="muted small">{shop.address}</p>
              <p className="shop-services">{shop.servicesSummary}</p>
              <div className="shop-meta">
                <span><MapPin size={13} /> {shop.distance !== null ? `${shop.distance} km` : '—'}</span>
                <span>🕒 {shop.openingHours}</span>
              </div>
              {shop.phone && <a className="shop-phone" href={`tel:${shop.phone}`}>{shop.phone}</a>}
            </article>
          ))}
          {!shops.length && <EmptyState title="No hay lavanderías disponibles" text="Intenta de nuevo más tarde." />}
        </div>
      </div>

      {/* Mis pedidos recientes */}
      <div className="right-stack">
        <div className="panel">
          <div className="panel-heading"><div><h2>Distribución de estados</h2><p>Tus pedidos por estado</p></div></div>
          <div className="client-chart">
            {(() => {
              const counts: Record<string, number> = {};
              orders.forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
              const entries = Object.entries(counts);
              const max = Math.max(...entries.map(([, v]) => v), 1);
              const colors: Record<string, string> = { RECIBIDO: '#2863e9', EN_PROCESO: '#7c3aed', TERMINADO: '#16a34a', ENTREGADO: '#94a3b8', CANCELADO: '#dc2626' };
              const labels: Record<string, string> = { RECIBIDO: 'Recibido', EN_PROCESO: 'En proceso', TERMINADO: 'Terminado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' };
              if (!entries.length) return <EmptyState title="Sin datos" text="Aún no tienes pedidos." />;
              return entries.map(([k, v]) => (
                <div className="client-chart-row" key={k}>
                  <span className="client-chart-label">{labels[k] ?? k}</span>
                  <div className="client-chart-bar-wrap">
                    <div className="client-chart-bar" style={{ width: `${(v / max) * 100}%`, background: colors[k] ?? '#2863e9' }} />
                  </div>
                  <b>{v}</b>
                </div>
              ));
            })()}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading"><div><h2>Gasto por mes</h2><p>Últimos 6 meses</p></div></div>
          <div className="client-bar-chart">
            {(() => {
              const now = new Date();
              const months: { key: string; label: string; total: number }[] = [];
              for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('es-BO', { month: 'short' }), total: 0 });
              }
              orders.forEach((o) => {
                const d = new Date(o.receivedAt);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const m = months.find((x) => x.key === key);
                if (m) m.total += Number(o.total);
              });
              const max = Math.max(...months.map((m) => m.total), 1);
              return months.map((m, i) => (
                <div className="client-bar-col" key={m.key}>
                  <div className="client-bar" style={{ height: `${Math.max(4, (m.total / max) * 100)}%`, animationDelay: `${i * 0.08}s` }} title={money(m.total)} />
                  <small>{m.label}</small>
                </div>
              ));
            })()}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading"><div><h2>Mis pedidos recientes</h2><p>Últimos 5</p></div>
            <button className="text-button" onClick={() => navigate('/client/orders')}>Ver todos →</button>
          </div>
          {orders.slice(0, 5).map((o) => (
            <div className="client-order-row" key={o.id}>
              <div>
                <b>{o.orderCode}</b>
                <small>{date(o.receivedAt)}</small>
              </div>
              <span className={`badge ${statusClass(o.status)}`}>{statusLabel(o.status)}</span>
              <b>{money(o.total)}</b>
            </div>
          ))}
          {!orders.length && <EmptyState title="Sin pedidos aún" text="Cuando registres un pedido, aparecerá aquí." />}
        </div>

        <div className="panel bottom-callout">
          <span className="callout-icon"><Sparkles size={18} /></span>
          <span><b>¿Listo para lavar?</b><small>Encuentra la lavandería más cercana y agenda tu servicio.</small></span>
          <button className="secondary-button" onClick={() => navigate('/client/shops')}>Buscar lavanderías →</button>
        </div>
      </div>
    </section>
  </>;
}

function statusClass(s: string) {
  return ({ RECIBIDO: 'status-blue', EN_PROCESO: 'status-purple', TERMINADO: 'status-green', ENTREGADO: 'status-gray', CANCELADO: 'status-red' } as Record<string, string>)[s] ?? 'status-gray';
}
function statusLabel(s: string) {
  return ({ RECIBIDO: 'Recibido', EN_PROCESO: 'En proceso', TERMINADO: 'Terminado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' } as Record<string, string>)[s] ?? s;
}
function DropletsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>;
}
