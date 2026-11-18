import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tipperOf, type Group, type Member, type MemberRole } from "@/lib/roster";
import { deleteMember, saveMember } from "@/lib/roster.functions";
import { useRosterMutation } from "@/lib/use-roster-mutation";
import { ConfirmDelete } from "./confirm";
import { Field, Modal } from "./modal";
import { RoleToggle } from "./role-toggle";
import { NativeSelect } from "./select";

export function MemberForm({
  open,
  onOpenChange,
  member,
  groups,
  members,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member: Member | null;
  groups: Group[];
  members: Member[];
}) {
  const [name, setName] = useState("");
  const [itsId, setItsId] = useState("");
  const [phone, setPhone] = useState("");
  const [groupId, setGroupId] = useState("");
  const [role, setRole] = useState<MemberRole>("chorus");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setName(member?.name ?? "");
      setItsId(member?.its_id ?? "");
      setPhone(member?.phone ?? "");
      setGroupId(member?.group_id ?? "");
      setRole(member?.role ?? "chorus");
    }
  }, [open, member]);

  const saveFn = useServerFn(saveMember);
  const deleteFn = useServerFn(deleteMember);
  const save = useRosterMutation(saveFn, {
    success: member ? "Member updated" : "Member added",
    onDone: () => onOpenChange(false),
  });
  const remove = useRosterMutation(deleteFn, {
    success: "Member deleted",
    onDone: () => onOpenChange(false),
  });

  // A tipper can only join a group that has no tipper yet.
  const groupTipper = (gid: string) => tipperOf(gid, members, member?.id);
  const tipperClash = role === "tipper" && groupId ? groupTipper(groupId) : undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      data: { id: member?.id, name, itsId, phone, role, groupId: groupId || null },
    });
  }

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} title={member ? "Edit member" : "Add member"}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-semibold">Type</span>
            <RoleToggle value={role} onChange={setRole} />
            <span className="mt-1 block text-xs text-muted-foreground">
              Each group has one tipper and any number of chorus members.
            </span>
          </div>
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Husain Ali" />
          </Field>
          <Field label="ITS ID">
            <Input
              value={itsId}
              onChange={(e) => setItsId(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={8}
              required
              placeholder="8 digits"
            />
          </Field>
          <Field label="Contact number" hint="Used for the Call and WhatsApp buttons.">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              type="tel"
              required
              placeholder="e.g. 98765 43210"
            />
          </Field>
          <Field label="Group">
            <NativeSelect value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">No group yet</option>
              {groups.map((g) => {
                const t = groupTipper(g.id);
                const blocked = role === "tipper" && !!t;
                return (
                  <option key={g.id} value={g.id} disabled={blocked}>
                    {g.name}
                    {blocked ? ` — has tipper (${t.name})` : ""}
                  </option>
                );
              })}
            </NativeSelect>
            {tipperClash ? (
              <span className="mt-1 block text-xs font-medium text-warning">
                This group already has a tipper ({tipperClash.name}). Pick another group.
              </span>
            ) : null}
          </Field>
          <div className="flex gap-2 pt-2">
            {member ? (
              <Button type="button" variant="soft" className="text-warning" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            ) : null}
            <Button type="submit" variant="ink" size="lg" className="flex-1" disabled={save.isPending || !!tipperClash}>
              {save.isPending ? "Saving…" : member ? "Save changes" : "Add member"}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this member?"
        description={`${member?.name ?? "This member"} will be removed and can no longer sign in.`}
        onConfirm={() => member && remove.mutate({ data: { id: member.id } })}
      />
    </>
  );
}
