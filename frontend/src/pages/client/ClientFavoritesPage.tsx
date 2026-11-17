import { useCallback, useEffect, useState } from 'react';
import { Heart, Star } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, PageHeading } from '../../components/ui';

type Shop = { id: number; name: string; address: string; phone: string; openingHours: string; rating: number; servicesSummary: string; imageUrl?: string; detergents: string[]; distance: number | null };

export function ClientFavoritesPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setShops(await api<Shop[]>('/client/favorites'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los favoritos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    try {
      await api(`/client/favorites/${id}`, { method: 'DELETE' });
      setShops((s) => s.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar.');
    }
  };

  return <>
    <PageHeading eyebrow="FAVORITOS" title="Mis lavanderías favoritas" description="Las lavanderías que guardaste para acceder rápido." />
    {error && <ErrorBanner message={error} retry={load} />}
    {loading ? <div className="panel"><p className="muted">Cargando…</p></div> : (
      <div className="shops-grid-page">
        {shops.map((shop, i) => (
          <article className="shop-card-rich" key={shop.id} style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="shop-card-image" style={{ backgroundImage: `url(${shop.imageUrl})` }}>
              <div className="shop-card-rating"><Star size={13} fill="currentColor" /> {shop.rating}</div>
              <button className="shop-fav-btn active" onClick={() => remove(shop.id)} aria-label="Quitar de favoritos"><Heart size={16} fill="currentColor" /></button>
            </div>
            <div className="shop-card-body">
              <h3>{shop.name}</h3>
              <p className="muted small">{shop.address}</p>
              <p className="shop-services">{shop.servicesSummary}</p>
              <div className="shop-detergents">{shop.detergents.map((d) => <span key={d} className="detergent-chip">{d}</span>)}</div>
            </div>
          </article>
        ))}
        {!shops.length && <EmptyState title="Sin favoritos" text="Agrega lavanderías a favoritos desde la lista de cercanas." />}
      </div>
    )}
  </>;
}
