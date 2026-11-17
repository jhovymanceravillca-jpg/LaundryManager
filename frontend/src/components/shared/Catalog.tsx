import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Settings, Shirt, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, Modal, PageHeading } from '../ui';
import { money } from '../../utils/format';
import type { Service } from '../../types';

type CatalogEntry = { id: number; name: string; description?: string; unitType?: Service['unitType']; basePrice?: number };

export function Catalog({ kind, title, isAdmin }: { kind: 'garments' | 'services'; title: string; isAdmin: boolean }) {
  const [rows, setRows] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<CatalogEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api<CatalogEntry[]>(`/${kind}`).then(setRows).catch((e) => setError(e.message)), [kind]);
  useEffect(() => { load(); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError('');
    const body = kind === 'services'
      ? { name: editor.name, description: editor.description, unitType: editor.unitType, basePrice: Number(editor.basePrice) }
      : { name: editor.name, description: editor.description };
    try {
      await api(`/${kind}${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el elemento.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <PageHeading eyebrow="CATÁLOGO" title={title} description="Los precios y tipos activos se utilizan para calcular nuevos pedidos." action={isAdmin ? <button className="primary-button" onClick={() => setEditor({ id: 0, name: '', description: '', unitType: 'PRENDA', basePrice: 0 })}><Plus size={17} /> Agregar</button> : undefined} />
    <div className="panel data-panel">
      <div className="table-toolbar"><div><h2>{kind === 'services' ? 'Servicios disponibles' : 'Tipos de prendas'}</h2><p>Datos consultados desde la base de datos</p></div></div>
      {error && <ErrorBanner message={error} retry={load} />}
      <div className="catalog-grid">
        {rows.map((row) => <article className="catalog-card" key={row.id}>
          <span className={`catalog-icon ${kind}`}>{kind === 'services' ? <Sparkles size={19} /> : <Shirt size={19} />}</span>
          <div><b>{row.name}</b><small>{row.description || (kind === 'services' ? `Cobro por ${row.unitType === 'KILOGRAMO' ? 'kilogramo' : row.unitType === 'FIJO' ? 'servicio fijo' : 'prenda'}` : 'Prenda')}</small></div>
          {kind === 'services' && <strong>{money(row.basePrice ?? 0)}</strong>}
          {isAdmin && <button className="icon-button" aria-label={`Editar ${row.name}`} onClick={() => setEditor({ ...row })}><Settings size={15} /></button>}
        </article>)}
        {!rows.length && <EmptyState title="No hay elementos en el catálogo" text="Los elementos activos aparecerán aquí." />}
      </div>
    </div>
    {editor && <Modal title={`${editor.id ? 'Editar' : 'Agregar'} ${kind === 'services' ? 'servicio' : 'tipo de prenda'}`} close={() => setEditor(null)}>
      <form className="form-grid" onSubmit={save}>
        <label className="full-field">Nombre<input required maxLength={100} value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} /></label>
        <label className="full-field">Descripción<input maxLength={255} value={editor.description ?? ''} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></label>
        {kind === 'services' && <>
          <label>Tipo de cobro<select value={editor.unitType} onChange={(e) => setEditor({ ...editor, unitType: e.target.value as Service['unitType'] })}><option value="PRENDA">Por prenda</option><option value="KILOGRAMO">Por kilogramo</option><option value="FIJO">Servicio fijo</option></select></label>
          <label>Precio (Bs)<input type="number" min="0" step="0.01" required value={editor.basePrice} onChange={(e) => setEditor({ ...editor, basePrice: Number(e.target.value) })} /></label>
        </>}
        {error && <div className="form-error full-field">{error}</div>}
        <div className="modal-actions full-field">
          <button type="button" className="secondary-button" onClick={() => setEditor(null)}>Cancelar</button>
          <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>}
  </>;
}
