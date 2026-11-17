import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDelete } from "@/components/roster/confirm";
import { GroupForm } from "@/components/roster/group-form";
import { EmptyNote, GroupView } from "@/components/roster/group-view";
import { Button } from "@/components/ui/button";
import { adminDataQuery } from "@/lib/queries";
import { isMixedMohalla, toneFor } from "@/lib/roster";
import { deleteGroup } from "@/lib/roster.functions";
import { useRosterMutation } from "@/lib/use-roster-mutation";

export const Route = createFileRoute("/admin/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Group details — Zakereen Admin" },
      { name: "description", content: "Locations with mohalla, address and timing, plus every member of the group." },
      { property: "og:title", content: "Group details — Zakereen Admin" },
      { property: "og:description", content: "Locations with mohalla, address and timing, plus every member of the group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const { data } = useSuspenseQuery(adminDataQuery);
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const deleteFn = useServerFn(deleteGroup);
  const remove = useRosterMutation(deleteFn, {
    success: "Group deleted",
    onDone: () => navigate({ to: "/admin/groups" }),
  });

  const index = data.groups.findIndex((g) => g.id === groupId);
  const group = data.groups[index];

  return (
    <div>
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
      {group ? (
        <>
          <GroupView
            group={group}
            members={data.members.filter((m) => m.group_id === group.id)}
            locations={data.locations.filter((l) => l.group_id === group.id)}
            tone={toneFor(index)}
            warning={isMixedMohalla(group.id, data.locations)}
            eyebrow="Group"
            actions={
              <div className="flex shrink-0 gap-1.5">
                <Button size="icon" variant="ink" onClick={() => setEdit(true)} aria-label="Edit group">
                  <Pencil />
                </Button>
                <Button size="icon" variant="ink" onClick={() => setConfirm(true)} aria-label="Delete group">
                  <Trash2 />
                </Button>
              </div>
            }
          />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Change this group's locations from the{" "}
            <Link to="/admin/locations" className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
              Locations
            </Link>{" "}
            page.
          </p>
          <GroupForm open={edit} onOpenChange={setEdit} group={group} groups={data.groups} members={data.members} />
          <ConfirmDelete
            open={confirm}
            onOpenChange={setConfirm}
            title={`Delete ${group.name}?`}
            description="Its members and locations stay, but they will no longer be in this group."
            onConfirm={() => remove.mutate({ data: { id: group.id } })}
          />
        </>
      ) : (
        <EmptyNote>This group no longer exists.</EmptyNote>
      )}
    </div>
  );
}
