import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-grid size-9 shrink-0 place-items-center", className)} aria-hidden>
      <span className="absolute inset-0 rounded-[30%] bg-ink" />
      <span className="absolute left-[22%] top-[22%] size-[34%] rounded-full bg-tangerine" />
      <span className="absolute bottom-[22%] right-[22%] size-[34%] rounded-tl-full bg-lime" />
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="font-display text-xl font-extrabold">Zakereen</span>
    </span>
  );
}
