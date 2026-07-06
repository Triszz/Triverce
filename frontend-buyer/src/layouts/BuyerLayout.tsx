// Re-exports the existing MainLayout under the `BuyerLayout` name used in
// the architecture plan. The underlying component lives at `MainLayout.tsx`
// (header + outlet + footer wrapper). Adding this alias keeps the rest of
// the codebase stable while future PRs can import the planned name.
export { default as BuyerLayout } from './MainLayout';
export { default } from './MainLayout';
