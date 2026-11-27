/* Admin: product categories. The Add product form picks one of these from a dropdown. */
import { Tags } from 'lucide-react';
import CrudPage from '@/components/CrudPage';
import { Badge } from '@/components/ui';

export default function ProductCategories() {
  return (
    <CrudPage title="Categories" description="Group your products. Pick a category from the dropdown when you add a product." endpoint="/admin/product-categories" singular="Category" icon={Tags}
      columns={[
        { key: 'name', label: 'Category', render: (r) => <span className="font-medium">{r.name}</span> },
        { key: 'sort', label: 'Order', render: (r) => <span className="tabular-nums text-muted-foreground">{r.sort}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status ? 'success' : 'outline'}>{r.status ? 'Active' : 'Hidden'}</Badge> },
      ]}
      fields={[{ name: 'name', label: 'Name', required: true, placeholder: 'e.g. Metal cards' }, { name: 'sort', label: 'Sort order', type: 'number', half: true, default: 0 }, { name: 'status', label: 'Active', type: 'switch', default: true }]} />
  );
}
