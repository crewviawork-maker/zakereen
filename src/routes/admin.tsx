import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { LayoutGrid, LogOut, MapPin, Users, UsersRound } from "lucide-react";
import { Brand } from "@/components/roster/brand";
import { Button } from "@/components/ui/button";
import { adminDataQuery } from "@/lib/queries";
import { getAuth } from "@/lib/roster.functions";
import { useSignOut } from "@/lib/use-sign-out";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const auth = await getAuth();
    if (auth?.role !== "admin") throw redirect({ to: "/" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(adminDataQuery),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Home", icon: LayoutGrid, exact: true },
  { to: "/admin/groups", label: "Groups", icon: UsersRound, exact: false },
  { to: "/admin/members", label: "Members", icon: Users, exact: false },
  { to: "/admin/locations", label: "Locations", icon: MapPin, exact: false },
] as const;

function AdminLayout() {
  const signOut = useSignOut();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link to="/admin" className="shrink-0">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-1 rounded-full bg-muted p-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.exact }}
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-ink data-[status=active]:text-ink-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Button variant="soft" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-32 pt-5 md:pb-16">
        <Outlet />
      </main>

      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 gap-1 rounded-full bg-ink p-1.5 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.exact }}
            className="flex flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold text-ink-foreground/60 transition-colors data-[status=active]:bg-lime data-[status=active]:text-ink"
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
