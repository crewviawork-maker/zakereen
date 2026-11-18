import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ADMIN_ITS_ID,
  endSession,
  readSession,
  requireAdmin,
  requireMember,
  writeSession,
} from "./session.server";
import {
  autoPair,
  findTimeConflict,
  formatTime,
  mohallaKey,
  normalizeTime,
  type Group,
  type Location,
  type Member,
  type MemberRole,
} from "./roster";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function friendly(error: { code?: string; message: string }, what: string): never {
  if (error.code === "23505") {
    if (error.message.includes("one_tipper"))
      throw new Error("This group already has a tipper. A group can have only one tipper.");
    if (error.message.includes("its_id")) throw new Error("This ITS ID is already added.");
    if (error.message.includes("groups_name")) throw new Error("A group with this name already exists.");
    if (error.message.includes("group_timing"))
      throw new Error("This group already has a location at that time.");
    if (error.message.includes("locations_unique_slot"))
      throw new Error("This mohalla, address and time already exist.");
  }
  console.error(what, error);
  throw new Error(`Could not ${what}. Please try again.`);
}

const itsSchema = z
  .string()
  .trim()
  .regex(/^\d{8}$/, "ITS ID must be 8 digits");
const idSchema = z.string().uuid();
const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Pick a valid time")
  .transform((t) => t.slice(0, 5));

/* ---------------- Auth ---------------- */

export type AuthState = { role: "admin" } | { role: "member"; name: string } | null;

export const getAuth = createServerFn({ method: "GET" }).handler(async (): Promise<AuthState> => {
  const s = await readSession();
  if (s.role === "admin") return { role: "admin" };
  if (s.role === "member" && s.memberId) {
    const { data } = await (await db())
      .from("members")
      .select("name")
      .eq("id", s.memberId)
      .maybeSingle();
    if (data) return { role: "member", name: data.name };
  }
  return null;
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ itsId: itsSchema }).parse(d))
  .handler(async ({ data }) => {
    if (data.itsId === ADMIN_ITS_ID) {
      await writeSession({ role: "admin" });
      return { role: "admin" as const };
    }
    const { data: member, error } = await (await db())
      .from("members")
      .select("id")
      .eq("its_id", data.itsId)
      .maybeSingle();
    if (error) friendly(error, "sign you in");
    if (!member) throw new Error("This ITS ID is not registered. Please contact the admin.");
    await writeSession({ role: "member", memberId: member.id });
    return { role: "member" as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await endSession();
  return { ok: true };
});

/* ---------------- Admin data ---------------- */

export type AdminData = { groups: Group[]; members: Member[]; locations: Location[] };

export const getAdminData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminData> => {
    await requireAdmin();
    const sb = await db();
    const [g, m, l] = await Promise.all([
      sb.from("groups").select("id, name").order("name"),
      sb.from("members").select("id, name, its_id, phone, role, group_id").order("name"),
      sb.from("locations").select("id, mohalla, address, timing, group_id").order("timing"),
    ]);
    if (g.error) friendly(g.error, "load groups");
    if (m.error) friendly(m.error, "load members");
    if (l.error) friendly(l.error, "load locations");
    return { groups: g.data, members: m.data as Member[], locations: l.data };
  },
);

/* ---------------- Members ---------------- */

const memberInput = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  itsId: itsSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{7,20}$/, "Enter a valid contact number"),
  role: z.enum(["tipper", "chorus"]),
  groupId: idSchema.nullable(),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{7,20}$/, "Enter a valid contact number");

async function assertNoOtherTipper(groupId: string | null, memberId?: string) {
  if (!groupId) return;
  let q = (await db())
    .from("members")
    .select("name")
    .eq("group_id", groupId)
    .eq("role", "tipper");
  if (memberId) q = q.neq("id", memberId);
  const { data, error } = await q.maybeSingle();
  if (error) friendly(error, "check the group's tipper");
  if (data) throw new Error(`This group already has a tipper (${data.name}). A group can have only one tipper.`);
}

export const saveMember = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => memberInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.itsId === ADMIN_ITS_ID) throw new Error("That ITS ID is reserved for the admin.");
    if (data.role === "tipper") await assertNoOtherTipper(data.groupId, data.id);
    const row = {
      name: data.name,
      its_id: data.itsId,
      phone: data.phone,
      role: data.role,
      group_id: data.groupId,
    };
    const sb = await db();
    const { error } = data.id
      ? await sb.from("members").update(row).eq("id", data.id)
      : await sb.from("members").insert(row);
    if (error) friendly(error, "save member");
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await (await db()).from("members").delete().eq("id", data.id);
    if (error) friendly(error, "delete member");
    return { ok: true };
  });

/* ---------------- Groups ---------------- */

