import { describe, expect, it } from "vitest";
import { allDays, allModules, curriculum, getDay, getModuleForDay } from "@/lib/curriculum";

describe("curriculum data", () => {
  it("has exactly 31 days numbered 1..31 with no gaps or duplicates", () => {
    const dayNumbers = allDays()
      .map((d) => d.day)
      .sort((a, b) => a - b);
    expect(dayNumbers).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("gives every day a non-empty title, tools, and objectives", () => {
    for (const day of allDays()) {
      expect(day.title.length).toBeGreaterThan(0);
      expect(day.tools.length).toBeGreaterThan(0);
      expect(day.objectives.length).toBeGreaterThan(0);
    }
  });

  it("has 8 modules whose day ranges are contiguous and cover 1..31 exactly", () => {
    const modules = [...allModules()].sort((a, b) => a.n - b.n);
    expect(modules.length).toBe(8);
    expect(modules[0].days[0]).toBe(1);
    expect(modules[modules.length - 1].days[1]).toBe(31);
    for (let i = 1; i < modules.length; i++) {
      expect(modules[i].days[0]).toBe(modules[i - 1].days[1] + 1);
    }
  });

  it("resolves getDay for every valid day and undefined outside 1..31", () => {
    expect(getDay(1)?.day).toBe(1);
    expect(getDay(31)?.day).toBe(31);
    expect(getDay(0)).toBeUndefined();
    expect(getDay(32)).toBeUndefined();
  });

  it("resolves getModuleForDay consistently with the module ranges", () => {
    for (const day of allDays()) {
      const mod = getModuleForDay(day.day);
      expect(mod).toBeDefined();
      expect(day.day).toBeGreaterThanOrEqual(mod!.days[0]);
      expect(day.day).toBeLessThanOrEqual(mod!.days[1]);
    }
  });

  it("exposes the raw cohort label", () => {
    expect(curriculum.cohort.length).toBeGreaterThan(0);
  });
});
