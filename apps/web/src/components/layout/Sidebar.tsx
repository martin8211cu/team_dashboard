import { Link, useRouterState } from "@tanstack/react-router";
import { HiChevronLeft, HiChevronRight, HiPresentationChartLine } from "react-icons/hi2";
import { NavIcon } from "./NavIcon";
import { navSections } from "./nav-items";

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

function isNavActive(pathname: string, to: string, activePrefix?: string[]): boolean {
  if (activePrefix?.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (to === "/") {
    return pathname === "/";
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <>
      <div
        className={`sidebar-backdrop${mobileOpen ? " is-visible" : ""}`}
        onClick={onClose}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={`app-sidebar${mobileOpen ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`}
        aria-label="Main navigation"
        aria-expanded={!collapsed}
      >
        <div className="sidebar-header">
          <Link
            to="/"
            className="sidebar-brand"
            title="Team Dashboard"
            onClick={onClose}
          >
            <span className="sidebar-brand-icon" aria-hidden="true">
              <HiPresentationChartLine />
            </span>
            <span className="sidebar-brand-copy">
              <strong className="sidebar-brand-name">SMART</strong>
              <span className="sidebar-brand-sub">Team Dashboard</span>
            </span>
          </Link>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <HiChevronRight aria-hidden="true" /> : <HiChevronLeft aria-hidden="true" />}
          </button>
        </div>

        <div className="sidebar-inner">
          {navSections.map((section) => (
            <div key={section.title} className="sidebar-section">
              <p className="sidebar-section-title">{section.title}</p>
              <ul className="sidebar-nav">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.to, item.activePrefix);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`sidebar-link${active ? " is-active" : ""}`}
                        title={item.label}
                        aria-label={collapsed ? item.label : undefined}
                        onClick={onClose}
                      >
                        <span className={`sidebar-link-icon sidebar-link-icon-${item.icon}`}>
                          <NavIcon name={item.icon} />
                        </span>
                        <span className="sidebar-link-text">
                          <span className="sidebar-link-label">{item.label}</span>
                          {item.description && (
                            <span className="sidebar-link-desc">{item.description}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

      </aside>
    </>
  );
}
