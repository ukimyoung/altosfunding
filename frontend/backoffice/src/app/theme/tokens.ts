// 다크/라이트 모드에 따라 inline style에서 공통으로 사용하는 색상 토큰입니다.
// App과 shared UI 컴포넌트가 같은 기준으로 색을 계산하도록 한곳에 둡니다.

export function tok(dark: boolean) {
  return {
    surface: dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    surface3: dark ? "#232C44" : "#E8EAF0",
    border: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text: dark ? "#E8EAF0" : "#1A1A1A",
    textSec: dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    pageBg: dark ? "#0A0F1E" : "#F4F5F7",
    sidebarBg: dark ? "#0F1829" : "#ffffff",
    headerBg: dark ? "#0F1829" : "#ffffff",
    accent: "#7C6AF7",
    accentBg: "rgba(124,106,247,0.12)",
    accentBd: "rgba(124,106,247,0.2)",
  };
}

export type Tok = ReturnType<typeof tok>;
