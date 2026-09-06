"use client";

import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/format";
import { optimizedLogoUrl } from "@/lib/logo-url";

/**
 * Avatar employeur : logo (offre ou favicon du site) via le proxy Weserv,
 * initiales si l'image casse.
 */
export function CompanyAvatar({
  name,
  logo,
  size = 44,
  className,
}: {
  name: string;
  logo?: string;
  size?: number;
  className?: string;
}) {
  const src = optimizedLogoUrl(logo, size * 2);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  const box =
    size >= 64
      ? "h-16 w-16 text-lg"
      : size >= 56
        ? "h-14 w-14 text-base"
        : size >= 48
          ? "h-12 w-12 text-sm"
          : "h-11 w-11 text-sm";

  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={cn(box, "shrink-0 rounded-lg object-contain ring-1 ring-slate-200", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        box,
        "grid shrink-0 place-items-center rounded-lg bg-brand-50 font-bold text-brand-700 ring-1 ring-brand-100",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
