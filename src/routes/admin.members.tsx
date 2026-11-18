import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyNote } from "@/components/roster/group-view";
import { ImportSheet } from "@/components/roster/import-sheet";
import { RoleBadge } from "@/components/roster/role-toggle";
import { MemberForm } from "@/components/roster/member-form";
import { PageHeader } from "@/components/roster/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminDataQuery } from "@/lib/queries";
import { initials, type Member, type MemberRole } from "@/lib/roster";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/members")({
  head: () => ({
    meta: [
      { title: "Members — Zakereen Admin" },
      { name: "description", content: "Add, import and edit members — tipper or chorus — with ITS ID and contact number." },
      { property: "og:title", content: "Members — Zakereen Admin" },
      { property: "og:description", content: "Add, import and edit members — tipper or chorus — with ITS ID and contact number." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { data } = useSuspenseQuery(adminDataQuery);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [importing, setImporting] = useState(false);
  const [roleFilter, setRoleFilter] = useState<MemberRole | null>(null);
  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups]);

  const filtered = data.members.filter((m) => {
    if (roleFilter && m.role !== roleFilter) return false;
    const s = q.toLowerCase();
    return m.name.toLowerCase().includes(s) || m.its_id.includes(s) || m.phone.includes(s);
  });

  function openForm(member: Member | null) {
    setEditing(member);
    setOpen(true);
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Members"
        subtitle={`${data.members.length} member${data.members.length === 1 ? "" : "s"}`}
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
      {data.members.length ? (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ITS or number" className="pl-11" />
          </div>
          <div className="mb-3 flex gap-2">
            {([null, "tipper", "chorus"] as const).map((r) => {
              const count = r ? data.members.filter((m) => m.role === r).length : data.members.length;
              return (
                <button
                  key={r ?? "all"}
                  onClick={() => setRoleFilter(r)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    roleFilter === r ? "tone-ink" : "bg-card hover:bg-muted",
                  )}
                >
                  {r === null ? "All" : r === "tipper" ? "Tippers" : "Chorus"}{" "}
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          <ul className="space-y-2">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => openForm(m)}
                  className="press flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left"
                >
                  <span className={cn(m.role === "tipper" ? "tone-tangerine" : "tone-blush", "grid size-11 shrink-0 place-items-center rounded-full font-display text-sm font-bold")}>
                    {initials(m.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{m.name}</span>
                      <RoleBadge role={m.role} />
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      ITS {m.its_id} · {m.phone}
                    </span>
                  </span>
                  <span
                    className={
                      m.group_id
                        ? "max-w-28 shrink-0 truncate rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink"
                        : "shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                    }
                  >
                    {m.group_id ? groupName.get(m.group_id) : "No group"}
                  </span>
                </button>
              </li>
            ))}
            {!filtered.length ? <EmptyNote>No members match.</EmptyNote> : null}
          </ul>
        </>
      ) : (
        <EmptyNote>No members yet. Add one, or import an Excel file.</EmptyNote>
      )}
      <MemberForm open={open} onOpenChange={setOpen} member={editing} groups={data.groups} members={data.members} />
      <ImportSheet kind="members" open={importing} onOpenChange={setImporting} />
    </div>
  );
}
