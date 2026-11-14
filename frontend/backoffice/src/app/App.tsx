import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { DEFAULT_APP_ROUTE, ROUTE_BY_PAGE_ID, getPageIdFromPath } from "./config/navigation";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { AppShellProvider } from "./layouts/AppShell";
import { tok } from "./theme/tokens";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageId = getPageIdFromPath(location.pathname);
  const navId = pageId === "member-detail" ? "member-list" : pageId;
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  const t = tok(dark);
  const appShell = useMemo(() => ({
    dark,
  }), [dark]);

  const handleNavSelect = (id: string) => {
    navigate(ROUTE_BY_PAGE_ID[id] ?? DEFAULT_APP_ROUTE);
  };

  return (
    <AppShellProvider value={appShell}>
      <div style={{ minHeight: "100vh", backgroundColor: t.pageBg, fontFamily: "'DM Sans','Noto Sans KR',sans-serif" }}>
        <Sidebar activeId={navId} onSelect={handleNavSelect} dark={dark} />
        <Header pageId={pageId} dark={dark} onToggleDark={() => setDark((d) => !d)} />
        <main style={{ marginLeft: 220, paddingTop: 52, minHeight: "100vh" }}>
          <Outlet />
        </main>
      </div>
    </AppShellProvider>
  );
}
