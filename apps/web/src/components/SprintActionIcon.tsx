import type { IconType } from "react-icons";
import {
  HiArrowDownTray,
  HiArrowPath,
  HiChartBar,
  HiChatBubbleLeftRight,
  HiClipboardDocumentCheck,
  HiDocumentArrowDown,
} from "react-icons/hi2";

export type SprintActionIconName =
  | "download"
  | "refresh"
  | "tasks"
  | "metrics"
  | "export"
  | "retro";

const ACTION_ICONS: Record<SprintActionIconName, IconType> = {
  download: HiArrowDownTray,
  refresh: HiArrowPath,
  tasks: HiClipboardDocumentCheck,
  metrics: HiChartBar,
  export: HiDocumentArrowDown,
  retro: HiChatBubbleLeftRight,
};

type SprintActionIconProps = {
  name: SprintActionIconName;
};

export function SprintActionIcon({ name }: SprintActionIconProps) {
  const Icon = ACTION_ICONS[name];
  return <Icon aria-hidden="true" />;
}
