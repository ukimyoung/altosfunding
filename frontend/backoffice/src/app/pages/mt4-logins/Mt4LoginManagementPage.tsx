import { useState } from "react";
import { Mt4LoginManagement } from "../../components/mt4-logins/Mt4LoginManagement";
import { Toast } from "../../components/shared/Toast";
import { useAppShell } from "../../layouts/AppShell";

export function Mt4LoginManagementPage() {
  const { dark } = useAppShell();
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" } | null>(null);

  return (
    <>
      <Mt4LoginManagement
        dark={dark}
        onToast={(message, type = "success") => setToast({ message, type })}
      />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          dark={dark}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
