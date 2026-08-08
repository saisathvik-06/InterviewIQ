import { z } from "zod";
import rawCurriculum from "../../data/curriculum.json";

export const dayTypeSchema = z.enum([
  "SETUP",
  "BUILD",
  "LEARN",
  "AI_CORE",
  "SHIP_IT",
  "OPTIMIZE",
  "CAPSTONE",
]);

const daySchema = z.object({
  day: z.number().int().min(1).max(31),
  title: z.string().min(1),
  type: dayTypeSchema,
  tools: z.array(z.string().min(1)).min(1),
  objectives: z.array(z.string().min(1)).min(1),
});

const moduleSchema = z.object({
  n: z.number().int().positive(),
  title: z.string().min(1),
  days: z.tuple([z.number().int(), z.number().int()]),
});

const curriculumSchema = z.object({
  cohort: z.string().min(1),
  modules: z.array(moduleSchema),
  days: z.array(daySchema),
});

export type Day = z.infer<typeof daySchema>;
export type Module = z.infer<typeof moduleSchema>;
export type Curriculum = z.infer<typeof curriculumSchema>;

const curriculum: Curriculum = curriculumSchema.parse(rawCurriculum);

const dayByNumber = new Map<number, Day>(curriculum.days.map((d) => [d.day, d]));

export function getDay(day: number): Day | undefined {
  return dayByNumber.get(day);
}

export function getModuleForDay(day: number): Module | undefined {
  return curriculum.modules.find(
    (m) => day >= m.days[0] && day <= m.days[1],
  );
}

export function allDays(): Day[] {
  return curriculum.days;
}

export function allModules(): Module[] {
  return curriculum.modules;
}

export { curriculum };
