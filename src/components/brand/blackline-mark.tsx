import Image from "next/image";
import { cn } from "@/lib/utils";

const MARK = { src: "/brand/blackline-mark.png", width: 626, height: 272 };
const LOGO = { src: "/brand/blackline-logo.png", width: 812, height: 479 };
const SEAL = { src: "/brand/blackline-seal.png", width: 740, height: 742 };

const FIRM = "Blackline Public Adjusters";

/** Gold B with the horizon line. `size` is the rendered height in px. */
export function BlacklineMark({
  size = 40,
  className,
  title = FIRM,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src={MARK.src}
      alt={title}
      width={Math.round((size * MARK.width) / MARK.height)}
      height={size}
      className={cn("shrink-0 select-none", className)}
    />
  );
}

/** Full lockup: B mark over BLACKLINE / PUBLIC ADJUSTERS LLC. Size with a width class. */
export function BlacklineLogo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO.src}
      alt={`${FIRM} LLC`}
      width={LOGO.width}
      height={LOGO.height}
      priority={priority}
      className={cn("h-auto select-none", className)}
    />
  );
}

/** Round firm seal. `size` is the rendered diameter in px. */
export function BlacklineSeal({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={SEAL.src}
      alt={`${FIRM} LLC seal`}
      width={size}
      height={Math.round((size * SEAL.height) / SEAL.width)}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
