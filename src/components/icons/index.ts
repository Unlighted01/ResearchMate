// Animated Icons - Export all animated icons from itshover.com
// These work alongside lucide-react icons

export { default as TrashIcon } from "./TrashIcon";
export type { TrashIconProps } from "./TrashIcon";

export { default as GearIcon } from "./GearIcon";

export { default as CheckedIcon } from "./CheckedIcon";

export { default as DownloadIcon } from "./DownloadIcon"; // Note: DownloadIcon might be missing from list/view, but I will exclude it if not found in cache. Actually, I didn't see DownloadIcon in the list but it was in index. Wait, I saw it in list_dir! Yes, DownloadIcon.tsx was there.
export { default as CopyIcon } from "./CopyIcon";

export { default as ExternalLinkIcon } from "./ExternalLinkIcon";

// Re-export types
export type { AnimatedIconHandle, AnimatedIconProps } from "./types";
