import { useParams } from 'react-router-dom';

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Order Detail</h1>
      <p className="text-slate-500">Order ID: {orderId}</p>
    </div>
  );
}
