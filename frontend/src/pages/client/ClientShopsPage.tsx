import { useCallback, useEffect, useState } from 'react';
import { MapPin, Star, DollarSign, Heart } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState, ErrorBanner, Modal, PageHeading } from '../../components/ui';
import { date, money } from '../../utils/format';

type Review = { id: number; author: string; rating: number; comment: string | null; createdAt: string };
type Shop = {
  id: number; name: string; address: string; phone: string; latitude: number; longitude: number;
  openingHours: string; rating: number; servicesSummary: string; imageUrl?: string;
  detergents: string[]; reviews: Review[]; distance: number | null;
};

export function ClientShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await api<Shop[]>('/client/favorites');
      setFavorites(new Set(favs.map((f) => f.id)));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const toggleFavorite = async (id: number) => {
    try {
      if (favorites.has(id)) {
        await api(`/client/favorites/${id}`, { method: 'DELETE' });
        setFavorites((s) => { const n = new Set(s); n.delete(id); return n; });
      } else {
        await api(`/client/favorites/${id}`, { method: 'POST' });
        setFavorites((s) => new Set(s).add(id));
      }
    } catch { /* ignore */ }
  };

  const load = useCallback(async (lat?: number, lng?: number) => {
    setLoading(true);
    setError('');
    try {
      const qs = lat !== undefined && lng !== undefined ? `?lat=${lat}&lng=${lng}` : '';
      setShops(await api<Shop[]>(`/client/shops${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las lavanderías.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(coords?.lat, coords?.lng); }, [coords, load]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { setError('No se pudo obtener tu ubicación.'); setLocating(false); },
      { timeout: 8000 }
    );
  };

  const openDetail = async (shop: Shop) => {
    try {
      const detail = await api<Shop>(`/client/shops/${shop.id}`);
      setSelected(detail);
    } catch {
      setSelected(shop);
    }
  };

  return <>
    <PageHeading eyebrow="LAVANDERÍAS" title="Lavanderías cercanas" description="Encuentra la mejor opción cerca de ti. Mira fotos, reseñas, detergentes y cotiza." action={
      <button className="primary-button" onClick={locate} disabled={locating}>
        <MapPin size={15} /> {locating ? 'Localizando…' : 'Usar mi ubicación'}
      </button>
    } />
    {error && <ErrorBanner message={error} retry={() => load(coords?.lat, coords?.lng)} />}
    {loading ? <div className="panel"><p className="muted">Cargando lavanderías…</p></div> : (
      <div className="shops-grid-page">
        {shops.map((shop, i) => (
          <article className="shop-card-rich" key={shop.id} style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="shop-card-image" style={{ backgroundImage: `url(${shop.imageUrl})` }}>
              <div className="shop-card-rating"><Star size={13} fill="currentColor" /> {shop.rating}</div>
              {shop.distance !== null && <div className="shop-card-distance"><MapPin size={12} /> {shop.distance} km</div>}
              <button className={`shop-fav-btn ${favorites.has(shop.id) ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(shop.id); }} aria-label="Favorito">
                <Heart size={16} fill={favorites.has(shop.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="shop-card-body">
              <h3>{shop.name}</h3>
              <p className="muted small">{shop.address}</p>
              <p className="shop-services">{shop.servicesSummary}</p>
              <div className="shop-detergents">
                {shop.detergents.map((d) => <span key={d} className="detergent-chip">{d}</span>)}
              </div>
              <div className="shop-reviews-preview">
                {shop.reviews.slice(0, 2).map((r) => (
                  <div key={r.id} className="review-mini">
                    <b>{r.author}</b> <span className="review-stars">{'★'.repeat(r.rating)}</span>
                    <p>{r.comment}</p>
                  </div>
                ))}
                {shop.reviews.length > 2 && <small className="muted">+{shop.reviews.length - 2} reseñas más</small>}
              </div>
              <div className="shop-card-actions">
                <button className="primary-button" onClick={() => openDetail(shop)}>
                  <DollarSign size={15} /> Cotizar y ver detalle
                </button>
              </div>
            </div>
          </article>
        ))}
        {!shops.length && <EmptyState title="Sin lavanderías" text="No hay lavanderías disponibles por ahora." />}
      </div>
    )}

    {selected && <ShopDetailModal shop={selected} close={() => setSelected(null)} onReviewAdded={() => openDetail(selected)} isFavorite={favorites.has(selected.id)} onToggleFavorite={() => toggleFavorite(selected.id)} />}
  </>;
}

