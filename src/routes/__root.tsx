import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { MotionRoot } from "../components/MotionRoot";
import { Toaster } from "../components/ui/sonner";
import { applyCatalog } from "../lib/catalog";
import { getPublicCatalog } from "../lib/catalog-server";

function StatusPage({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  return (
    <div className="status-page">
      <div>
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="status-actions">{children}</div>
      </div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <StatusPage title="Página não encontrada" message="O endereço pode ter mudado. O cardápio continua na página inicial.">
      <Link to="/" className="bakery-button bakery-button-cocoa">
        Ver o cardápio
      </Link>
    </StatusPage>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <StatusPage title="A página não carregou" message="Tente de novo. Se continuar, faça seu pedido direto pelo WhatsApp: (15) 99711-5450.">
      <button
        type="button"
        className="bakery-button bakery-button-cocoa"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Tentar de novo
      </button>
      <a href="/" className="bakery-button bakery-button-primary">
        Ir para o início
      </a>
    </StatusPage>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#fdf8f5" },
      { name: "author", content: "Ondina Bolos" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Ondina Bolos" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  // Cardápio do banco (editável no /admin) — ou o padrão, se ninguém editou ainda.
  loader: () => getPublicCatalog(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Antes de qualquer página desenhar: cardápio, carrinho e Monte seu Bolo leem daqui.
  applyCatalog(Route.useLoaderData());

  return (
    <QueryClientProvider client={queryClient}>
      {/* Obrigatório: as rotas filhas renderizam aqui. */}
      <Outlet />
      <MotionRoot />
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  );
}
