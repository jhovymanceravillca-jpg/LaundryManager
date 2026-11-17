import { useEffect } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowUpRight, Droplets, X } from 'lucide-react';
import { date, money } from '../../utils/format';
import type { Order } from '../../types';

export function Status({ status }: { status: string }) {
  const cls: Record<string, string> = {
    RECIBIDO: 'status-blue',
    EN_PROCESO: 'status-purple',
    TERMINADO: 'status-green',
    ENTREGADO: 'status-gray',
    CANCELADO: 'status-red'
  };
  const label: Record<string, string> = {
    RECIBIDO: 'Recibido',
    EN_PROCESO: 'En proceso',
    TERMINADO: 'Terminado',
    ENTREGADO: 'Entregado',
    CANCELADO: 'Cancelado'
  };
  return <span className={`badge ${cls[status] ?? 'status-gray'}`}><i />{label[status] ?? status}</span>;
}

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <div className="welcome-row page-heading">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="muted">{description}</p></div>
    {action}
  </div>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Droplets size={20} /></span><b>{title}</b><p>{text}</p></div>;
}

export function ErrorBanner({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-banner error-row"><span>{message}</span><button onClick={retry}>Reintentar</button></div>;
}

export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <section className="modal">
      <div className="modal-heading">
        <div><span className="eyebrow">LAVANDERÍA</span><h2>{title}</h2></div>
        <button className="icon-button" aria-label="Cerrar" onClick={close}><X size={19} /></button>
      </div>
      {children}
    </section>
  </div>;
}

export function Pagination({ page, pageSize, total, onChange }: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  return <div className="table-toolbar">
    <small>Mostrando {firstItem}–{lastItem} de {total}</small>
    <div className="row-actions">
      <button className="small-action" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
      <span>Página {page} de {pageCount}</span>
      <button className="small-action" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Siguiente</button>
    </div>
  </div>;
}

export function OrderTable({ orders, compact = false, onAction, onView }: {
  orders: Order[];
  compact?: boolean;
  onAction?: (order: Order, action: 'advance' | 'payment') => void;
  onView?: (order: Order) => void;
}) {
  return <table>
    <thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>ENTREGA</th><th>ESTADO</th><th>TOTAL</th>{!compact && <th>ACCIÓN</th>}</tr></thead>
    <tbody>
      {orders.map((o) => <tr key={o.id}>
        <td><button className="link-button order-code" onClick={() => onView?.(o)}>{o.orderCode}</button><small className="cell-subtitle">#{o.id}</small></td>
        <td>{o.customerName}</td>
        <td>{date(o.expectedDeliveryAt)}</td>
        <td><Status status={o.status} /></td>
        <td><b>{money(o.total)}</b><small className="cell-subtitle">Pagado {money(o.paid)}</small></td>
        {!compact && <td><div className="row-actions">
          {!['ENTREGADO', 'CANCELADO'].includes(o.status) && <button className="small-action" onClick={() => onAction?.(o, 'advance')}>
            {o.status === 'RECIBIDO' ? 'Iniciar' : o.status === 'EN_PROCESO' ? 'Terminar' : 'Entregar'} <ArrowUpRight size={13} />
          </button>}
          {!['ENTREGADO', 'CANCELADO'].includes(o.status) && Number(o.paid) < Number(o.total) && <button className="small-action payment-action" onClick={() => onAction?.(o, 'payment')}>Cobrar</button>}
        </div></td>}
      </tr>)}
      {!orders.length && <tr><td colSpan={compact ? 5 : 6}><EmptyState title="No hay pedidos para mostrar" text="Cuando registres pedidos, aparecerán aquí." /></td></tr>}
    </tbody>
  </table>;
}

export function PrintableReceipt({ order, onPrinted }: { order: Order; onPrinted: () => void }) {
  useEffect(() => {
    const onAfterPrint = () => onPrinted();
    window.addEventListener('afterprint', onAfterPrint);
    const timer = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [onPrinted]);
  return <article className="print-only">
    <header><h1>LaundryManager</h1><p>Comprobante de servicio de lavandería</p></header>
    <div className="receipt-meta">
      <b>Pedido: {order.orderCode}</b>
      <span>Fecha: {date(order.receivedAt ?? new Date().toISOString())}</span>
      <span>Cliente: {order.customerName}</span>
      <span>Entrega estimada: {date(order.expectedDeliveryAt)}</span>
    </div>
    <table>
      <thead><tr><th>PRENDA Y SERVICIO</th><th>CANTIDAD / PESO</th><th>IMPORTE</th></tr></thead>
      <tbody>
        {order.items?.map((item, index) => <tr key={index}>
          <td>{item.garmentName} · {item.serviceName}</td>
          <td>{item.quantity}{item.weightKg ? ` · ${item.weightKg} kg` : ''}</td>
          <td>{money(Number(item.subtotal))}</td>
        </tr>)}
      </tbody>
    </table>
    <div className="receipt-totals">
      <span>Subtotal <b>{money(Number(order.subtotal))}</b></span>
      {Number(order.discount) > 0 && <span>Descuento <b>-{money(Number(order.discount))}</b></span>}
      <span>Total <b>{money(Number(order.total))}</b></span>
      <span>Pagado <b>{money(Number(order.paid))}</b></span>
      <span>Saldo pendiente <b>{money(Number(order.total) - Number(order.paid))}</b></span>
    </div>
    {order.notes && <p>Notas: {order.notes}</p>}
    <footer>Gracias por confiar en nosotros.</footer>
  </article>;
}

export type { FormEvent };
