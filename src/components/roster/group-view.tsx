import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  formatTime,
  initials,
  mohallasOfGroup,
  sortByTime,
  telHref,
  whatsappHref,
  type Group,
  type Location,
  type Member,
} from "@/lib/roster";
import { cn } from "@/lib/utils";

export function MemberCard({ member, isYou }: { member: Member; isYou?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card p-3 pr-2">
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
          isYou ? "tone-tangerine" : "tone-blush",
        )}
      >
        {initials(member.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {member.name}
          {isYou ? <span className="ml-1.5 text-xs font-medium text-muted-foreground">(you)</span> : null}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {member.phone} · ITS {member.its_id}
        </p>
      </div>
      {!isYou ? (
        <div className="flex shrink-0 gap-1.5">
          <Button asChild size="icon" variant="ink" aria-label={`Call ${member.name}`}>
            <a href={telHref(member.phone)}>
              <Phone />
            </a>
          </Button>
          <Button asChild size="icon" variant="whatsapp" aria-label={`WhatsApp ${member.name}`}>
            <a href={whatsappHref(member.phone)} target="_blank" rel="noreferrer">
              <MessageCircle />
            </a>
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function LocationItem({ location }: { location: Location }) {
  return (
    <li className="flex gap-4 rounded-2xl bg-card p-4">
      <div className="flex w-16 shrink-0 flex-col items-start">
        <span className="font-display text-xl font-extrabold leading-none">
          {formatTime(location.timing).split(" ")[0]}
        </span>
        <span className="mt-1 text-xs font-semibold text-muted-foreground">
          {formatTime(location.timing).split(" ")[1]}
        </span>
      </div>
      <div className="min-w-0 flex-1 border-l border-border pl-4">
        <p className="font-display text-lg font-bold leading-tight">{location.mohalla}</p>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span>{location.address}</span>
        </p>
      </div>
    </li>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-xl font-bold">
      {children}
      {count !== undefined ? (
        <span className="rounded-full bg-ink px-2 py-0.5 font-sans text-xs font-semibold text-ink-foreground">
          {count}
        </span>
      ) : null}
    </h2>
  );
}

export function GroupView({
  group,
  members,
  locations,
  youId,
  tone = "tone-tangerine",
  warning,
  actions,
  eyebrow,
}: {
  group: Group;
  members: Member[];
  locations: Location[];
  youId?: string;
  tone?: string;
  warning?: boolean;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  const sorted = sortByTime(locations);
  const mohallas = mohallasOfGroup(group.id, locations);
  return (
    <div className="animate-rise space-y-8">
      <section
        className={cn(
          "relative overflow-hidden rounded-3xl p-6 sm:p-8",
          warning ? "tone-warning" : tone,
        )}
      >
        {warning ? <div className="hazard-band absolute inset-x-0 top-0 h-2" /> : null}
        <div className="absolute -bottom-10 -right-10 size-40 rounded-full bg-background/15" aria-hidden />
        <div className="absolute -right-2 top-8 size-16 rounded-tl-full bg-background/20" aria-hidden />
        <div className="relative">
          {eyebrow ? (
            <p className="text-sm font-semibold opacity-80">{eyebrow}</p>
          ) : null}
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="min-w-0 break-words text-4xl font-extrabold sm:text-5xl">{group.name}</h1>
            {actions}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-background/25 px-3 py-1">
              {sorted.length} location{sorted.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-full bg-background/25 px-3 py-1">
              {members.length} member{members.length === 1 ? "" : "s"}
            </span>
            {mohallas.map((m) => (
              <span key={m} className="rounded-full bg-background/25 px-3 py-1">
                {m}
              </span>
            ))}
          </div>
          {warning ? (
            <p className="mt-4 text-sm font-medium">
              This group is spread across different mohallas. Try to keep it in one mohalla.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <SectionTitle count={sorted.length}>
          <Clock className="size-5 self-center" /> Locations
        </SectionTitle>
        {sorted.length ? (
          <ul className="space-y-2.5">
            {sorted.map((l) => (
              <LocationItem key={l.id} location={l} />
            ))}
          </ul>
        ) : (
          <EmptyNote>No locations assigned yet.</EmptyNote>
        )}
      </section>

      <section>
        <SectionTitle count={members.length}>Members</SectionTitle>
        {members.length ? (
          <ul className="space-y-2.5">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} isYou={m.id === youId} />
            ))}
          </ul>
        ) : (
          <EmptyNote>No members in this group yet.</EmptyNote>
        )}
      </section>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
