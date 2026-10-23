import { useRouteContext, useRouterState } from "@tanstack/react-router";
import { HiBars3 } from "react-icons/hi2";
import { resolvePageTitle } from "./nav-items";
import { TeamMemberFilterToggle } from "../TeamMemberFilterContext";
import { ThemeSelector } from "./ThemeSelector";
import { UserMenu } from "./UserMenu";

type TopNavProps = {
  onMenuToggle: () => void;
};

export function TopNav({ onMenuToggle }: TopNavProps) {
  const authUser = useRouteContext({ from: "__root__", select: (ctx) => ctx.authUser });
  const pageTitle = useRouterState({
    select: (state) => resolvePageTitle(state.location.pathname, state.location.search),
  });

  return (
    <header className="app-topnav">
      <div className="topnav-left">
        <button
          type="button"
          className="topnav-menu-btn"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <HiBars3 aria-hidden="true" />
        </button>
        <h1 className="topnav-page-title">{pageTitle}</h1>
      </div>
      <div className="topnav-right">
        <TeamMemberFilterToggle />
        <ThemeSelector />
        {authUser && <UserMenu user={authUser} />}
      </div>
    </header>
  );
}
