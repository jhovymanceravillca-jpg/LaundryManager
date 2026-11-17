import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, ClipboardList, Clock3, Droplets, Plus, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { useGoTo } from '../../hooks/useGoTo';
import { ErrorBanner, OrderTable } from '../../components/ui';
import { date, money } from '../../utils/format';
import type { Summary } from '../../types';

export function DashboardPage() {
  const goTo = useGoTo();
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
      setSummary(overview);
      setRevenue(sales);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = [
    { label: 'Pedidos de hoy', value: summary?.orderCount ?? 0, icon: ClipboardList, color: 'blue', note: 'Pedidos recibidos hoy' },
    { label: 'En proceso', value: summary?.processingCount ?? 0, icon: Droplets, color: 'purple', note: 'En limpieza ahora' },
    { label: 'Listos para entregar', value: summary?.readyCount ?? 0, icon: Check, color: 'green', note: 'Esperando al cliente' },
    { label: 'Saldo pendiente', value: money(summary?.balance ?? 0), icon: Clock3, color: 'orange', note: 'Por cobrar' }
  ];

  return <>
    <div className="welcome-row">
      <div><div className="eyebrow">RESUMEN GENERAL</div><h1>¡Buen día! <span className="wave">✦</span></h1><p className="muted">Aquí tienes el resumen de tu lavandería.</p></div>
      <button className="primary-button" onClick={() => goTo('Pedidos')}><Plus size={17} /> Nuevo pedido</button>
    </div>
    {error && <ErrorBanner message={error} retry={load} />}
    <section className="stats-grid">
      {stats.map((s) => <article className="stat-card" key={s.label}>
        <div className="stat-top"><span>{s.label}</span><span className={`stat-icon ${s.color}`}><s.icon size={18} /></span></div>
        <div className="stat-value">{summary ? s.value : '—'}</div>
        <div className="stat-note">{s.note}</div>
      </article>)}
    </section>
    <section className="dashboard-grid">
      <div className="panel orders-panel">
        <div className="panel-heading"><div><h2>Pedidos recientes</h2><p>Últimos pedidos recibidos</p></div><button className="text-button" onClick={() => goTo('Pedidos')}>Ver todos <ArrowUpRight size={15} /></button></div>
        <OrderTable orders={summary?.recent ?? []} compact />
      </div>
      <div className="right-stack">
        <div className="panel collection-panel">
          <div className="panel-heading"><div><h2>Ingresos cobrados</h2><p>Últimos 30 días</p></div><span className="stat-icon green"><ArrowDownLeft size={17} /></span></div>
          <div className="income-total">{money(summary?.collected ?? 0)}</div>
          <div className="income-caption"><span className="dot green-dot" /> Pagos registrados</div>
          <div className="mini-chart" aria-label="Ingresos por día">
            {revenue.length ? revenue.slice(-12).map((row) => {
              const max = Math.max(...revenue.map((item) => Number(item.total)), 1);
              return <i key={row.date} title={`${date(row.date)}: ${money(row.total)}`} style={{ height: `${Math.max(8, Number(row.total) / max * 100)}%` }} />;
            }) : <span className="chart-empty">Sin ingresos en el periodo</span>}
          </div>
          <div className="chart-labels"><span>12 días</span><span>Hoy</span></div>
        </div>
        <div className="panel status-panel">
          <div className="panel-heading"><div><h2>Estado de pedidos</h2><p>Pedidos del día</p></div></div>
          <div className="status-row"><span><i className="status-dot blue-dot" /> Pendientes</span><b>{summary?.pendingCount ?? '—'}</b></div>
          <div className="status-row"><span><i className="status-dot purple-dot" /> En proceso</span><b>{summary?.processingCount ?? '—'}</b></div>
          <div className="status-row"><span><i className="status-dot green-dot" /> Terminados</span><b>{summary?.readyCount ?? '—'}</b></div>
          <div className="status-row"><span><i className="status-dot gray-dot" /> Entregados</span><b>{summary?.deliveredCount ?? '—'}</b></div>
        </div>
      </div>
    </section>
    <section className="bottom-callout">
      <span className="callout-icon"><Sparkles size={18} /></span>
      <span><b>Todo listo para un nuevo día</b><small>Registra un pedido y mantén tu operación al día.</small></span>
      <button className="secondary-button" onClick={() => goTo('Pedidos')}>Crear pedido <ArrowUpRight size={15} /></button>
    </section>
  </>;
}
