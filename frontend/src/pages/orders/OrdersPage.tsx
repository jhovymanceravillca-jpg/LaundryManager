import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CircleDollarSign, Plus, Search, X } from 'lucide-react';
import { api } from '../../services/api';
import { ErrorBanner, Modal, OrderTable, PageHeading, Pagination, PrintableReceipt, Status } from '../../components/ui';
import { DeliveryModal } from '../../components/shared/DeliveryModal';
import { date, dateTimeLocalValue, money } from '../../utils/format';
import { PAGE_SIZE, type Customer, type Garment, type Order, type PageResult, type Service } from '../../types';

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [query, setQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', expectedDeliveryAt: '' });
  const [items, setItems] = useState([{ garmentTypeId: '', serviceId: '', quantity: '1', weightKg: '' }]);
  const [initialPayment, setInitialPayment] = useState({ amount: '', method: 'EFECTIVO' });
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'EFECTIVO', reference: '' });
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editDetails, setEditDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ expectedDeliveryAt: '', notes: '' });
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, s, g] = await Promise.all([
        api<PageResult<Order>>(`/orders?search=${encodeURIComponent(query)}&page=${page}&pageSize=${PAGE_SIZE}`),
        api<Service[]>('/services'),
        api<Garment[]>('/garments')
      ]);
      setOrders(o.items);
      setTotal(o.total);
      setServices(s);
      setGarments(g);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos.');
    }
  }, [page, query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    api<PageResult<Customer>>(`/customers?search=${encodeURIComponent(customerSearch)}&pageSize=200`)
      .then((result) => { if (active) setCustomers(result.items); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No se pudieron buscar clientes.'); });
    return () => { active = false; };
  }, [customerSearch]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const expected = new Date(form.expectedDeliveryAt);
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: Number(form.customerId),
          expectedDeliveryAt: expected.toISOString(),
          discount: 0,
          ...(Number(initialPayment.amount) > 0 ? { initialPayment: Number(initialPayment.amount), initialPaymentMethod: initialPayment.method } : {}),
          items: items.map((item) => ({
            garmentTypeId: Number(item.garmentTypeId),
            serviceId: Number(item.serviceId),
            quantity: Number(item.quantity),
            ...(services.find((service) => String(service.id) === item.serviceId)?.unitType === 'KILOGRAMO' ? { weightKg: Number(item.weightKg) } : {})
          }))
        })
      });
      setOpen(false);
      setForm({ customerId: '', expectedDeliveryAt: '' });
      setItems([{ garmentTypeId: '', serviceId: '', quantity: '1', weightKg: '' }]);
      setInitialPayment({ amount: '', method: 'EFECTIVO' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido.');
    } finally {
      setSaving(false);
    }
  };

  const advance = async (o: Order, actionType: 'advance' | 'payment') => {
    if (actionType === 'payment') {
      const balance = Number(o.total) - Number(o.paid);
      if (balance <= 0) { setError('Este pedido ya está pagado por completo.'); return; }
      setPaymentOrder(o);
      setPaymentForm({ amount: balance.toFixed(2), method: 'EFECTIVO', reference: '' });
      return;
    }
    const next: Record<string, string> = { RECIBIDO: 'EN_PROCESO', EN_PROCESO: 'TERMINADO' };
    if (next[o.status]) {
      try {
        await api(`/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next[o.status] }) });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
      }
    } else if (o.status === 'TERMINADO') {
      setDeliveryOrder(o);
    }
  };

  const showDetails = async (order: Order) => {
    try {
      const detail = await api<Order>(`/orders/${order.id}`);
      setDetailOrder(detail);
      setDetailsForm({ expectedDeliveryAt: dateTimeLocalValue(detail.expectedDeliveryAt), notes: detail.notes ?? '' });
      setEditDetails(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del pedido.');
    }
  };

  const savePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!paymentOrder) return;
    setSaving(true);
    setError('');
    try {
      await api(`/orders/${paymentOrder.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          paymentMethod: paymentForm.method,
          reference: paymentForm.reference || undefined
        })
      });
      setPaymentOrder(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!detailOrder) return;
    setSaving(true);
    setError('');
    try {
      await api(`/orders/${detailOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          expectedDeliveryAt: new Date(detailsForm.expectedDeliveryAt).toISOString(),
          notes: detailsForm.notes
        })
      });
      await load();
      const updated = await api<Order>(`/orders/${detailOrder.id}`);
      setDetailOrder(updated);
      setDetailsForm({ expectedDeliveryAt: dateTimeLocalValue(updated.expectedDeliveryAt), notes: updated.notes ?? '' });
      setEditDetails(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <PageHeading eyebrow="OPERACIONES" title="Pedidos" description="Controla el recorrido de cada pedido." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nuevo pedido</button>} />
    <div className="panel data-panel">
      <div className="table-toolbar"><div><h2>Todos los pedidos</h2><p>{total} pedidos</p></div>
        <label className="search-box"><Search size={16} /><input placeholder="Buscar por código o cliente..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} /></label>
      </div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><OrderTable orders={orders} onAction={advance} onView={showDetails} /></div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </div>

    {open && <Modal title="Crear pedido" close={() => setOpen(false)}>
      <form className="form-grid" onSubmit={create}>
        <label className="full-field">Buscar cliente<input value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setForm((current) => ({ ...current, customerId: '' })); }} placeholder="Nombre, apellido o teléfono" /></label>
        <label className="full-field">Cliente<select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Selecciona un cliente</option>{customers.map((c) => <option value={c.id} key={c.id}>{c.firstName} {c.lastName} · {c.phone}</option>)}</select>{!customers.length && <small className="field-note">No hay clientes que coincidan; registra uno desde Clientes.</small>}</label>
        <div className="order-items full-field">
          {items.map((item, index) => {
            const selectedService = services.find((service) => String(service.id) === item.serviceId);
            const setItem = (key: keyof typeof item, value: string) => setItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
            return <div className="order-item" key={index}>
              <div className="order-item-heading"><b>Prenda {index + 1}</b>{items.length > 1 && <button className="remove-item" type="button" onClick={() => setItems((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label="Quitar prenda"><X size={14} /></button>}</div>
              <label>Tipo de prenda<select required value={item.garmentTypeId} onChange={(e) => setItem('garmentTypeId', e.target.value)}><option value="">Seleccionar</option>{garments.map((g) => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
              <label>Servicio<select required value={item.serviceId} onChange={(e) => setItem('serviceId', e.target.value)}><option value="">Seleccionar</option>{services.map((s) => <option value={s.id} key={s.id}>{s.name} · {money(s.basePrice)}/{s.unitType === 'KILOGRAMO' ? 'kg' : s.unitType === 'FIJO' ? 'servicio' : 'prenda'}</option>)}</select></label>
              <label>Cantidad<input type="number" min="1" step="1" required value={item.quantity} onChange={(e) => setItem('quantity', e.target.value)} /></label>
              {selectedService?.unitType === 'KILOGRAMO' && <label>Peso (kg)<input type="number" min="0.01" step="0.01" required value={item.weightKg} onChange={(e) => setItem('weightKg', e.target.value)} /></label>}
            </div>;
          })}
          <button type="button" className="add-item-button" onClick={() => setItems((current) => [...current, { garmentTypeId: '', serviceId: '', quantity: '1', weightKg: '' }])}><Plus size={14} /> Añadir prenda o servicio</button>
        </div>
        <label className="full-field">Fecha estimada de entrega<input type="datetime-local" required value={form.expectedDeliveryAt} onChange={(e) => setForm({ ...form, expectedDeliveryAt: e.target.value })} /></label>
        <label>Pago inicial (Bs)<input type="number" min="0" step="0.01" value={initialPayment.amount} onChange={(e) => setInitialPayment({ ...initialPayment, amount: e.target.value })} /></label>
        <label>Método de pago<select value={initialPayment.method} onChange={(e) => setInitialPayment({ ...initialPayment, method: e.target.value })}><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option><option value="QR">QR</option></select></label>
        <div className="price-hint full-field"><CircleDollarSign size={17} /> El precio vigente se calcula en el servidor al guardar el pedido.</div>
        {error && <div className="form-error full-field">{error}</div>}
        <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving || !customers.length}>{saving ? 'Guardando…' : 'Crear pedido'}</button></div>
      </form>
    </Modal>}

    {paymentOrder && <Modal title={`Registrar pago · ${paymentOrder.orderCode}`} close={() => setPaymentOrder(null)}>
      <form className="form-grid" onSubmit={savePayment}>
        <div className="balance-callout full-field">Saldo pendiente: <b>{money(Number(paymentOrder.total) - Number(paymentOrder.paid))}</b></div>
        <label>Monto (Bs)<input type="number" min="0.01" max={(Number(paymentOrder.total) - Number(paymentOrder.paid)).toFixed(2)} step="0.01" required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></label>
        <label>Método<select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option><option value="QR">QR</option></select></label>
        <label className="full-field">Referencia (opcional)<input maxLength={120} value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></label>
        {error && <div className="form-error full-field">{error}</div>}
        <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setPaymentOrder(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Registrar pago'}</button></div>
      </form>
    </Modal>}

    {detailOrder && <Modal title={`Pedido ${detailOrder.orderCode}`} close={() => { setDetailOrder(null); setEditDetails(false); }}>
      <div className="order-detail">
        <div className="detail-summary">
          <div><span>CLIENTE</span><b>{detailOrder.customerName}</b></div>
          <div><span>ESTADO</span><Status status={detailOrder.status} /></div>
          <div><span>TOTAL</span><b>{money(Number(detailOrder.total))}</b></div>
          <div><span>SALDO</span><b>{money(Number(detailOrder.total) - Number(detailOrder.paid))}</b></div>
        </div>
        {editDetails ? <form className="form-grid details-edit" onSubmit={saveDetails}>
          <label className="full-field">Fecha estimada de entrega<input type="datetime-local" required value={detailsForm.expectedDeliveryAt} onChange={(e) => setDetailsForm({ ...detailsForm, expectedDeliveryAt: e.target.value })} /></label>
          <label className="full-field">Notas<input maxLength={1000} value={detailsForm.notes} onChange={(e) => setDetailsForm({ ...detailsForm, notes: e.target.value })} /></label>
          <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => setEditDetails(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </form> : <>
          <div className="detail-section"><h3>Prendas y servicios</h3>{detailOrder.items?.map((item, index) => <div className="detail-line" key={index}><span>{item.quantity} × {item.garmentName} · {item.serviceName}</span><b>{money(Number(item.subtotal))}</b></div>)}<div className="detail-line total-line"><span>Subtotal</span><b>{money(Number(detailOrder.subtotal))}</b></div>{Number(detailOrder.discount) > 0 && <div className="detail-line"><span>Descuento</span><b>-{money(Number(detailOrder.discount))}</b></div>}</div>
          <div className="detail-section"><h3>Pagos</h3>{detailOrder.payments?.length ? detailOrder.payments.map((payment) => <div className="detail-line" key={payment.id}><span>{payment.paymentMethod} · {date(payment.paidAt)}</span><b>{money(Number(payment.amount))}</b></div>) : <p className="muted">Sin pagos registrados.</p>}</div>
          <div className="detail-section"><h3>Historial de estado</h3>{detailOrder.history?.map((event, index) => <div className="detail-line" key={index}><span>{event.previousStatus ? `${event.previousStatus} → ` : ''}{event.newStatus}</span><small>{date(event.changedAt)}</small></div>)}</div>
          {detailOrder.notes && <p className="muted">Notas: {detailOrder.notes}</p>}
          <div className="modal-actions"><button className="secondary-button" onClick={() => setPrintOrder(detailOrder)}>Imprimir comprobante</button>{!['ENTREGADO', 'CANCELADO'].includes(detailOrder.status) && <button className="primary-button" onClick={() => setEditDetails(true)}>Editar pedido</button>}</div>
        </>}
      </div>
    </Modal>}

    {printOrder && <PrintableReceipt order={printOrder} onPrinted={() => setPrintOrder(null)} />}
    {deliveryOrder && <DeliveryModal order={deliveryOrder} close={() => setDeliveryOrder(null)} onComplete={load} />}
  </>;
}
