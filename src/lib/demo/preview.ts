// Pure builder of the Landing preview Scene. It opens no Crypt, reads no clock and
// loads no GSAP. No React, Dexie or Next.js imports.
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene/types";
import type { LocalDate, ScenarioId } from "@/types/finance";
import { buildScenario } from "./seed";

/** The fixed "now" of the preview, so the server and the client build the same model. */
export const PREVIEW_DATE: LocalDate = "2025-06-02";
export const PREVIEW_LABEL_PREFIX = "Preview of the demo house: ";

const PREVIEW_SCENARIO: ScenarioId = "level-4";

let cached: SceneModel | null = null;

function buildPreview(): SceneModel {
  const seed = buildScenario(PREVIEW_SCENARIO, PREVIEW_DATE);
  const snapshot = toFinancialSnapshot({ ...seed, plans: [] }, PREVIEW_DATE);
  const model = buildSceneModel({
    houseState: computeHouseState(snapshot),
    monthlyIncomeCents: seed.profile.monthlyIncomeCents,
    graveyard: [],
    bound: false,
  });
  return { ...model, summary: `${PREVIEW_LABEL_PREFIX}${model.summary}` };
}

/** Returns the level-4 demo Scene model. Built once, then cached. */
export function buildLandingPreview(): SceneModel {
  if (cached === null) cached = buildPreview();
  return cached;
}
