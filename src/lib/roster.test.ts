import { describe, expect, it } from "vitest";
import {
  autoPair,
  findTimeConflict,
  formatTime,
  isMixedMohalla,
  rankGroupsForLocation,
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
