import { Catalog } from '../../components/shared/Catalog';

export function ServicesPage({ isAdmin }: { isAdmin: boolean }) {
  return <Catalog kind="services" title="Servicios" isAdmin={isAdmin} />;
}
