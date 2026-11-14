import { createContext, useContext } from "react";

type AppShellContextValue = {
  dark: boolean;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

export const AppShellProvider = AppShellContext.Provider;

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within AppShellProvider");
  }
  return context;
}
