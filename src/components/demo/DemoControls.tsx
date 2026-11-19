"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastRegion";
import { useCrypt } from "@/hooks/useCrypt";
import { useDemo } from "@/hooks/useDemo";
import type { ScenarioId } from "@/types/finance";

const LEVELS = [1, 2, 3, 4, 5] as const;
const SCENARIO_PREFIX = "level-";
const RESET_MESSAGE = "Demo reset";
const ERROR_MESSAGE = "Something went wrong. Try again.";

const SCENARIO_LABEL = "Start scenario";
const LEVEL_OPTIONS: readonly SegmentedControlOption[] = LEVELS.map((level) => ({
  value: `${SCENARIO_PREFIX}${level}`,
  label: `Level ${level}`,
}));

function getLevelNumber(id: ScenarioId): string {
  return id.slice(SCENARIO_PREFIX.length);
}

/** Demo_Crypt controls: scenario switcher, reset and skip a week. Renders nothing outside the demo. */
export function DemoControls() {
  const { status } = useCrypt();
  const demo = useDemo();
  const toast = useToast();
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const scenarioLabelId = useId();

  if (status !== "demo") return null;

  const showError = () => toast.show({ tone: "danger", message: ERROR_MESSAGE });

  const handleSelect = async (value: string) => {
    const id = value as ScenarioId;
    setBusy(true);
    const result = await demo.loadScenario(id);
    setBusy(false);
    if (!result.ok) {
      showError();
      return;
    }
    setAnnouncement(`Loaded demo level ${getLevelNumber(id)}`);
  };

  const handleReset = async () => {
    setBusy(true);
    const result = await demo.reset();
    setBusy(false);
    if (!result.ok) {
      showError();
      return;
    }
    toast.show({ tone: "success", message: RESET_MESSAGE });
  };

  const handleSkip = async () => {
    setBusy(true);
    const result = await demo.skipWeek();
    setBusy(false);
    if (!result.ok) {
      showError();
      return;
    }
    toast.show({ tone: "info", message: `Skipped to ${result.value}` });
  };

  return (
    <Card title="Demo controls" headingLevel="h2">
      <div className="mt-3 flex flex-col gap-3">
        {/* Visible name: this picks the scenario to load, not the current house level. */}
        <p id={scenarioLabelId} className="text-label text-ink-secondary">
          {SCENARIO_LABEL}
        </p>
        <SegmentedControl
          aria-labelledby={scenarioLabelId}
          options={LEVEL_OPTIONS}
          value={demo.scenarioId ?? ""}
          onChange={(value) => void handleSelect(value)}
          className="max-w-full self-start overflow-x-auto"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" disabled={busy} onClick={() => void handleReset()}>
            Reset demo
          </Button>
          <Button variant="secondary" size="md" disabled={busy} onClick={() => void handleSkip()}>
            Skip to next week
          </Button>
        </div>
        <p className="sr-only" aria-live="polite" role="status">
          {announcement}
        </p>
      </div>
    </Card>
  );
}
