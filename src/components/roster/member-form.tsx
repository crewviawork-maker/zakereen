import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Group, Member } from "@/lib/roster";
import { deleteMember, saveMember } from "@/lib/roster.functions";
import { useRosterMutation } from "@/lib/use-roster-mutation";
import { ConfirmDelete } from "./confirm";
import { Field, Modal } from "./modal";
import { NativeSelect } from "./select";

export function MemberForm({
  open,
  onOpenChange,
  member,
  groups,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member: Member | null;
  groups: Group[];
}) {
  const [name, setName] = useState("");
  const [itsId, setItsId] = useState("");
  const [phone, setPhone] = useState("");
  const [groupId, setGroupId] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setName(member?.name ?? "");
      setItsId(member?.its_id ?? "");
      setPhone(member?.phone ?? "");
      setGroupId(member?.group_id ?? "");
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      data: { id: member?.id, name, itsId, phone, groupId: groupId || null },
    });
  }

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} title={member ? "Edit member" : "Add member"}>
        <form onSubmit={onSubmit} className="space-y-4">
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
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex gap-2 pt-2">
            {member ? (
              <Button type="button" variant="soft" className="text-warning" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            ) : null}
            <Button type="submit" variant="ink" size="lg" className="flex-1" disabled={save.isPending}>
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