export const saveGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: idSchema.optional(),
        name: z.string().trim().min(1, "Group name is required").max(80),
        tipperId: idSchema,
        memberIds: z.array(idSchema).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const chorusIds = data.memberIds.filter((id) => id !== data.tipperId);
    const allIds = [data.tipperId, ...chorusIds];

    // Validate picks: one tipper, chorus only, and nobody who is already in another group.
    const { data: picked, error: pickError } = await sb
      .from("members")
      .select("id, name, role, group_id")
      .in("id", allIds);
    if (pickError) friendly(pickError, "check members");
    const tipper = picked.find((m) => m.id === data.tipperId);
    if (!tipper || tipper.role !== "tipper") throw new Error("Please pick a tipper for this group.");
    const wrongRole = picked.find((m) => m.id !== data.tipperId && m.role !== "chorus");
    if (wrongRole) throw new Error(`${wrongRole.name} is a tipper. A group can have only one tipper.`);
    const taken = picked.find((m) => m.group_id && m.group_id !== data.id);
    if (taken) throw new Error(`${taken.name} is already in another group.`);

    let groupId = data.id;
    if (groupId) {
      const { error } = await sb.from("groups").update({ name: data.name }).eq("id", groupId);
      if (error) friendly(error, "save group");
    } else {
      const { data: created, error } = await sb
        .from("groups")
        .insert({ name: data.name })
        .select("id")
        .single();
      if (error) friendly(error, "create group");
      groupId = created.id;
    }
    // Members removed from this group become unassigned; the picks move into it.
    const { error: clearError } = await sb
      .from("members")
      .update({ group_id: null })
      .eq("group_id", groupId)
      .not("id", "in", `(${allIds.join(",")})`);
    if (clearError) friendly(clearError, "update group members");
    const { error: setError } = await sb
      .from("members")
      .update({ group_id: groupId })
      .in("id", allIds);
    if (setError) friendly(setError, "update group members");
    return { id: groupId };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await (await db()).from("groups").delete().eq("id", data.id);
    if (error) friendly(error, "delete group");
    return { ok: true };
  });

/* ---------------- Locations ---------------- */

async function assertGroupFree(groupId: string | null, timing: string, excludeId?: string) {
  if (!groupId) return;
  const { data, error } = await (await db())
    .from("locations")
    .select("id, mohalla, address, timing, group_id")
    .eq("group_id", groupId);
  if (error) friendly(error, "check group timing");
  const clash = findTimeConflict(groupId, timing, data, excludeId);
  if (clash) {
    throw new Error(
      `This group is already at ${clash.mohalla} (${clash.address}) at ${formatTime(clash.timing)}.`,
    );
  }
}

export const saveLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: idSchema.optional(),
        mohalla: z.string().trim().min(1, "Mohalla is required").max(80),
        address: z.string().trim().min(1, "Address is required").max(300),
        timing: timeSchema,
        groupId: idSchema.nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await assertGroupFree(data.groupId, data.timing, data.id);
    const row = {
      mohalla: data.mohalla,
      address: data.address,
      timing: data.timing,
      group_id: data.groupId,
    };
    const sb = await db();
    const { error } = data.id
      ? await sb.from("locations").update(row).eq("id", data.id)
      : await sb.from("locations").insert(row);
    if (error) friendly(error, "save location");
    return { ok: true };
  });

export const assignLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: idSchema, groupId: idSchema.nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const { data: loc, error } = await sb
      .from("locations")
      .select("timing")
      .eq("id", data.id)
      .single();
    if (error) friendly(error, "find location");
    await assertGroupFree(data.groupId, loc.timing, data.id);
    const { error: upError } = await sb
      .from("locations")
      .update({ group_id: data.groupId })
      .eq("id", data.id);
    if (upError) friendly(upError, "assign group");
    return { ok: true };
  });

export const deleteLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await (await db()).from("locations").delete().eq("id", data.id);
    if (error) friendly(error, "delete location");
    return { ok: true };
  });

export const runAutoPair = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const sb = await db();
  const [g, l] = await Promise.all([
    sb.from("groups").select("id, name"),
    sb.from("locations").select("id, mohalla, address, timing, group_id"),
  ]);
  if (g.error) friendly(g.error, "load groups");
  if (l.error) friendly(l.error, "load locations");
  const { assignments, unpaired } = autoPair(g.data, l.data);
  let paired = 0;
  for (const a of assignments) {
    const { error } = await sb
      .from("locations")
      .update({ group_id: a.groupId })
      .eq("id", a.locationId)
      .is("group_id", null);
    if (!error) paired++;
  }
  return { paired, unpaired: unpaired.length };
});

/* ---------------- Bulk import ---------------- */

export type ImportReport = { added: number; skipped: { row: number; reason: string }[] };

