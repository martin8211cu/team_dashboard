import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import type { AuthUser } from "@team-dashboard/shared";
import { ApiError, changeOwnPassword, logout } from "../../lib/api";

type UserMenuProps = {
  user: AuthUser;
};

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function UserMenu({ user }: UserMenuProps) {
  const queryClient = useQueryClient();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "password">("menu");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      window.location.assign("/login");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => changeOwnPassword(password),
    onSuccess: () => {
      setPassword("");
      setConfirm("");
      setFormError(null);
      setView("menu");
      setOpen(false);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Could not update password");
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setView("menu");
        setFormError(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setView("menu");
        setFormError(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setView("menu");
    setPassword("");
    setConfirm("");
    setFormError(null);
  }

  function openPasswordView() {
    setView("password");
    setFormError(null);
  }

  const passwordValid = password.trim().length >= 6 && password === confirm;
  const busy = logoutMutation.isPending || passwordMutation.isPending;

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={busy}
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setOpen(true);
            setView("menu");
          }
        }}
      >
        <span className="user-menu-avatar" aria-hidden="true">
          {userInitials(user.name)}
        </span>
        <span className="user-menu-name">{user.name}</span>
        <HiChevronDown className="user-menu-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div id={menuId} className="user-menu-panel" role="menu">
          {view === "menu" ? (
            <>
              <div className="user-menu-header">
                <p className="user-menu-header-name">{user.name}</p>
                <p className="user-menu-header-email">{user.email}</p>
                {user.role === "admin" && <span className="user-menu-role">Admin</span>}
              </div>
              <button
                type="button"
                className="user-menu-item"
                role="menuitem"
                onClick={openPasswordView}
              >
                Change password
              </button>
              <button
                type="button"
                className="user-menu-item user-menu-item-danger"
                role="menuitem"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
              >
                {logoutMutation.isPending ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <form
              className="user-menu-password-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!passwordValid || passwordMutation.isPending) {
                  return;
                }
                if (password !== confirm) {
                  setFormError("Passwords do not match");
                  return;
                }
                passwordMutation.mutate();
              }}
            >
              <p className="user-menu-form-title">Change password</p>
              <label className="user-menu-label">
                New password
                <input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={passwordMutation.isPending}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="user-menu-label">
                Confirm
                <input
                  type="password"
                  value={confirm}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={passwordMutation.isPending}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
              {formError && <p className="user-menu-form-error">{formError}</p>}
              <div className="user-menu-form-actions">
                <button
                  type="button"
                  className="user-menu-btn-secondary"
                  disabled={passwordMutation.isPending}
                  onClick={() => {
                    setView("menu");
                    setPassword("");
                    setConfirm("");
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="user-menu-btn-primary"
                  disabled={!passwordValid || passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
