import { useServerFn } from "@tanstack/react-start";
import { Check, Mic, Search } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials, pickableFor, tipperOf, type Group, type Member } from "@/lib/roster";
import { saveGroup } from "@/lib/roster.functions";
import { useRosterMutation } from "@/lib/use-roster-mutation";
import { cn } from "@/lib/utils";
import { Field, Modal } from "./modal";

export function GroupForm({
  open,
  onOpenChange,
  group,
  members,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group: Group | null;
  members: Member[];
}) {
  const [name, setName] = useState("");
  const [autoName, setAutoName] = useState("");
  const [tipperId, setTipperId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) {
      const t = group ? tipperOf(group.id, members) : undefined;
      setName(group?.name ?? "");
      setAutoName(t && group && t.name === group.name ? group.name : "");
      setTipperId(t?.id ?? null);
      setSelected(
        new Set(group ? members.filter((m) => m.group_id === group.id && m.role === "chorus").map((m) => m.id) : []),
      );
      setQ("");
    }
    // Only reset when the sheet opens or the group changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  // Only free members (or ones already in this group) can be picked.
  const tippers = useMemo(() => pickableFor(group?.id, members, "tipper"), [group, members]);
  const chorus = useMemo(() => pickableFor(group?.id, members, "chorus"), [group, members]);
  const filtered = chorus.filter(
    (m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.its_id.includes(q),
  );

  const saveFn = useServerFn(saveGroup);
  const save = useRosterMutation(saveFn, {
    success: group ? "Group updated" : "Group created",
    onDone: () => onOpenChange(false),
  });

  function pickTipper(m: Member) {
    setTipperId(m.id);
    // Name follows the tipper until the admin types their own name.
    if (!name.trim() || name === autoName) {
      setName(m.name);
      setAutoName(m.name);
    }
  }

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
    if (!tipperId) return;
    save.mutate({ data: { id: group?.id, name, tipperId, memberIds: [...selected] } });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={group ? "Edit group" : "New group"}>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold">1. Tipper</span>
            <span className="text-xs text-muted-foreground">One per group</span>
          </div>
          {tippers.length ? (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-muted p-1.5">
              {tippers.map((m) => {
                const on = tipperId === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pickTipper(m)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors",
                        on ? "bg-card ring-2 ring-ink" : "hover:bg-card/60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
                          on ? "tone-ink" : "tone-tangerine",
                        )}
                      >
                        {on ? <Check className="size-4" /> : <Mic className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{m.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">ITS {m.its_id}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-warning-soft p-4 text-sm font-medium text-warning">
              No free tipper. Add a member as Tipper (or free one from another group) first.
            </p>
          )}
        </div>

        <Field label="2. Group name" hint={tipperId && name === autoName ? "Taken from the tipper's name — you can change it." : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Pick a tipper first" />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold">3. Chorus</span>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          </div>
          {chorus.length ? (
            <>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ITS" className="pl-10" />
              </div>
              <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-2xl bg-muted p-1.5">
                {filtered.map((m) => {
                  const on = selected.has(m.id);
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
                          <span className="block truncate text-xs text-muted-foreground">ITS {m.its_id}</span>
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
              No free chorus members. Members already in a group aren't shown.
            </p>
          )}
        </div>

        <Button type="submit" variant="ink" size="lg" className="w-full" disabled={save.isPending || !tipperId}>
          {save.isPending ? "Saving…" : !tipperId ? "Pick a tipper to continue" : group ? "Save group" : "Create group"}
        </Button>
      </form>
    </Modal>
  );
}