export const importMembers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              row: z.number().int(),
              name: z.string().max(200),
              itsId: z.string().max(40),
              phone: z.string().max(40),
              role: z.enum(["tipper", "chorus"]),
            }),
          )
          .max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ImportReport> => {
    await requireAdmin();
    const sb = await db();
    const { data: existing, error } = await sb.from("members").select("its_id");
    if (error) friendly(error, "check existing members");
    const seen = new Set(existing.map((m) => m.its_id));
    const skipped: ImportReport["skipped"] = [];
    const toInsert: { name: string; its_id: string; phone: string; role: MemberRole }[] = [];
    for (const r of data.rows) {
      const name = r.name.trim();
      const its = r.itsId.trim();
      if (!name) {
        skipped.push({ row: r.row, reason: "Name is missing" });
        continue;
      }
      if (!itsSchema.safeParse(its).success) {
        skipped.push({ row: r.row, reason: `ITS ID "${its}" must be 8 digits` });
        continue;
      }
      if (its === ADMIN_ITS_ID) {
        skipped.push({ row: r.row, reason: "That ITS ID is reserved for the admin" });
        continue;
      }
      if (seen.has(its)) {
        skipped.push({ row: r.row, reason: `ITS ID ${its} is already added` });
        continue;
      }
      const phone = phoneSchema.safeParse(r.phone);
      if (!phone.success) {
        skipped.push({ row: r.row, reason: `Contact "${r.phone}" is not a valid number` });
        continue;
      }
      seen.add(its);
      toInsert.push({ name, its_id: its, phone: phone.data, role: r.role });
    }
    if (toInsert.length) {
      const { error: insError } = await sb.from("members").insert(toInsert);
      if (insError) friendly(insError, "add members");
    }
    return { added: toInsert.length, skipped };
  });

export const importLocations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              row: z.number().int(),
              mohalla: z.string().max(200),
              address: z.string().max(400),
              timing: z.string().nullable(),
              groupName: z.string().max(200),
            }),
          )
          .max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ImportReport> => {
    await requireAdmin();
    const sb = await db();
    const [g, l] = await Promise.all([
      sb.from("groups").select("id, name"),
      sb.from("locations").select("id, mohalla, address, timing, group_id"),
    ]);
    if (g.error) friendly(g.error, "load groups");
    if (l.error) friendly(l.error, "load locations");
    const groupByName = new Map(g.data.map((x) => [x.name.trim().toLowerCase(), x]));
    const known: Location[] = [...l.data];
    const slotKey = (m: string, a: string, t: string) =>
      `${mohallaKey(m)}|${a.trim().toLowerCase()}|${normalizeTime(t)}`;
    const slots = new Set(known.map((x) => slotKey(x.mohalla, x.address, x.timing)));
    const skipped: ImportReport["skipped"] = [];
    const toInsert: { mohalla: string; address: string; timing: string; group_id: string | null }[] = [];

    for (const r of data.rows) {
      const mohalla = r.mohalla.trim();
      const address = r.address.trim();
      if (!mohalla || !address) {
        skipped.push({ row: r.row, reason: "Mohalla and address are required" });
        continue;
      }
      if (!r.timing || !/^\d{2}:\d{2}$/.test(r.timing)) {
        skipped.push({ row: r.row, reason: "Timing is missing or can't be read (use e.g. 7:30 PM)" });
        continue;
      }
      const key = slotKey(mohalla, address, r.timing);
      if (slots.has(key)) {
        skipped.push({ row: r.row, reason: "This mohalla, address and time already exist" });
        continue;
      }
      let groupId: string | null = null;
      const wanted = r.groupName.trim();
      if (wanted) {
        const group = groupByName.get(wanted.toLowerCase());
        if (!group) {
          skipped.push({ row: r.row, reason: `Group "${wanted}" not found` });
          continue;
        }
        const clash = findTimeConflict(group.id, r.timing, known);
        if (clash) {
          skipped.push({
            row: r.row,
            reason: `${group.name} is already at ${clash.mohalla} (${clash.address}) at ${formatTime(clash.timing)}`,
          });
          continue;
        }
        groupId = group.id;
      }
      slots.add(key);
      known.push({ id: `new-${r.row}`, mohalla, address, timing: r.timing, group_id: groupId });
      toInsert.push({ mohalla, address, timing: r.timing, group_id: groupId });
    }
    if (toInsert.length) {
      const { error } = await sb.from("locations").insert(toInsert);
      if (error) friendly(error, "add locations");
    }
    return { added: toInsert.length, skipped };
  });

/* ---------------- Member view ---------------- */

export type MyGroupData = {
  me: Member;
  group: Group | null;
  members: Member[];
  locations: Location[];
};

export const getMyGroup = createServerFn({ method: "GET" }).handler(
  async (): Promise<MyGroupData> => {
    const memberId = await requireMember();
    const sb = await db();
    const { data: me, error } = await sb
      .from("members")
      .select("id, name, its_id, phone, role, group_id")
      .eq("id", memberId)
      .single();
    if (error) friendly(error, "load your details");
    if (!me.group_id) return { me: me as Member, group: null, members: [], locations: [] };
    const [g, m, l] = await Promise.all([
      sb.from("groups").select("id, name").eq("id", me.group_id).single(),
      sb
        .from("members")
        .select("id, name, its_id, phone, role, group_id")
        .eq("group_id", me.group_id)
        .order("name"),
      sb
        .from("locations")
        .select("id, mohalla, address, timing, group_id")
        .eq("group_id", me.group_id)
        .order("timing"),
    ]);
    if (g.error) friendly(g.error, "load your group");
    if (m.error) friendly(m.error, "load your group");
    if (l.error) friendly(l.error, "load your locations");
    return { me: me as Member, group: g.data, members: m.data as Member[], locations: l.data };
  },
);
