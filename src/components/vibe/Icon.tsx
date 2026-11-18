import React from "react";
import { LUCIDE_TO_FLATICON_MAP, mapLucideToFlaticon } from "./icon-map.ts";

export { LUCIDE_TO_FLATICON_MAP, mapLucideToFlaticon };

export interface VibeIconProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

const SIZE_CLASSES = {
  sm: "text-sm",       // ~14px
  md: "text-base",     // ~16px
  lg: "text-lg",       // ~18px
  xl: "text-xl",       // ~20px
};

/**
 * Standard Vibe Icon component.
 * Strictly renders Flaticon Regular Rounded (fi fi-rr-*) font icons.
 * Automatically translates Lucide icon names to compliant Flaticon equivalents.
 */
export function VibeIcon({
  name,
  size = "md",
  className = "",
  "aria-hidden": ariaHidden = true,
  ...props
}: VibeIconProps) {
  const flaticonClass = mapLucideToFlaticon(name);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <i
      className={`${flaticonClass} ${sizeClass} inline-flex items-center justify-center leading-none select-none ${className}`}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
}

export const Icon = VibeIcon;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  iconName: string;
  ariaLabel: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Interactive icon button guaranteed to meet the 44px minimum touch target.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  iconName,
  ariaLabel,
  size = "md",
  className = "",
  disabled,
  ...props
}) => {
  // Always guarantee 44px min touch target, symmetric border, perfect centering
  const baseClasses =
    "min-h-[44px] min-w-[44px] inline-flex items-center justify-center leading-none whitespace-nowrap rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors";

  return (
    <button
      className={`${baseClasses} ${className}`.trim()}
      aria-label={ariaLabel}
      disabled={disabled}
      {...props}
    >
      <VibeIcon name={iconName} size={size === "lg" ? "lg" : "md"} />
    </button>
  );
};

Icon.displayName = "Icon";
IconButton.displayName = "IconButton";

export default VibeIcon;
