import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@team-dashboard/shared";
import { AppLayout } from "../components/layout/AppLayout";
import { sanitizeRedirect } from "../lib/authRedirect";
import { fetchAuthMe } from "../lib/api";

export type RouterContext = {
  queryClient: QueryClient;
  authUser: AuthUser | null;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location, context }) => {
    const authUser = await context.queryClient.ensureQueryData({
      queryKey: ["auth", "me"],
      queryFn: fetchAuthMe,
      staleTime: 30_000,
    });

    const isLogin = location.pathname === "/login";

    if (!authUser && !isLogin) {
      const returnTo = `${location.pathname}${location.searchStr}${location.hash}`;
      throw redirect({
        to: "/login",
        search: { redirect: returnTo },
      });
    }

    if (authUser && isLogin) {
      const raw = (location.search as { redirect?: unknown }).redirect;
      throw redirect({ href: sanitizeRedirect(raw) });
    }

    return { authUser };
  },
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname === "/login") {
    return <Outlet />;
  }

  return <AppLayout />;
}
