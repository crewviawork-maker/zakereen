import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Ban, Check } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, rankGroupsForLocation, type Group, type Location } from "@/lib/roster";
import { deleteLocation, saveLocation } from "@/lib/roster.functions";
import { useRosterMutation } from "@/lib/use-roster-mutation";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "./confirm";
import { Field, Modal } from "./modal";

export function LocationForm({
  open,
  onOpenChange,
  location,
  groups,
  locations,
  defaultMohalla,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  location: Location | null;
  groups: Group[];
  locations: Location[];
  defaultMohalla?: string | undefined;
}) {
  const [mohalla, setMohalla] = useState("");
  const [address, setAddress] = useState("");
  const [timing, setTiming] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setMohalla(location?.mohalla ?? defaultMohalla ?? "");
      setAddress(location?.address ?? "");
      setTiming(location ? location.timing.slice(0, 5) : "");
      setGroupId(location?.group_id ?? null);
    }
  }, [open, location, defaultMohalla]);

  const mohallas = useMemo(
    () => [...new Set(locations.map((l) => l.mohalla.trim()))].sort(),
    [locations],
  );
  const options = useMemo(
    () =>
      timing && mohalla.trim()
        ? rankGroupsForLocation({ id: location?.id, mohalla, timing }, groups, locations)
        : [],
    [timing, mohalla, groups, locations, location],
  );

  // Drop a chosen group that becomes busy when time changes.
  useEffect(() => {
    if (groupId && options.find((o) => o.group.id === groupId)?.conflict) setGroupId(null);
  }, [options, groupId]);

  const saveFn = useServerFn(saveLocation);
  const deleteFn = useServerFn(deleteLocation);
  const save = useRosterMutation(saveFn, {
    success: location ? "Location updated" : "Location added",
    onDone: () => onOpenChange(false),
  });
  const remove = useRosterMutation(deleteFn, {
    success: "Location deleted",
    onDone: () => onOpenChange(false),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ data: { id: location?.id, mohalla, address, timing, groupId } });
  }

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} title={location ? "Edit location" : "Add location"}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Mohalla">
            <Input
              value={mohalla}
              onChange={(e) => setMohalla(e.target.value)}
              list="mohalla-list"
              required
              placeholder="e.g. Ezzy"
            />
            <datalist id="mohalla-list">
              {mohallas.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          {mohallas.length ? (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {mohallas.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMohalla(m)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    m.toLowerCase() === mohalla.trim().toLowerCase() ? "tone-ink" : "bg-muted hover:bg-border",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : null}
          <Field label="Address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="House / building, street" />
          </Field>
          <Field label="Timing">
            <Input type="time" value={timing} onChange={(e) => setTiming(e.target.value)} required />
          </Field>

          <div>
            <span className="mb-1.5 block text-sm font-semibold">Assign group</span>
            {!timing || !mohalla.trim() ? (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                Enter mohalla and timing to see which groups are free.
              </p>
            ) : (
              <ul className="space-y-1.5 rounded-2xl bg-muted p-1.5">
                <li>
                  <GroupChoice
                    selected={groupId === null}
                    onClick={() => setGroupId(null)}
                    title="No group yet"
                    note="Assign later or use Auto-pair"
                  />
                </li>
                {options.map((o) => (
                  <li key={o.group.id}>
                    <GroupChoice
                      selected={groupId === o.group.id}
                      disabled={!!o.conflict}
                      onClick={() => setGroupId(o.group.id)}
                      title={o.group.name}
                      note={
                        o.conflict
                          ? `Busy at ${formatTime(o.conflict.timing)} · ${o.conflict.mohalla}, ${o.conflict.address}`
                          : o.sameMohalla
                            ? `Already in this mohalla · ${o.load} location${o.load === 1 ? "" : "s"}`
                            : o.wouldMix
                              ? "Works in another mohalla — will be flagged"
                              : "Free · no locations yet"
                      }
                      tone={o.conflict ? "busy" : o.wouldMix ? "warn" : o.sameMohalla ? "best" : "free"}
                    />
                  </li>
                ))}
                {!groups.length ? (
                  <li className="p-3 text-center text-sm text-muted-foreground">Create a group first.</li>
                ) : null}
              </ul>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {location ? (
              <Button type="button" variant="soft" className="text-warning" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            ) : null}
            <Button type="submit" variant="ink" size="lg" className="flex-1" disabled={save.isPending}>
              {save.isPending ? "Saving…" : location ? "Save changes" : "Add location"}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this location?"
        description={location ? `${location.mohalla} · ${location.address} at ${formatTime(location.timing)}` : ""}
        onConfirm={() => location && remove.mutate({ data: { id: location.id } })}
      />
    </>
  );
}

function GroupChoice({
  selected,
  disabled,
  onClick,
  title,
  note,
  tone = "free",
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  note: string;
  tone?: "best" | "free" | "warn" | "busy";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        selected ? "bg-card ring-2 ring-ink" : "hover:bg-card/60",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          selected ? "tone-ink" : tone === "warn" ? "tone-warning" : tone === "busy" ? "bg-border" : tone === "best" ? "tone-mint" : "tone-lime",
        )}
      >
        {selected ? <Check className="size-4" /> : tone === "warn" ? <AlertTriangle className="size-4" /> : tone === "busy" ? <Ban className="size-4" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className={cn("block truncate text-xs", tone === "warn" ? "text-warning" : "text-muted-foreground")}>
          {note}
        </span>
      </span>
    </button>
  );
}
