export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full min-h-screen bg-[var(--color-bg)]">{children}</div>;
}
