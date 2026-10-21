import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { sanitizeRedirect } from "../lib/authRedirect";
import { login } from "../lib/api";

type LoginSearch = {
  redirect: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.authUser) {
      throw redirect({ href: search.redirect });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: returnTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: () => {
      window.location.assign(returnTo);
    },
  });

  const busy = loginMutation.isPending;
  const error = (loginMutation.error as Error | null)?.message ?? null;

  return (
    <div className="login-page">
      <div className="login-card">
        <p className="login-brand">Team Dashboard</p>
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Enter your team email and password.</p>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate();
          }}
        >
          <label className="login-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            placeholder="you@example.com"
          />

          <label className="login-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            placeholder="••••••••"
          />

          <button type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}
