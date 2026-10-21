import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { TeamMemberFilterProvider } from "../TeamMemberFilterContext";
import { getStoredSidebarCollapsed, storeSidebarCollapsed } from "../../lib/sidebarStorage";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => getStoredSidebarCollapsed());

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      storeSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <TeamMemberFilterProvider>
      <div className={`app-layout${collapsed ? " is-sidebar-collapsed" : ""}`}>
        <Sidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className="app-shell">
          <TopNav onMenuToggle={() => setMobileOpen((open) => !open)} />
          <main className="app-main">
            <div className="app-main-inner">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TeamMemberFilterProvider>
  );
}
