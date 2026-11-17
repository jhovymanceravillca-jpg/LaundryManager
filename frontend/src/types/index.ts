export type Role = 'ADMIN' | 'STAFF' | 'CLIENT';

export type User = {
  id: number;
  fullName: string;
  email?: string;
  avatarUrl?: string | null;
  role: Role;
  isClient?: boolean;
  active?: boolean;
};

export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number };

export const PAGE_SIZE = 50;

export type Customer = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
};

export type Service = {
  id: number;
  name: string;
  unitType: 'PRENDA' | 'KILOGRAMO' | 'FIJO';
  basePrice: number;
};

export type Garment = { id: number; name: string };

export type OrderItem = {
  garmentName: string;
  serviceName: string;
  quantity: number;
  weightKg?: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
};

export type Payment = {
  id: number;
  amount: number;
  paymentMethod: string;
  reference?: string;
  paidAt: string;
  voidedAt?: string;
};

export type Order = {
  id: number;
  orderCode: string;
  customerName: string;
  customerId: number;
  status: string;
  total: number;
  paid: number;
  expectedDeliveryAt: string;
  subtotal?: number;
  discount?: number;
  receivedAt?: string;
  notes?: string;
  items?: OrderItem[];
  payments?: Payment[];
  history?: Array<{ previousStatus?: string; newStatus: string; changedAt: string }>;
};

export type Summary = {
  orderCount: number;
  pendingCount: number;
  processingCount: number;
  readyCount: number;
  deliveredCount: number;
  collected: number;
  balance: number;
  recent: Order[];
};

export type Page =
  | 'Inicio'
  | 'Mi perfil'
  | 'Pedidos'
  | 'Clientes'
  | 'Prendas'
  | 'Servicios'
  | 'Pagos'
  | 'Entregas'
  | 'Reportes'
  | 'Usuarios'
  | 'Configuración';

export const PAGE_PATHS: Record<Page, string> = {
  Inicio: '/',
  'Mi perfil': '/profile',
  Pedidos: '/orders',
  Clientes: '/customers',
  Prendas: '/garments',
  Servicios: '/services',
  Pagos: '/payments',
  Entregas: '/deliveries',
  Reportes: '/reports',
  Usuarios: '/users',
  Configuración: '/settings'
};

export const FONT_OPTIONS = [
  { id: 'system', name: 'Sistema', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'arial', name: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'verdana', name: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'trebuchet', name: 'Trebuchet MS', stack: '"Trebuchet MS", Arial, sans-serif' },
  { id: 'georgia', name: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', name: 'Monoespaciada', stack: '"Courier New", monospace' }
] as const;

export type FontFamily = (typeof FONT_OPTIONS)[number]['id'];
export type BackgroundMode = 'light' | 'dark';
export type Appearance = { accentColor: string; fontFamily: FontFamily; backgroundMode: BackgroundMode };

export const DEFAULT_APPEARANCE: Appearance = {
  accentColor: '#2863e9',
  fontFamily: 'system',
  backgroundMode: 'light'
};

export const COLOR_PALETTE = [
  { name: 'Azul', hex: '#2863e9' },
  { name: 'Índigo', hex: '#4f46e5' },
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Fucsia', hex: '#c026d3' },
  { name: 'Rosa', hex: '#e11d48' },
  { name: 'Rojo', hex: '#dc2626' },
  { name: 'Naranja', hex: '#ea580c' },
  { name: 'Ámbar', hex: '#ca8a04' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Turquesa', hex: '#0d9488' },
  { name: 'Cian', hex: '#0891b2' }
] as const;
