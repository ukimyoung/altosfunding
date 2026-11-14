import { useState } from "react";
import { X } from "lucide-react";
import type { Tok } from "../../theme/tokens";

// 모달과 Drawer 헤더에서 공통으로 사용하는 닫기 아이콘 버튼입니다.

export function ModalCloseBtn({ onClick, t }: { onClick: () => void; t: Tok }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: hov ? t.surface2 : "transparent", color: t.textHint, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s" }}
    >
      <X size={16} strokeWidth={2} />
    </button>
  );
}
