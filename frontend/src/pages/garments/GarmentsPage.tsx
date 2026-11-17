import { Catalog } from '../../components/shared/Catalog';

export function GarmentsPage({ isAdmin }: { isAdmin: boolean }) {
  return <Catalog kind="garments" title="Prendas" isAdmin={isAdmin} />;
}
