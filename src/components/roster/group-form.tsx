import { useServerFn } from "@tanstack/react-start";
import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials, type Group, type Member } from "@/lib/roster";
import { saveGroup } from "@/lib/roster.functions";
import { useRosterMutation } from "@/lib/use-roster-mutation";
import { cn } from "@/lib/utils";
import { Field, Modal } from "./modal";

export function GroupForm({
  open,
  onOpenChange,
  group,
  groups,
  members,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group: Group | null;
  groups: Group[];
  members: Member[];
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setSelected(new Set(group ? members.filter((m) => m.group_id === group.id).map((m) => m.id) : []));
      setQ("");
    }
  }, [open, group, members]);

  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const filtered = members.filter(
    (m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.its_id.includes(q),
  );

  const saveFn = useServerFn(saveGroup);
  const save = useRosterMutation(saveFn, {
    success: group ? "Group updated" : "Group created",
    onDone: () => onOpenChange(false),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ data: { id: group?.id, name, memberIds: [...selected] } });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={group ? "Edit group" : "New group"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Group name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Group A" />
        </Field>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Members</span>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          </div>
          {members.length ? (
            <>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ITS" className="pl-10" />
              </div>
              <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-2xl bg-muted p-1.5">
                {filtered.map((m) => {
                  const on = selected.has(m.id);
                  const elsewhere = m.group_id && m.group_id !== group?.id ? groupName.get(m.group_id) : null;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => toggle(m.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors",
                          on ? "bg-card" : "hover:bg-card/60",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
                            on ? "tone-ink" : "tone-blush",
                          )}
                        >
                          {on ? <Check className="size-4" /> : initials(m.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{m.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            ITS {m.its_id}
                            {elsewhere ? ` · now in ${elsewhere}${on ? " → will move" : ""}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!filtered.length ? (
                  <li className="p-3 text-center text-sm text-muted-foreground">No matches</li>
                ) : null}
              </ul>
            </>
          ) : (
            <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
              Add members first, then pick them here.
            </p>
          )}
        </div>
        <Button type="submit" variant="ink" size="lg" className="w-full" disabled={save.isPending}>
          {save.isPending ? "Saving…" : group ? "Save group" : "Create group"}
        </Button>
      </form>
    </Modal>
  );
}
