import { describe, expect, it } from "vitest";
import {
  autoPair,
  findTimeConflict,
  formatTime,
  isMixedMohalla,
  parseTiming,
  pickableFor,
  rankGroupsForLocation,
  tipperOf,
  type Member,
  type Group,
  type Location,
} from "./roster";

const A: Group = { id: "a", name: "A" };
const B: Group = { id: "b", name: "B" };
const loc = (id: string, mohalla: string, timing: string, group_id: string | null = null): Location => ({
  id,
  mohalla,
  address: `${id} street`,
  timing,
  group_id,
});

describe("roster pairing rules", () => {
  it("a group cannot take two locations at the same time", () => {
    const locations = [loc("x", "Ezzy", "19:30:00", "a")];
    expect(findTimeConflict("a", "19:30", locations)?.id).toBe("x");
    expect(findTimeConflict("a", "20:00", locations)).toBeUndefined();
  });

  it("gives the clashing 7:30 PM location to another group and shares the rest fairly", () => {
    const locations = [
      loc("x", "Ezzy", "19:30"),
      loc("y", "Ezzy", "20:00"),
      loc("z", "Ezzy", "20:30"),
      loc("s", "Ezzy", "19:30"),
    ];
    const { assignments, unpaired } = autoPair([A, B], locations);
    const byLoc = Object.fromEntries(assignments.map((a) => [a.locationId, a.groupId]));
    expect(unpaired).toHaveLength(0);
    expect(byLoc["x"]).not.toBe(byLoc["s"]);
    const loadA = assignments.filter((a) => a.groupId === "a").length;
    const loadB = assignments.filter((a) => a.groupId === "b").length;
    expect([loadA, loadB].sort()).toEqual([2, 2]);
  });

  it("flags a group that has locations in two mohallas", () => {
    const locations = [loc("x", "Ezzy", "19:30", "a"), loc("m", "Mohammedi", "20:00", "a")];
    expect(isMixedMohalla("a", locations)).toBe(true);
    expect(isMixedMohalla("a", locations.slice(0, 1))).toBe(false);
  });

  it("treats mohalla names case-insensitively", () => {
    const locations = [loc("x", "Ezzy", "19:30", "a"), loc("y", " ezzy ", "20:00", "a")];
    expect(isMixedMohalla("a", locations)).toBe(false);
  });

  it("auto pairing never puts a group into a second mohalla", () => {
    const locations = [loc("x", "Ezzy", "19:30", "a"), loc("m", "Mohammedi", "20:00")];
    const { assignments, unpaired } = autoPair([A], locations);
    expect(assignments).toHaveLength(0);
    expect(unpaired.map((l) => l.id)).toEqual(["m"]);
  });

  it("suggests the group already in the same mohalla first", () => {
    const locations = [loc("x", "Ezzy", "19:30", "b")];
    const ranked = rankGroupsForLocation({ mohalla: "Ezzy", timing: "20:00" }, [A, B], locations);
    expect(ranked[0]?.group.id).toBe("b");
  });

  it("formats times for display", () => {
    expect(formatTime("19:30:00")).toBe("7:30 PM");
    expect(formatTime("08:05")).toBe("8:05 AM");
  });
});

const mem = (id: string, role: "tipper" | "chorus", group_id: string | null): Member => ({
  id,
  name: id,
  its_id: "1234567" + id.length,
  phone: "9876543210",
  role,
  group_id,
});

describe("tipper and chorus rules", () => {
  it("finds the one tipper of a group, ignoring the member being edited", () => {
    const members = [mem("t1", "tipper", "a"), mem("c1", "chorus", "a")];
    expect(tipperOf("a", members)?.id).toBe("t1");
    expect(tipperOf("a", members, "t1")).toBeUndefined();
  });

  it("only offers tippers who are not in another group", () => {
    const members = [mem("t1", "tipper", null), mem("t2", "tipper", "b"), mem("t3", "tipper", "a")];
    expect(pickableFor(undefined, members, "tipper").map((m) => m.id)).toEqual(["t1"]);
    expect(pickableFor("a", members, "tipper").map((m) => m.id)).toEqual(["t1", "t3"]);
  });

  it("only offers chorus members who are not in another group", () => {
    const members = [mem("c1", "chorus", null), mem("c2", "chorus", "b"), mem("t1", "tipper", null)];
    expect(pickableFor(undefined, members, "chorus").map((m) => m.id)).toEqual(["c1"]);
  });
});

describe("spreadsheet timing", () => {
  it("reads the common ways a time is typed", () => {
    expect(parseTiming("7:30 PM")).toBe("19:30");
    expect(parseTiming("7.30pm")).toBe("19:30");
    expect(parseTiming("8 PM")).toBe("20:00");
    expect(parseTiming("19:30")).toBe("19:30");
    expect(parseTiming("20:00:00")).toBe("20:00");
    expect(parseTiming("12:15 AM")).toBe("00:15");
  });

  it("reads Excel time cells", () => {
    expect(parseTiming(0.8125)).toBe("19:30");
  });

  it("rejects unreadable times", () => {
    expect(parseTiming("evening")).toBeNull();
    expect(parseTiming("25:00")).toBeNull();
    expect(parseTiming("")).toBeNull();
  });
});
