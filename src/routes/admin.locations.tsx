import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FileSpreadsheet, MapPin, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyNote } from "@/components/roster/group-view";
import { ImportSheet } from "@/components/roster/import-sheet";
import { LocationForm } from "@/components/roster/location-form";
import { PageHeader } from "@/components/roster/page-header";
import { Button } from "@/components/ui/button";
import { adminDataQuery } from "@/lib/queries";
import { formatTime, isMixedMohalla, mohallaKey, sortByTime, type Location } from "@/lib/roster";
import { runAutoPair } from "@/lib/roster.functions";
import { useRosterMutation } from "@/lib/use-roster-mutation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/locations")({
  head: () => ({
    meta: [
      { title: "Locations — Zakereen Admin" },
      { name: "description", content: "Mohallas, addresses and timings, each paired with one group." },
      { property: "og:title", content: "Locations — Zakereen Admin" },
      { property: "og:description", content: "Mohallas, addresses and timings, each paired with one group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LocationsPage,
});

function LocationsPage() {
  const { data } = useSuspenseQuery(adminDataQuery);
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [importing, setImporting] = useState(false);

  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups]);

  const sections = useMemo(() => {
    const map = new Map<string, { name: string; items: Location[] }>();
    for (const l of data.locations) {
      const k = mohallaKey(l.mohalla);
      if (!map.has(k)) map.set(k, { name: l.mohalla.trim(), items: [] });
      map.get(k)!.items.push(l);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, name: v.name, items: sortByTime(v.items) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.locations]);

  const unpaired = data.locations.filter((l) => !l.group_id).length;
  const autoPairFn = useServerFn(runAutoPair);
  const autoPair = useRosterMutation(() => autoPairFn(), {
    success: (r) =>
      r.unpaired
        ? `Paired ${r.paired}. ${r.unpaired} still need a free group in the same mohalla — add another group.`
        : `Paired ${r.paired} location${r.paired === 1 ? "" : "s"}.`,
  });

  function openForm(loc: Location | null) {
    setEditing(loc);
    setOpen(true);
  }

  const visible = filter ? sections.filter((s) => s.key === filter) : sections;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Locations"
        subtitle={`${data.locations.length} location${data.locations.length === 1 ? "" : "s"} · ${sections.length} mohalla${sections.length === 1 ? "" : "s"}`}
        action={
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => setImporting(true)} aria-label="Import from Excel">
              <FileSpreadsheet />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button onClick={() => openForm(null)}>
              <Plus /> Add
            </Button>
          </div>
        }
      />

      {unpaired > 0 ? (
        <div className="tone-ink mb-5 flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">
              {unpaired} location{unpaired === 1 ? "" : "s"} without a group
            </p>
            <p className="text-sm opacity-70">
              Auto-pair gives each one a free group, keeping groups inside one mohalla.
            </p>
          </div>
          <Button
            variant="lime"
            onClick={() => autoPair.mutate(undefined)}
            disabled={autoPair.isPending || !data.groups.length}
          >
            <Sparkles /> {autoPair.isPending ? "Pairing…" : "Auto-pair"}
          </Button>
        </div>
      ) : null}

      {sections.length > 1 ? (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={!filter} onClick={() => setFilter(null)}>
            All
          </Chip>
          {sections.map((s) => (
            <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
              {s.name} <span className="opacity-60">{s.items.length}</span>
            </Chip>
          ))}
        </div>
      ) : null}

      {visible.length ? (
        <div className="space-y-7">
          {visible.map((s) => (
            <section key={s.key}>
              <h2 className="mb-2.5 flex items-center gap-2 text-xl font-bold">
                <MapPin className="size-5 text-primary" /> {s.name}
              </h2>
              <ul className="space-y-2">
                {s.items.map((l) => {
                  const mixed = l.group_id ? isMixedMohalla(l.group_id, data.locations) : false;
                  return (
                    <li key={l.id}>
                      <button
                        onClick={() => openForm(l)}
                        className="press flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left"
                      >
                        <span className="tone-lime flex w-[4.5rem] shrink-0 flex-col items-center rounded-xl py-2">
                          <span className="font-display text-lg font-extrabold leading-none">
                            {formatTime(l.timing).split(" ")[0]}
                          </span>
                          <span className="text-[10px] font-bold">{formatTime(l.timing).split(" ")[1]}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{l.address}</span>
                          <span className="mt-1 flex items-center gap-1.5">
                            {l.group_id ? (
                              <span
                                className={cn(
                                  "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                  mixed ? "tone-warning" : "tone-ink",
                                )}
                              >
                                {mixed ? <AlertTriangle className="size-3" /> : null}
                                {groupName.get(l.group_id)}
                              </span>
                            ) : (
                              <span className="rounded-full border border-dashed border-input px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                No group
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyNote>No locations yet. Add a mohalla, address and timing, or import an Excel file.</EmptyNote>
      )}
      <ImportSheet kind="locations" open={importing} onOpenChange={setImporting} />

      <LocationForm
        open={open}
        onOpenChange={setOpen}
        location={editing}
        groups={data.groups}
        locations={data.locations}
        defaultMohalla={filter ? sections.find((s) => s.key === filter)?.name : undefined}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active ? "tone-ink" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
