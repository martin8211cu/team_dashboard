import type { IconType } from "react-icons";
import {
  HiBookmarkSquare,
  HiCalendarDays,
  HiChartBarSquare,
  HiChatBubbleLeftRight,
  HiSquares2X2,
  HiUser,
  HiUsers,
} from "react-icons/hi2";
import type { NavItem } from "./nav-items";

const NAV_ICONS: Record<NavItem["icon"], IconType> = {
  dashboard: HiSquares2X2,
  me: HiUser,
  members: HiUsers,
  sprints: HiBookmarkSquare,
  metrics: HiChartBarSquare,
  retros: HiChatBubbleLeftRight,
  followUp: HiCalendarDays,
};

type NavIconProps = {
  name: NavItem["icon"];
};

export function NavIcon({ name }: NavIconProps) {
  const Icon = NAV_ICONS[name];
  return <Icon aria-hidden="true" />;
}
