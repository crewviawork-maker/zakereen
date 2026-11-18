import { Mic, Music } from "lucide-react";
import type { MemberRole } from "@/lib/roster";
import { cn } from "@/lib/utils";

export function RoleToggle({ value, onChange }: { value: MemberRole; onChange: (r: MemberRole) => void }) {
  const options: { value: MemberRole; label: string; icon: typeof Mic }[] = [
    { value: "tipper", label: "Tipper", icon: Mic },
    { value: "chorus", label: "Chorus", icon: Music },
  ];
  return (
    <div role="radiogroup" aria-label="Tipper or Chorus" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors",
              on ? (o.value === "tipper" ? "tone-tangerine" : "tone-ink") : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RoleBadge({ role, className }: { role: MemberRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        role === "tipper" ? "tone-tangerine" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {role === "tipper" ? "Tipper" : "Chorus"}
    </span>
  );
}
