import type { AdvancedId, Lesson, MissionId, StageId, Text } from "./contracts";
import { V3_CHAPTERS } from "./generated/v3Chapters";
import { V3_HOMEWORK } from "./generated/v3Homework";
import { V3_LEVELS } from "./generated/v3Manifest";

export type PackHomework = {
  level: string;
  dailyTask: Text;
  groundingChapters: string[];
  checklist: Text[];
  fridayPlanRequired: boolean;
  riskDrill: Text | null;
  gaps: string[];
};

type ChapterRow = (typeof V3_CHAPTERS)[keyof typeof V3_CHAPTERS];

export function levelMeta(level: string) {
  return V3_LEVELS.find((row) => row.level === level) ?? null;
}

export function levelForTrack(id: string) {
  return (
    V3_LEVELS.find((row) => {
      if ("missionId" in row && row.missionId === id) return true;
      if ("advancedId" in row && row.advancedId === id) return true;
      return false;
    }) ?? null
  );
}

/** Chapter codes in manifest order. This is the week lesson list. */
export function chapterCodesForLevel(level: string): string[] {
  const row = levelMeta(level);
  return row ? [...row.chapters] : [];
}

export function chapterCodesForStage(stage: number): string[] {
  const row = V3_LEVELS.find((item) => item.stage === stage);
  return row ? [...row.chapters] : [];
}

function textOr(value: Text | undefined, fallback: Text): Text {
  return value ?? fallback;
}

export function packLessons(
  level: string,
  missionId: MissionId | AdvancedId | "L00",
): Lesson[] {
  const meta = levelMeta(level);
  if (!meta) return [];
  const empty: Text = { fa: "STUB", en: "STUB" };
  return meta.chapters.map((code) => {
    const chapter = V3_CHAPTERS[code as keyof typeof V3_CHAPTERS] as ChapterRow | undefined;
    if (!chapter) throw new Error(`MISSING_CHAPTER:${code}`);
    const gaps = [...chapter.gaps];
    return {
      id: chapter.code,
      missionId,
      stages: [meta.stage as StageId],
      title: chapter.title,
      core: chapter.body,
      trap: textOr(chapter.trap, empty),
      reality: textOr(chapter.reality, empty),
      question: chapter.question,
      selfReviewRubric: [...chapter.selfReviewRubric],
      workedExample: chapter.workedExample,
      objectives: chapter.objectives ? [...chapter.objectives] : undefined,
      riskExample: "riskExample" in chapter ? (chapter.riskExample as Text) : undefined,
      exercises: chapter.exercises
        ? chapter.exercises.map((row) => ({
            prompt: row.prompt,
            selfCheck: row.selfCheck,
          }))
        : undefined,
      summary: chapter.summary,
      sourceRefs: [...chapter.sourceRefs],
      gaps,
      enReviewed: chapter.enReviewed,
      stub: gaps.some((gap) => gap.startsWith("STUB")),
    };
  });
}

export function homeworkForTrack(id: string): PackHomework | null {
  const level = levelForTrack(id);
  if (!level) return null;
  const row = V3_HOMEWORK[level.level as keyof typeof V3_HOMEWORK];
  if (!row) return null;
  return {
    level: row.level,
    dailyTask: row.dailyTask,
    groundingChapters: [...row.groundingChapters],
    checklist: [...row.checklist],
    fridayPlanRequired: row.fridayPlanRequired,
    riskDrill: row.riskDrill,
    gaps: [...row.gaps],
  };
}
