import { useState } from 'react';
import {
  Button,
  Input,
  Card,
  Badge,
  PriceTag,
  Skeleton,
  SkeletonText,
} from '@/components/ui';

/**
 * UI primitives smoke-test page. Leave in the codebase until the catalog
 * pages (Step 6) consume these components — then remove the route.
 */
export default function UiPlayground() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <h1 className="text-3xl font-bold text-slate-900">UI Playground</h1>

      {/* Buttons */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" isLoading>
            Loading
          </Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      {/* Input */}
      <section className="space-y-3 max-w-md">
        <h2 className="text-lg font-semibold text-slate-900">Inputs</h2>
        <Input
          label="Email"
          placeholder="you@example.com"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          hint="We will not share your email."
        />
        <Input
          label="With error"
          defaultValue="not-an-email"
          error={error ?? 'Please enter a valid email'}
          onFocus={() => setError(null)}
        />
        <Input
          label="Disabled"
          placeholder="Disabled"
          disabled
        />
      </section>

      {/* Cards */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Cards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm font-medium">Default card</p>
            <p className="text-xs text-slate-500 mt-1">Static, padded, shadow-sm.</p>
          </Card>
          <Card interactive>
            <p className="text-sm font-medium">Interactive card</p>
            <p className="text-xs text-slate-500 mt-1">Hover lifts on shadow.</p>
          </Card>
          <Card padded={false} className="overflow-hidden">
            <div className="aspect-square bg-gradient-to-br from-brand-100 to-brand-300" />
          </Card>
        </div>
      </section>

      {/* Badges */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">In stock</Badge>
          <Badge tone="warning">Low stock</Badge>
          <Badge tone="danger">Out of stock</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge size="sm">Small</Badge>
        </div>
      </section>

      {/* PriceTag */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">PriceTag</h2>
        <div className="space-y-2">
          <PriceTag value={1_290_000} />
          <PriceTag value={990_000} originalValue={1_490_000} size="lg" />
          <PriceTag value={29_900_000} size="xl" />
        </div>
      </section>

      {/* Skeleton */}
      <section className="space-y-3 max-w-md">
        <h2 className="text-lg font-semibold text-slate-900">Skeletons</h2>
        <div className="space-y-3">
          <Skeleton variant="rectangular" className="h-32 w-full" />
          <Skeleton variant="circular" className="h-12 w-12" />
          <SkeletonText lines={3} />
        </div>
      </section>
    </div>
  );
}
