"use client";

import { FlaskConical } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { useCrypt } from "@/hooks/useCrypt";
import { useNow } from "@/hooks/useNow";

/** "Demo mode" marker with the Demo_Now date. Renders nothing outside the Demo_Crypt. */
export function DemoChip() {
  const { status } = useCrypt();
  const now = useNow();
  if (status !== "demo") return null;

  return (
    <Chip tone="warning" icon={FlaskConical} className="self-start">
      {now ? `Demo mode · ${now}` : "Demo mode"}
    </Chip>
  );
}
