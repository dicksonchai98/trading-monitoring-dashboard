import type { JSX, MouseEvent, PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { NavigateOptions, To } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";

const SHELL_NAVIGATION_SKELETON_DELAY_MS = 260;

interface ShellNavigationContextValue {
  isRouteLoading: boolean;
  navigateWithTransition: (to: To, options?: NavigateOptions) => void;
  createLinkClickHandler: (
    to: To,
    onNavigate?: () => void,
  ) => (event: MouseEvent<HTMLAnchorElement>) => void;
}

const ShellNavigationContext = createContext<ShellNavigationContextValue | null>(null);

function resolvePathname(to: To): string | null {
  if (typeof to === "string") {
    const [pathname] = to.split(/[?#]/, 1);
    return pathname || "/";
  }

  return to.pathname ?? null;
}

function shouldHandleClientNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (!event.currentTarget.target || event.currentTarget.target === "_self")
  );
}

export function ShellNavigationProvider({ children }: PropsWithChildren): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const [routeLoading, setRouteLoading] = useState(false);
  const [targetPathname, setTargetPathname] = useState<string | null>(null);

  const navigateWithTransition = useCallback(
    (to: To, options?: NavigateOptions): void => {
      const nextPathname = resolvePathname(to);

      if (nextPathname !== null && nextPathname === location.pathname) {
        setRouteLoading(false);
        setTargetPathname(null);
        return;
      }

      setRouteLoading(true);
      setTargetPathname(nextPathname);
      startTransition(() => {
        navigate(to, options);
      });
    },
    [location.pathname, navigate, startTransition],
  );

  const createLinkClickHandler = useCallback(
    (to: To, onNavigate?: () => void) => (event: MouseEvent<HTMLAnchorElement>): void => {
      if (!shouldHandleClientNavigation(event)) {
        return;
      }

      event.preventDefault();
      onNavigate?.();
      navigateWithTransition(to);
    },
    [navigateWithTransition],
  );

  useEffect(() => {
    if (!routeLoading || targetPathname === null) {
      return;
    }

    if (location.pathname !== targetPathname) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setRouteLoading(false);
      setTargetPathname(null);
    }, SHELL_NAVIGATION_SKELETON_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [location.pathname, routeLoading, targetPathname]);

  const value = useMemo<ShellNavigationContextValue>(
    () => ({
      isRouteLoading: routeLoading || isPending,
      navigateWithTransition,
      createLinkClickHandler,
    }),
    [createLinkClickHandler, isPending, navigateWithTransition, routeLoading],
  );

  return (
    <ShellNavigationContext.Provider value={value}>
      {children}
    </ShellNavigationContext.Provider>
  );
}

export function useShellNavigation(): ShellNavigationContextValue {
  const context = useContext(ShellNavigationContext);

  if (!context) {
    throw new Error("useShellNavigation must be used within ShellNavigationProvider");
  }

  return context;
}
