import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, Modal, PageHeading, Pagination } from '../../components/ui';
import { date, money } from '../../utils/format';
import { PAGE_SIZE, type PageResult, type Payment } from '../../types';

type PaymentRow = Payment & { orderCode: string; customerName: string };

export function PaymentsPage({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [voidTarget, setVoidTarget] = useState<PaymentRow | null>(null);
  const [voidError, setVoidError] = useState('');
  const [voiding, setVoiding] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<PageResult<PaymentRow>>(`/payments?page=${page}&pageSize=${PAGE_SIZE}`);
      setRows(result.items);
      setTotal(result.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos.');
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const voidPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    setVoiding(true);
    setVoidError('');
    try {
      await api(`/payments/${voidTarget.id}/void`, { method: 'PATCH' });
      setVoidTarget(null);
      await load();
      setError('');
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'No se pudo anular el pago.');
    } finally {
      setVoiding(false);
    }
  };

  return <>
    <PageHeading eyebrow="GESTIÓN" title="Pagos" description="Consulta los pagos y cobros registrados." />
    <div className="panel data-panel">
      <div className="table-toolbar"><div><h2>Últimos pagos</h2><p>{total} movimientos</p></div></div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><table><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>MÉTODO</th><th>FECHA</th><th>MONTO</th><th>ESTADO</th></tr></thead><tbody>
        {rows.map((p) => <tr key={p.id}>
          <td><b className="order-code">{p.orderCode}</b></td><td>{p.customerName}</td><td>{p.paymentMethod}</td><td>{date(p.paidAt)}</td><td><b>{money(p.amount)}</b></td>
          <td>{p.voidedAt ? <span className="badge status-red">Anulado</span> : <div className="row-actions"><span className="badge status-green">Vigente</span>{isAdmin && <button className="small-action payment-action" onClick={() => { setVoidError(''); setVoidTarget(p); }}>Anular</button>}</div>}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan={6}><EmptyState title="Aún no hay pagos" text="Los pagos registrados desde un pedido aparecerán aquí." /></td></tr>}
      </tbody></table></div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </div>
    {voidTarget && <Modal title="Anular pago" close={() => setVoidTarget(null)}>
      <form className="form-grid" onSubmit={voidPayment}>
        <p className="full-field">Se anulará el pago de <b>{money(voidTarget.amount)}</b>. El registro se conservará en el historial y dejará de contar en el saldo cobrado.</p>
        {voidError && <div className="form-error full-field">{voidError}</div>}
        <div className="modal-actions full-field">
          <button type="button" className="secondary-button" onClick={() => setVoidTarget(null)}>Cancelar</button>
          <button className="primary-button" disabled={voiding}>{voiding ? 'Anulando…' : 'Confirmar anulación'}</button>
        </div>
      </form>
    </Modal>}
  </>;
}
