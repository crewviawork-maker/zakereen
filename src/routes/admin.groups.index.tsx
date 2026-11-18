import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { GroupForm } from "@/components/roster/group-form";
import { EmptyNote } from "@/components/roster/group-view";
import { PageHeader } from "@/components/roster/page-header";
import { Button } from "@/components/ui/button";
import { adminDataQuery } from "@/lib/queries";
import { isMixedMohalla, locationsOfGroup, mohallasOfGroup, toneFor } from "@/lib/roster";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/groups/")({
  head: () => ({
    meta: [
      { title: "Groups — Zakereen Admin" },
      { name: "description", content: "Create groups and choose their members." },
      { property: "og:title", content: "Groups — Zakereen Admin" },
      { property: "og:description", content: "Create groups and choose their members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { data } = useSuspenseQuery(adminDataQuery);
  const [open, setOpen] = useState(false);

  return (
    <div className="animate-rise">
      <PageHeader
        title="Groups"
        subtitle={`${data.groups.length} group${data.groups.length === 1 ? "" : "s"}`}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New group
          </Button>
        }
      />
      {data.groups.length ? (
        <ul className="space-y-2.5">
          {data.groups.map((g, i) => {
            const memberCount = data.members.filter((m) => m.group_id === g.id).length;
            const locCount = locationsOfGroup(g.id, data.locations).length;
            const mixed = isMixedMohalla(g.id, data.locations);
            const mohallas = mohallasOfGroup(g.id, data.locations);
            return (
              <li key={g.id}>
                <Link
                  to="/admin/groups/$groupId"
                  params={{ groupId: g.id }}
                  className="press flex items-center gap-3 rounded-2xl bg-card p-3"
                >
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold",
                      mixed ? "tone-warning" : toneFor(i),
                    )}
                  >
                    {mixed ? <AlertTriangle className="size-5" /> : g.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{g.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {memberCount} members · {locCount} locations
                      {mohallas.length ? ` · ${mohallas.join(", ")}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyNote>No groups yet. Create your first group.</EmptyNote>
      )}
      <GroupForm open={open} onOpenChange={setOpen} group={null} members={data.members} />
    </div>
  );
}
