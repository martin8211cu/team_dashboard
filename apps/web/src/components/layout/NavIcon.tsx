import type { IconType } from "react-icons";
import {
  HiBookmarkSquare,
  HiChartBarSquare,
  HiChatBubbleLeftRight,
  HiSquares2X2,
  HiUsers,
} from "react-icons/hi2";
import type { NavItem } from "./nav-items";

const NAV_ICONS: Record<NavItem["icon"], IconType> = {
  dashboard: HiSquares2X2,
  members: HiUsers,
  sprints: HiBookmarkSquare,
  metrics: HiChartBarSquare,
  retros: HiChatBubbleLeftRight,
};

type NavIconProps = {
  name: NavItem["icon"];
};

export function NavIcon({ name }: NavIconProps) {
  const Icon = NAV_ICONS[name];
  return <Icon aria-hidden="true" />;
}
