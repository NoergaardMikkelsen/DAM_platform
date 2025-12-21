// Force assets pages to use tenant layout by ensuring they don't have conflicting layouts
export default function AssetsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
