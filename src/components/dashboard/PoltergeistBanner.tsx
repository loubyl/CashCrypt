"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Ghost } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { BANNER_HIGHLIGHT_MS } from "@/components/ui/motionTokens";
import { formatCentsShort } from "@/lib/utils/cents";

const CHIP_LABEL = "Poltergeist";
const PULSE_SCALE = 1.06;
const PULSE_DURATION_S = BANNER_HIGHLIGHT_MS / 1000;
const PULSE_SCALE_KEYFRAMES = [1, PULSE_SCALE, 1];
const PULSE_TINT_KEYFRAMES = [0, 1, 0];

export type PoltergeistBannerProps = {
  /** 30-day total of small expenses, in integer cents. */
  smallExpenseTotalCents: number;
  /** Changing this value briefly emphasizes the amount. Nothing happens under reduced motion. */
  pulseKey?: number;
  /** Layout utilities only. */
  className?: string;
};

export function PoltergeistBanner({ smallExpenseTotalCents, pulseKey, className }: PoltergeistBannerProps) {
  const reduced = useReducedMotion();
  const [pulsing, setPulsing] = useState(false);
  const [seenKey, setSeenKey] = useState(pulseKey);
  if (pulseKey !== seenKey) {
    setSeenKey(pulseKey);
    if (!reduced) setPulsing(true);
  }
  useEffect(() => {
    if (!pulsing) return;
    const timer = setTimeout(() => setPulsing(false), BANNER_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [pulsing]);
  return (
    <Card className={className}>
      <div className="flex flex-col items-start gap-3">
        <Chip tone="spirit" icon={Ghost}>
          {CHIP_LABEL}
        </Chip>
        <p className="font-sans text-body text-ink">
          A Poltergeist is haunting you:{" "}
          <span className="relative inline-block">
            <motion.span
              aria-hidden="true"
              data-part="banner-tint"
              className="absolute -inset-x-1 inset-y-0 rounded-md bg-spirit-tint opacity-0"
              animate={pulsing ? { opacity: PULSE_TINT_KEYFRAMES } : { opacity: 0 }}
              transition={{ duration: PULSE_DURATION_S }}
            />
            <motion.span
              data-part="banner-amount"
              data-pulsing={pulsing ? "true" : "false"}
              className="relative inline-block"
              animate={pulsing ? { scale: PULSE_SCALE_KEYFRAMES } : { scale: 1 }}
              transition={{ duration: PULSE_DURATION_S }}
            >
              {formatCentsShort(smallExpenseTotalCents)}
            </motion.span>
          </span>{" "}
          in small expenses in 30 days
        </p>
      </div>
    </Card>
  );
}
