// Figma Make의 shadcn AlertDialog(@radix-ui)를 대신하는 가벼운 확인 팝업.
// 백오피스에는 radix 의존성이 없어서 제휴 프로그램 화면이 쓰는 부분만 같은 이름으로 구현합니다.
import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";

type Ctx = { open: boolean; setOpen: (open: boolean) => void };
const DialogContext = createContext<Ctx>({ open: false, setOpen: () => {} });

const cx = (...names: (string | undefined)[]) => names.filter(Boolean).join(" ");

export function AlertDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>{children}</DialogContext.Provider>;
}

export function AlertDialogContent({ className, children }: { className?: string; children: ReactNode }) {
  const { open, setOpen } = useContext(DialogContext);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="alertdialog" aria-modal="true" className={cx("w-full rounded-lg border shadow-lg", className)}>
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("flex flex-col gap-2", className)}>{children}</div>;
}

export function AlertDialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("flex flex-row justify-end gap-2", className)}>{children}</div>;
}

export function AlertDialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function AlertDialogDescription({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

const buttonBase = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium cursor-pointer [&_svg]:size-4";

export function AlertDialogCancel({ children }: { children: ReactNode }) {
  const { setOpen } = useContext(DialogContext);
  return <button type="button" onClick={() => setOpen(false)} className={cx(buttonBase, "border bg-background hover:bg-accent")}>{children}</button>;
}

export function AlertDialogAction({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  const { setOpen } = useContext(DialogContext);
  return (
    <button type="button" onClick={() => { onClick?.(); setOpen(false); }} className={cx(buttonBase, "bg-primary text-primary-foreground hover:bg-primary/90")}>
      {children}
    </button>
  );
}
