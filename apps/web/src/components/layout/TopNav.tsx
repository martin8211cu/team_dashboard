import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext, useRouterState } from "@tanstack/react-router";
import { HiBars3 } from "react-icons/hi2";
import { fetchHealth, logout } from "../../lib/api";
import { resolvePageTitle } from "./nav-items";
import { ThemeSelector } from "./ThemeSelector";

type TopNavProps = {
  onMenuToggle: () => void;
};

export function TopNav({ onMenuToggle }: TopNavProps) {
  const queryClient = useQueryClient();
  const authUser = useRouteContext({ from: "__root__", select: (ctx) => ctx.authUser });
  const pageTitle = useRouterState({
    select: (state) => resolvePageTitle(state.location.pathname, state.location.search),
  });

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: 30_000,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      window.location.assign("/login");
    },
  });

  const apiOnline = healthQuery.data?.status === "ok";

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
        {authUser && (
          <span className="topnav-user" title={`${authUser.email} (${authUser.role})`}>
            {authUser.name}
            {authUser.role === "admin" ? " · admin" : ""}
          </span>
        )}
        <ThemeSelector />
        <span
          className={`topnav-status${apiOnline ? " is-online" : healthQuery.isError ? " is-offline" : ""}`}
          title={apiOnline ? "API connected" : "API status"}
        >
          <span className="topnav-status-dot" />
          {apiOnline ? "API ok" : healthQuery.isLoading ? "API…" : "No API"}
        </span>
        {authUser && (
          <button
            type="button"
            className="topnav-logout-btn"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "…" : "Sign out"}
          </button>
        )}
      </div>
    </header>
  );
}