function ShopDetailModal({ shop, close, onReviewAdded, isFavorite, onToggleFavorite }: { shop: Shop; close: () => void; onReviewAdded: () => void; isFavorite: boolean; onToggleFavorite: () => void }) {
  const [quote, setQuote] = useState({ service: 'Lavado por prenda', qty: 1, weight: 1, detergent: shop.detergents[0] ?? '' });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'cotizar' | 'chat' | 'reservar'>('info');

  // Chat
  const [messages, setMessages] = useState<Array<{ id: number; sender: string; message: string; createdAt: string; author: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  // Booking
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:00');
  const [bookingService, setBookingService] = useState('Lavado por prenda');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingMsg, setBookingMsg] = useState('');

  useEffect(() => {
    api<Array<{ id: number; sender: string; message: string; createdAt: string; author: string }>>(`/client/shops/${shop.id}/messages`)
      .then(setMessages).catch(() => setMessages([]));
  }, [shop.id]);

  const pricePerUnit = quote.service === 'Lavado por kilo' ? 12 : quote.service === 'Planchado' ? 6 : 8;
  const estimated = quote.service === 'Lavado por kilo' ? pricePerUnit * quote.weight : pricePerUnit * quote.qty;

  const submitReview = async () => {
    setReviewBusy(true);
    setReviewMsg('');
    try {
      await api(`/client/shops/${shop.id}/reviews`, { method: 'POST', body: JSON.stringify({ rating: reviewRating, comment: reviewComment }) });
      setReviewMsg('¡Gracias por tu reseña!');
      setReviewComment('');
      onReviewAdded();
    } catch (err) {
      setReviewMsg(err instanceof Error ? err.message : 'No se pudo enviar la reseña.');
    } finally {
      setReviewBusy(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    setChatBusy(true);
    try {
      await api(`/client/shops/${shop.id}/messages`, { method: 'POST', body: JSON.stringify({ message: chatInput }) });
      setMessages((m) => [...m, { id: Date.now(), sender: 'CLIENTE', message: chatInput, createdAt: new Date().toISOString(), author: 'Tú' }]);
      setChatInput('');
    } catch (err) {
      setChatInput((v) => v);
    } finally {
      setChatBusy(false);
    }
  };

  const submitBooking = async () => {
    if (!bookingDate) { setBookingMsg('Selecciona una fecha.'); return; }
    setBookingBusy(true);
    setBookingMsg('');
    try {
      const scheduledAt = new Date(`${bookingDate}T${bookingTime}:00`).toISOString();
      await api('/client/bookings', { method: 'POST', body: JSON.stringify({ shopId: shop.id, service: bookingService, scheduledAt, notes: bookingNotes }) });
      setBookingMsg('¡Turno reservado con éxito!');
      setBookingDate(''); setBookingNotes('');
    } catch (err) {
      setBookingMsg(err instanceof Error ? err.message : 'No se pudo reservar.');
    } finally {
      setBookingBusy(false);
    }
  };

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${shop.longitude - 0.01},${shop.latitude - 0.01},${shop.longitude + 0.01},${shop.latitude + 0.01}&layer=mapnik&marker=${shop.latitude},${shop.longitude}`;

  return <Modal title={shop.name} close={close}>
    <div className="shop-detail">
      <div className="shop-detail-image" style={{ backgroundImage: `url(${shop.imageUrl})` }}>
        <div className="shop-detail-rating"><Star size={14} fill="currentColor" /> {shop.rating} · {shop.reviews.length} reseñas</div>
        <button className={`shop-fav-btn large ${isFavorite ? 'active' : ''}`} onClick={onToggleFavorite} aria-label="Favorito">
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="shop-detail-tabs">
        {(['info', 'cotizar', 'chat', 'reservar'] as const).map((t) => (
          <button key={t} className={`shop-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'info' && 'Información'}
            {t === 'cotizar' && 'Cotizar'}
            {t === 'chat' && 'Chat'}
            {t === 'reservar' && 'Reservar turno'}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="shop-detail-grid">
          <div className="shop-detail-info">
            <h4>Información</h4>
            <div className="profile-kv">
              <div><span>Dirección</span><b>{shop.address}</b></div>
              <div><span>Teléfono</span><b>{shop.phone}</b></div>
              <div><span>Horario</span><b>{shop.openingHours}</b></div>
              <div><span>Servicios</span><b>{shop.servicesSummary}</b></div>
            </div>
            <h4 style={{ marginTop: 12 }}>Detergentes disponibles</h4>
            <div className="shop-detergents">
              {shop.detergents.map((d) => <span key={d} className="detergent-chip large">{d}</span>)}
            </div>
            <h4 style={{ marginTop: 12 }}>Ubicación exacta</h4>
            <div className="shop-map">
              <iframe title="mapa" src={mapUrl} loading="lazy" />
            </div>
            <a className="shop-phone-large" href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} target="_blank" rel="noreferrer">
              <MapPin size={14} /> Abrir en Google Maps
            </a>
          </div>
          <div className="shop-detail-side">
            <h4>Reseñas ({shop.reviews.length})</h4>
            <div className="reviews-list">
              {shop.reviews.map((r) => (
                <div key={r.id} className="review-card">
                  <div className="review-header">
                    <b>{r.author}</b>
                    <span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  {r.comment && <p>{r.comment}</p>}
                  <small className="muted">{date(r.createdAt)}</small>
                </div>
              ))}
              {!shop.reviews.length && <EmptyState title="Sin reseñas" text="Sé el primero en opinar." />}
            </div>
            <h4 style={{ marginTop: 14 }}>Deja tu reseña</h4>
            <div className="review-form">
              <div className="star-picker">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={`star-btn ${n <= reviewRating ? 'active' : ''}`} onClick={() => setReviewRating(n)}>★</button>
                ))}
              </div>
              <textarea placeholder="Comparte tu experiencia..." value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} maxLength={500} />
              {reviewMsg && <small className={reviewMsg.startsWith('¡') ? 'form-success' : 'form-error'}>{reviewMsg}</small>}
              <button className="primary-button" onClick={submitReview} disabled={reviewBusy}>
                {reviewBusy ? 'Enviando…' : 'Publicar reseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cotizar' && (
        <div className="quote-box" style={{ maxWidth: 420 }}>
          <label>Servicio
            <select value={quote.service} onChange={(e) => setQuote({ ...quote, service: e.target.value })}>
              <option>Lavado por prenda</option>
              <option>Lavado por kilo</option>
              <option>Planchado</option>
            </select>
          </label>
          <label>Detergente preferido
            <select value={quote.detergent} onChange={(e) => setQuote({ ...quote, detergent: e.target.value })}>
              {shop.detergents.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          {quote.service === 'Lavado por kilo' ? (
            <label>Peso (kg)
              <input type="number" min="0.5" step="0.5" value={quote.weight} onChange={(e) => setQuote({ ...quote, weight: Number(e.target.value) })} />
            </label>
          ) : (
            <label>Cantidad
              <input type="number" min="1" step="1" value={quote.qty} onChange={(e) => setQuote({ ...quote, qty: Number(e.target.value) })} />
            </label>
          )}
          <div className="quote-result">
            <span>Estimado</span>
            <b>{money(estimated)}</b>
          </div>
          <small className="muted">Precio referencial con {quote.detergent}. El monto final se confirma en la lavandería.</small>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="chat-box">
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.sender === 'CLIENTE' ? 'mine' : 'theirs'}`}>
                <b>{m.sender === 'CLIENTE' ? 'Tú' : 'Negocio'}</b>
                <p>{m.message}</p>
                <small>{date(m.createdAt)}</small>
              </div>
            ))}
            {!messages.length && <EmptyState title="Sin mensajes" text="Inicia la conversación con la lavandería." />}
          </div>
          <div className="chat-input">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escribe un mensaje..." onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }} />
            <button className="primary-button" onClick={sendChat} disabled={chatBusy || !chatInput.trim()}>{chatBusy ? '…' : 'Enviar'}</button>
          </div>
        </div>
      )}

      {activeTab === 'reservar' && (
        <div className="quote-box" style={{ maxWidth: 420 }}>
          <label>Servicio
            <select value={bookingService} onChange={(e) => setBookingService(e.target.value)}>
              <option>Lavado por prenda</option>
              <option>Lavado por kilo</option>
              <option>Planchado</option>
              <option>Lavado + Planchado</option>
            </select>
          </label>
          <label>Fecha
            <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          </label>
          <label>Hora
            <input type="time" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
          </label>
          <label>Notas (opcional)
            <textarea value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} maxLength={500} placeholder="Instrucciones especiales..." />
          </label>
          {bookingMsg && <small className={bookingMsg.startsWith('¡') ? 'form-success' : 'form-error'}>{bookingMsg}</small>}
          <button className="primary-button" onClick={submitBooking} disabled={bookingBusy}>
            {bookingBusy ? 'Reservando…' : 'Reservar turno'}
          </button>
        </div>
      )}
    </div>
  </Modal>;
}


