// Pure roster rules shared by the browser and the server. No I/O here.

export type Group = { id: string; name: string };
export type MemberRole = "tipper" | "chorus";
export type Member = {
  id: string;
  name: string;
  its_id: string;
  phone: string;
  role: MemberRole;
  group_id: string | null;
};
export type Location = {
  id: string;
  mohalla: string;
  address: string;
  timing: string; // "HH:MM" or "HH:MM:SS"
  group_id: string | null;
};

/** "19:30:00" -> "19:30" */
export function normalizeTime(t: string): string {
  const [h = "0", m = "0"] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/** "19:30" -> "7:30 PM" */
export function formatTime(t: string): string {
  const [h = 0, m = 0] = normalizeTime(t).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function mohallaKey(mohalla: string): string {
  return mohalla.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sortByTime<T extends { timing: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => normalizeTime(a.timing).localeCompare(normalizeTime(b.timing)));
}

export function locationsOfGroup(groupId: string, locations: Location[]): Location[] {
  return sortByTime(locations.filter((l) => l.group_id === groupId));
}

/** Distinct mohalla names (first spelling wins) for a group's locations. */
export function mohallasOfGroup(groupId: string, locations: Location[]): string[] {
  const seen = new Map<string, string>();
  for (const l of locationsOfGroup(groupId, locations)) {
    const k = mohallaKey(l.mohalla);
    if (!seen.has(k)) seen.set(k, l.mohalla.trim());
  }
  return [...seen.values()];
}

/** A group is "mixed" when its locations span more than one mohalla. */
export function isMixedMohalla(groupId: string, locations: Location[]): boolean {
  return mohallasOfGroup(groupId, locations).length > 1;
}

/** Location already given to this group at the same time (excluding one location id). */
export function findTimeConflict(
  groupId: string,
  timing: string,
  locations: Location[],
  excludeLocationId?: string,
): Location | undefined {
  const t = normalizeTime(timing);
  return locations.find(
    (l) => l.group_id === groupId && l.id !== excludeLocationId && normalizeTime(l.timing) === t,
  );
}

export type GroupOption = {
  group: Group;
  conflict: Location | undefined;
  sameMohalla: boolean;
  wouldMix: boolean;
  load: number;
};

/**
 * Rank groups for a location: free groups first, then groups already working in the same
 * mohalla, then empty groups, then groups from another mohalla (would mix); fewest locations first.
 */
export function rankGroupsForLocation(
  target: { id?: string | undefined; mohalla: string; timing: string },
  groups: Group[],
  locations: Location[],
): GroupOption[] {
  const key = mohallaKey(target.mohalla);
  const others = locations.filter((l) => l.id !== target.id);
  const options = groups.map<GroupOption>((group) => {
    const mine = others.filter((l) => l.group_id === group.id);
    const keys = new Set(mine.map((l) => mohallaKey(l.mohalla)));
    return {
      group,
      conflict: findTimeConflict(group.id, target.timing, others),
      sameMohalla: keys.has(key),
      wouldMix: keys.size > 0 && !keys.has(key),
      load: mine.length,
    };
  });
  const tier = (o: GroupOption) => (o.conflict ? 3 : o.sameMohalla ? 0 : o.wouldMix ? 2 : 1);
  return options.sort(
    (a, b) => tier(a) - tier(b) || a.load - b.load || a.group.name.localeCompare(b.group.name),
  );
}

/**
 * Pair every unassigned location with a group that is free at that time and keeps the group
 * inside one mohalla. Locations with no clean option stay unpaired (never creates a mix).
 */
export function autoPair(
  groups: Group[],
  locations: Location[],
): { assignments: { locationId: string; groupId: string }[]; unpaired: Location[] } {
  const working = locations.map((l) => ({ ...l }));
  const pending = working
    .filter((l) => !l.group_id)
    .sort(
      (a, b) =>
        mohallaKey(a.mohalla).localeCompare(mohallaKey(b.mohalla)) ||
        normalizeTime(a.timing).localeCompare(normalizeTime(b.timing)),
    );
  const assignments: { locationId: string; groupId: string }[] = [];
  const unpaired: Location[] = [];
  for (const loc of pending) {
    const best = rankGroupsForLocation(loc, groups, working).find(
      (o) => !o.conflict && !o.wouldMix,
    );
    if (best) {
      loc.group_id = best.group.id;
      assignments.push({ locationId: loc.id, groupId: best.group.id });
    } else {
      unpaired.push(loc);
    }
  }
  return { assignments, unpaired };
}

export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Plain 10-digit numbers are treated as Indian mobiles for WhatsApp.
  return digits.length === 10 ? `91${digits}` : digits;
}

export function telHref(phone: string): string {
  const trimmed = phone.trim();
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/\D/g, "")}`;
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${phoneDigits(phone)}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const TONES = ["tone-tangerine", "tone-lime", "tone-blush", "tone-mint", "tone-ink"] as const;
export function toneFor(index: number): (typeof TONES)[number] {
  return TONES[index % TONES.length] ?? "tone-tangerine";
}

/* ---------------- Tipper / Chorus ---------------- */

export function isTipper(m: { role: string }): boolean {
  return m.role === "tipper";
}

/** The tipper of a group (a group has at most one), ignoring one member id. */
export function tipperOf(
  groupId: string,
  members: Member[],
  excludeMemberId?: string,
): Member | undefined {
  return members.find((m) => m.group_id === groupId && isTipper(m) && m.id !== excludeMemberId);
}

/** Tipper first, then chorus, each alphabetically. */
export function sortMembers(list: Member[]): Member[] {
  return [...list].sort(
    (a, b) => Number(isTipper(b)) - Number(isTipper(a)) || a.name.localeCompare(b.name),
  );
}

/** Members that can be picked for a group: free ones, or already in this group. */
export function pickableFor(groupId: string | undefined, members: Member[], role: MemberRole) {
  return members.filter(
    (m) => m.role === role && (m.group_id === null || (groupId !== undefined && m.group_id === groupId)),
  );
}

/* ---------------- Spreadsheet parsing ---------------- */

/**
 * Turn a spreadsheet timing into "HH:MM". Accepts Excel time numbers (fraction of a day),
 * "19:30", "19:30:00", "7:30 PM", "7.30pm", "7 PM". Returns null when it can't be read.
 */
export function parseTiming(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = value % 1 === 0 && value > 1 ? null : value % 1;
    if (fraction === null) return null;
    const total = Math.round(fraction * 24 * 60) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  const text = String(value).trim().toLowerCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?(am|pm)?$/.exec(text);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2] ?? "0");
  const suffix = match[3];
  if (m > 59) return null;
  if (suffix) {
    if (h < 1 || h > 12) return null;
    if (suffix === "pm" && h !== 12) h += 12;
    if (suffix === "am" && h === 12) h = 0;
  } else if (h > 23 || match[2] === undefined) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Spreadsheet cell -> trimmed text (numbers keep all digits). */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  return String(value).trim();
}

/** Read "Tipper"/"Chorus" (any case); anything else counts as chorus. */
export function parseRole(value: unknown): MemberRole {
  return cellText(value).toLowerCase().startsWith("t") ? "tipper" : "chorus";
}
