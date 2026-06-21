import { useParams } from 'react-router-dom';

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Product Detail</h1>
      <p className="text-slate-500">Product ID: {productId}</p>
    </div>
  );
}
