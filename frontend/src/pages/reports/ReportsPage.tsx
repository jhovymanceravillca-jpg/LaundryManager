import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, CircleDollarSign } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, PageHeading, Status } from '../../components/ui';
import { date, money } from '../../utils/format';

type SaleRow = { date: string; total: number; payments: number };
type StateRow = { status: string; count: number; total: number };

export function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([
        api<SaleRow[]>(`/reports/sales?from=${from}&to=${to}`),
        api<StateRow[]>('/reports/orders')
      ]);
      setSales(s);
      setStates(st);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const csv = ['Fecha,Ingresos,Pagos', ...sales.map((r) => `${r.date},${r.total},${r.payments}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-ventas.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const total = useMemo(() => sales.reduce((sum, row) => sum + Number(row.total), 0), [sales]);

  return <>
    <PageHeading eyebrow="ANÁLISIS" title="Reportes" description="Ingresos cobrados y distribución de pedidos." action={<button className="secondary-button" onClick={exportCsv}>Exportar CSV <ArrowDownLeft size={15} /></button>} />
    <div className="report-filters">
      <label>Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
      <label>Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      <button className="primary-button" onClick={load}>Aplicar filtros</button>
    </div>
    {error && <ErrorBanner message={error} retry={load} />}
    <div className="report-grid">
      <div className="panel report-panel">
        <div className="panel-heading"><div><h2>Ingresos cobrados</h2><p>Pagos recibidos en el periodo seleccionado</p></div><span className="stat-icon green"><CircleDollarSign size={19} /></span></div>
        <div className="report-total">{money(total)}</div>
        <div className="table-scroll"><table><thead><tr><th>FECHA</th><th>PAGOS</th><th>INGRESOS</th></tr></thead><tbody>
          {sales.map((row) => <tr key={row.date}><td>{date(row.date)}</td><td>{row.payments}</td><td>{money(row.total)}</td></tr>)}
          {!sales.length && <tr><td colSpan={3}><EmptyState title="Sin ingresos en el periodo" text="Prueba con otro rango de fechas." /></td></tr>}
        </tbody></table></div>
      </div>
      <div className="panel report-panel">
        <div className="panel-heading"><div><h2>Pedidos por estado</h2><p>Totales registrados</p></div></div>
        {states.map((row) => <div className="report-state" key={row.status}><Status status={row.status} /><b>{row.count}</b><span>{money(row.total)}</span></div>)}
        {!states.length && <EmptyState title="Sin pedidos" text="La distribución aparecerá cuando existan pedidos." />}
      </div>
    </div>
  </>;
}
