import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, Modal, PageHeading, Pagination, Status } from '../../components/ui';
import { date, money } from '../../utils/format';
import { PAGE_SIZE, type Customer, type Order, type PageResult } from '../../types';

export function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [history, setHistory] = useState<{ customer: Customer; orders: Order[] } | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '' });

  const load = useCallback(async () => {
    try {
      const result = await api<PageResult<Customer>>(`/customers?search=${encodeURIComponent(search)}&page=${page}&pageSize=${PAGE_SIZE}`);
      setRows(result.items);
      setTotal(result.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(editing ? `/customers/${editing.id}` : '/customers', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      });
      setOpen(false);
      setEditing(null);
      setForm({ firstName: '', lastName: '', phone: '', email: '', address: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email ?? '',
      address: customer.address ?? ''
    });
    setOpen(true);
  };

  const showHistory = async (customer: Customer) => {
    try {
      setHistory(await api(`/customers/${customer.id}/history`));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    }
  };

  return <>
    <PageHeading eyebrow="RELACIONES" title="Clientes" description="Administra la información de tus clientes." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nuevo cliente</button>} />
    <div className="panel data-panel">
      <div className="table-toolbar"><div><h2>Todos los clientes</h2><p>{total} clientes registrados</p></div>
        <label className="search-box"><Search size={16} /><input placeholder="Buscar cliente..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
      </div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>TELÉFONO</th><th>CORREO</th><th>ACCIONES</th></tr></thead><tbody>
        {rows.map((c) => <tr key={c.id}>
          <td><div className="customer-cell"><span className="customer-avatar">{c.firstName[0]}{c.lastName[0]}</span><b>{c.firstName} {c.lastName}</b></div></td>
          <td>{c.phone}</td><td>{c.email || '—'}</td>
          <td><div className="row-actions"><button className="small-action" onClick={() => showHistory(c)}>Historial</button><button className="small-action" onClick={() => edit(c)}>Editar</button></div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan={4}><EmptyState title="Aún no hay clientes" text="Registra tu primer cliente para comenzar a crear pedidos." /></td></tr>}
      </tbody></table></div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </div>
    {open && <Modal title={editing ? 'Editar cliente' : 'Registrar cliente'} close={() => { setOpen(false); setEditing(null); }}>
      <form className="form-grid" onSubmit={save}>
        <label>Nombre<input required maxLength={80} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
        <label>Apellido<input required maxLength={80} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
        <label>Teléfono<input required maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Correo electrónico<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="full-field">Dirección<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        {error && <div className="form-error full-field">{error}</div>}
        <div className="modal-actions full-field">
          <button type="button" className="secondary-button" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar cliente'}</button>
        </div>
      </form>
    </Modal>}
    {history && <Modal title={`Historial de ${history.customer.firstName} ${history.customer.lastName}`} close={() => setHistory(null)}>
      <div className="history-content">
        <p>{history.customer.phone} · {history.customer.email || 'Sin correo'}</p>
        {history.orders.length ? history.orders.map((order) => <div className="history-order" key={order.id}>
          <div><b>{order.orderCode}</b><small>{date(order.receivedAt ?? '')}</small></div>
          <Status status={order.status} /><strong>{money(order.total)}</strong>
        </div>) : <EmptyState title="Sin pedidos previos" text="El historial aparecerá cuando se creen pedidos para este cliente." />}
      </div>
    </Modal>}
  </>;
}
