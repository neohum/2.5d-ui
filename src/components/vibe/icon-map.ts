/**
 * icon-map.ts — Mapping table from popular Lucide icon names to Flaticon UIcons Regular Rounded (fi fi-rr-*).
 * Strictly complies with the harness UI Icons Standard.
 */

export const LUCIDE_TO_FLATICON_MAP: Record<string, string> = {
  // Navigation & Directional
  "arrow-right": "fi-rr-arrow-right",
  "arrow-left": "fi-rr-arrow-left",
  "arrow-up": "fi-rr-arrow-up",
  "arrow-down": "fi-rr-arrow-down",
  "chevron-right": "fi-rr-angle-right",
  "chevron-left": "fi-rr-angle-left",
  "chevron-down": "fi-rr-angle-down",
  "chevron-up": "fi-rr-angle-up",
  "external-link": "fi-rr-arrow-up-right",

  // Actions & Controls
  search: "fi-rr-search",
  check: "fi-rr-check",
  "check-circle": "fi-rr-check",
  x: "fi-rr-cross",
  close: "fi-rr-cross",
  plus: "fi-rr-plus",
  minus: "fi-rr-minus",
  trash: "fi-rr-trash",
  "trash-2": "fi-rr-trash",
  edit: "fi-rr-edit",
  "edit-2": "fi-rr-edit",
  "edit-3": "fi-rr-edit",
  pencil: "fi-rr-pencil",
  copy: "fi-rr-copy",
  "refresh-cw": "fi-rr-refresh",
  "rotate-cw": "fi-rr-refresh",

  // Common UI Objects
  user: "fi-rr-user",
  users: "fi-rr-users",
  settings: "fi-rr-settings",
  bell: "fi-rr-bell",
  home: "fi-rr-home",
  calendar: "fi-rr-calendar",
  file: "fi-rr-document",
  "file-text": "fi-rr-document",
  folder: "fi-rr-folder",
  mail: "fi-rr-envelope",
  lock: "fi-rr-lock",
  unlock: "fi-rr-unlock",
  eye: "fi-rr-eye",
  "eye-off": "fi-rr-eye-crossed",
  info: "fi-rr-info",
  "alert-circle": "fi-rr-exclamation",
  "alert-triangle": "fi-rr-triangle-warning",

  // Media & Controls
  play: "fi-rr-play",
  pause: "fi-rr-pause",
  download: "fi-rr-download",
  upload: "fi-rr-upload",
  filter: "fi-rr-filter",
  menu: "fi-rr-menu-burger",
  "more-horizontal": "fi-rr-menu-dots",
  "more-vertical": "fi-rr-menu-dots-vertical",
  sparkles: "fi-rr-sparkles",
  code: "fi-rr-brackets",
  terminal: "fi-rr-terminal",
};

/**
 * Maps a Lucide-style icon name to its standard Flaticon Regular Rounded icon class with 'fi ' prefix.
 * Falls back to "fi fi-rr-apps" if unknown.
 */
export function mapLucideToFlaticon(lucideName: string): string {
  if (!lucideName) return "fi fi-rr-apps";
  const normalized = lucideName.trim().toLowerCase();
  if (normalized.startsWith("fi fi-rr-")) {
    return normalized;
  }
  if (normalized.startsWith("fi-rr-")) {
    return `fi ${normalized}`;
  }
  if (normalized.startsWith("fi-")) {
    return `fi fi-rr-${normalized.replace(/^fi-/, "")}`;
  }
  const mapped = LUCIDE_TO_FLATICON_MAP[normalized] || "fi-rr-apps";
  return `fi ${mapped}`;
}
