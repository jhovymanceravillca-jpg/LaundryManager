import { useCallback, useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, PageHeading, Pagination } from '../../components/ui';
import { DeliveryModal } from '../../components/shared/DeliveryModal';
import { date, money } from '../../utils/format';
import { PAGE_SIZE, type Order, type PageResult } from '../../types';

type DeliveryRow = { id: number; orderCode: string; customerName: string; receivedByName: string; deliveredAt: string };

export function DeliveriesPage() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [readyPage, setReadyPage] = useState(1);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [readyTotal, setReadyTotal] = useState(0);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const [delivered, ready] = await Promise.all([
        api<PageResult<DeliveryRow>>(`/deliveries?page=${deliveryPage}&pageSize=${PAGE_SIZE}`),
        api<PageResult<Order>>(`/orders?status=TERMINADO&search=${encodeURIComponent(search)}&page=${readyPage}&pageSize=${PAGE_SIZE}`)
      ]);
      setRows(delivered.items);
      setDeliveryTotal(delivered.total);
      setReadyOrders(ready.items);
      setReadyTotal(ready.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las entregas.');
    }
  }, [deliveryPage, readyPage, search]);

  useEffect(() => { load(); }, [load]);

  return <>
    <PageHeading eyebrow="GESTIÓN" title="Entregas" description="Busca pedidos terminados por código o cliente y confirma la entrega." />
    <div className="panel data-panel">
      <div className="table-toolbar"><div><h2>Listos para entregar</h2><p>{readyTotal} pedidos pendientes de entrega</p></div>
        <label className="search-box"><Search size={16} /><input placeholder="Código de pedido o cliente..." value={search} onChange={(e) => { setSearch(e.target.value); setReadyPage(1); }} /></label>
      </div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><table><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>FECHA LÍMITE</th><th>TOTAL</th><th>ENTREGA</th></tr></thead><tbody>
        {readyOrders.map((order) => <tr key={order.id}>
          <td><b className="order-code">{order.orderCode}</b></td><td>{order.customerName}</td><td>{date(order.expectedDeliveryAt)}</td><td><b>{money(Number(order.total))}</b></td>
          <td><button className="small-action" onClick={() => setDeliveryOrder(order)}>Confirmar entrega <Check size={14} /></button></td>
        </tr>)}
        {!readyOrders.length && <tr><td colSpan={5}><EmptyState title="No se encontraron pedidos listos" text="Ajusta la búsqueda o termina un pedido para entregarlo." /></td></tr>}
      </tbody></table></div>
      <Pagination page={readyPage} pageSize={PAGE_SIZE} total={readyTotal} onChange={setReadyPage} />
    </div>
    <div className="panel data-panel delivery-history">
      <div className="table-toolbar"><div><h2>Entregas realizadas</h2><p>{deliveryTotal} entregas</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>RECIBIDO POR</th><th>FECHA</th></tr></thead><tbody>
        {rows.map((d) => <tr key={d.id}><td><b className="order-code">{d.orderCode}</b></td><td>{d.customerName}</td><td>{d.receivedByName}</td><td>{date(d.deliveredAt)}</td></tr>)}
        {!rows.length && <tr><td colSpan={4}><EmptyState title="Aún no hay entregas" text="Las entregas confirmadas aparecerán aquí." /></td></tr>}
      </tbody></table></div>
      <Pagination page={deliveryPage} pageSize={PAGE_SIZE} total={deliveryTotal} onChange={setDeliveryPage} />
    </div>
    {deliveryOrder && <DeliveryModal order={deliveryOrder} close={() => setDeliveryOrder(null)} onComplete={load} />}
  </>;
}
