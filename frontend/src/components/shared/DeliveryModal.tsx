import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/api';
import { Modal } from '../ui';
import type { Order } from '../../types';

export function DeliveryModal({ order, close, onComplete }: {
  order: Order;
  close: () => void;
  onComplete: () => Promise<void>;
}) {
  const [receivedByName, setReceivedByName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(`/orders/${order.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ receivedByName: receivedByName.trim() })
      });
      await onComplete();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la entrega.');
    } finally {
      setSaving(false);
    }
  };

  return <Modal title={`Confirmar entrega · ${order.orderCode}`} close={close}>
    <form className="form-grid" onSubmit={submit}>
      <p className="full-field">Cliente: <b>{order.customerName}</b></p>
      <label className="full-field">Nombre de quien recibe
        <input required maxLength={120} value={receivedByName} onChange={(e) => setReceivedByName(e.target.value)} />
      </label>
      {error && <div className="form-error full-field">{error}</div>}
      <div className="modal-actions full-field">
        <button type="button" className="secondary-button" onClick={close}>Cancelar</button>
        <button className="primary-button" disabled={saving}>{saving ? 'Confirmando…' : 'Confirmar entrega'}</button>
      </div>
    </form>
  </Modal>;
}
