import type { IconType } from "react-icons";
import {
  HiArrowPath,
  HiArrowRight,
  HiArrowTrendingUp,
  HiBugAnt,
  HiCheckCircle,
  HiClock,
  HiInboxStack,
  HiListBullet,
  HiPauseCircle,
  HiPencilSquare,
  HiPlusCircle,
  HiQueueList,
} from "react-icons/hi2";

export type KpiIconName =
  | "total"
  | "closed"
  | "open"
  | "commitment"
  | "wip"
  | "scopeCreep"
  | "bugRate"
  | "blockedTotal"
  | "leadTime"
  | "cycleTime"
  | "blocked"
  | "refinement"
  | "bugNew"
  | "bugCarried";

const KPI_ICONS: Record<KpiIconName, IconType> = {
  total: HiListBullet,
  closed: HiCheckCircle,
  open: HiClock,
  commitment: HiArrowTrendingUp,
  wip: HiQueueList,
  scopeCreep: HiPlusCircle,
  bugRate: HiBugAnt,
  blockedTotal: HiPauseCircle,
  leadTime: HiArrowRight,
  cycleTime: HiArrowPath,
  blocked: HiPauseCircle,
  refinement: HiPencilSquare,
  bugNew: HiBugAnt,
  bugCarried: HiInboxStack,
};

type KpiIconProps = {
  name: KpiIconName;
};

export function KpiIcon({ name }: KpiIconProps) {
  const Icon = KPI_ICONS[name];
  return <Icon aria-hidden="true" />;
}
