import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, MapPin, Users } from "lucide-react";
import { EmptyNote } from "@/components/roster/group-view";
import { adminDataQuery } from "@/lib/queries";
import { isMixedMohalla, locationsOfGroup, mohallasOfGroup, toneFor } from "@/lib/roster";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Zakereen Admin" },
      { name: "description", content: "Paired groups, location counts and mohalla warnings at a glance." },
      { property: "og:title", content: "Dashboard — Zakereen Admin" },
      { property: "og:description", content: "Paired groups, location counts and mohalla warnings at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(adminDataQuery);
  const { groups, members, locations } = data;

  const cards = groups.map((g, i) => ({
    group: g,
    tone: toneFor(i),
    count: locationsOfGroup(g.id, locations).length,
    mohallas: mohallasOfGroup(g.id, locations),
    memberCount: members.filter((m) => m.group_id === g.id).length,
    mixed: isMixedMohalla(g.id, locations),
  }));
  const paired = cards.filter((c) => c.count > 0).sort((a, b) => Number(b.mixed) - Number(a.mixed));
  const idle = cards.filter((c) => c.count === 0);
  const unpaired = locations.filter((l) => !l.group_id).length;
  const mixedCount = paired.filter((c) => c.mixed).length;

  const stats = [
    { label: "Groups", value: groups.length, tone: "tone-lime", to: "/admin/groups" as const },
    { label: "Members", value: members.length, tone: "tone-blush", to: "/admin/members" as const },
    { label: "Locations", value: locations.length, tone: "tone-mint", to: "/admin/locations" as const },
    { label: "Not paired", value: unpaired, tone: unpaired ? "tone-tangerine" : "tone-ink", to: "/admin/locations" as const },
  ];

  return (
    <div className="animate-rise space-y-8">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Salaam, Admin</p>
        <h1 className="mt-1 text-4xl font-extrabold sm:text-5xl">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className={cn("press rounded-3xl p-4", s.tone)}>
            <p className="font-display text-4xl font-extrabold leading-none">{s.value}</p>
            <p className="mt-2 text-sm font-semibold opacity-80">{s.label}</p>
          </Link>
        ))}
      </div>

      {mixedCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-warning">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-medium">
            {mixedCount} group{mixedCount === 1 ? " is" : "s are"} assigned to more than one mohalla.
            Try to keep each group in a single mohalla.
          </p>
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-bold">Paired groups</h2>
        {paired.length ? (
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
            {paired.map((c) => (
              <Link
                key={c.group.id}
                to="/admin/groups/$groupId"
                params={{ groupId: c.group.id }}
                className={cn(
                  "press group relative flex min-h-48 flex-col overflow-hidden rounded-3xl p-5",
                  c.mixed ? "tone-warning" : c.tone,
                )}
              >
                {c.mixed ? <div className="hazard-band absolute inset-x-0 top-0 h-2" /> : null}
                <div className="absolute -bottom-8 -right-8 size-28 rounded-full bg-background/15" aria-hidden />
                <div className="relative flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-2xl font-extrabold">{c.group.name}</h3>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background/25 transition-transform group-hover:rotate-45">
                    <ArrowUpRight className="size-4" />
                  </span>
                </div>
                {c.mixed ? (
                  <p className="relative mt-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide">
                    <AlertTriangle className="size-3.5" /> Mixed mohalla
                  </p>
                ) : null}
                <div className="relative mt-auto pt-6">
                  <p className="flex items-end gap-2">
                    <span className="font-display text-6xl font-extrabold leading-[0.8]">{c.count}</span>
                    <span className="pb-0.5 text-sm font-semibold opacity-80">
                      location{c.count === 1 ? "" : "s"}
                    </span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
                    {c.mohallas.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 rounded-full bg-background/25 px-2.5 py-1">
                        <MapPin className="size-3" />
                        {m}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/25 px-2.5 py-1">
                      <Users className="size-3" />
                      {c.memberCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyNote>
            {groups.length === 0
              ? "Start by adding members, then create groups and add locations."
              : "No group has a location yet. Add locations and assign groups."}
          </EmptyNote>
        )}
      </section>

      {idle.length ? (
        <section>
          <h2 className="mb-3 text-xl font-bold">Waiting for locations</h2>
          <div className="flex flex-wrap gap-2">
            {idle.map((c) => (
              <Link
                key={c.group.id}
                to="/admin/groups/$groupId"
                params={{ groupId: c.group.id }}
                className="press inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold"
              >
                {c.group.name}
                <span className="text-muted-foreground">· {c.memberCount} members</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
