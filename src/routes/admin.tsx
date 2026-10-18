import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AdminLogin } from '@/components/admin/AdminLogin'
import { getAdminSession } from '@/lib/admin-auth'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Administração | Ondina Bolos' },
      // Área interna: fora do Google.
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    // Instalável na tela de início (no iPhone, as notificações push só funcionam assim).
    links: [
      { rel: 'manifest', href: '/admin.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icon-192.png' },
    ],
  }),
  // A sessão é conferida no servidor a cada visita (cookie httpOnly assinado).
  loader: () => getAdminSession(),
  component: AdminPage,
})

function AdminPage() {
  const session = Route.useLoaderData()
  const router = useRouter()
  const refresh = () => router.invalidate()

  return session ? (
    <AdminDashboard memberId={session.memberId} onLogout={refresh} />
  ) : (
    <AdminLogin onSuccess={refresh} />
  )
}
