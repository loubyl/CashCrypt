import { Ghost } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { formatCentsShort } from "@/lib/utils/cents";

const CHIP_LABEL = "Poltergeist";

export type PoltergeistBannerProps = {
  /** 30-day total of small expenses, in integer cents. */
  smallExpenseTotalCents: number;
  /** Layout utilities only. */
  className?: string;
};

export function PoltergeistBanner({ smallExpenseTotalCents, className }: PoltergeistBannerProps) {
  return (
    <Card className={className}>
      <div className="flex flex-col items-start gap-3">
        <Chip tone="spirit" icon={Ghost}>
          {CHIP_LABEL}
        </Chip>
        <p className="font-sans text-body text-ink">
          A Poltergeist is haunting you: {formatCentsShort(smallExpenseTotalCents)} in small expenses in 30 days
        </p>
      </div>
    </Card>
  );
}
