import { useState } from "react";
import { DemoOptionsManagement } from "../../components/demo-options/DemoOptionsManagement";
import { Toast } from "../../components/shared/Toast";
import { useAppShell } from "../../layouts/AppShell";

export function DemoOptionsManagementPage() {
  const { dark } = useAppShell();
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" } | null>(null);

  return (
    <>
      <DemoOptionsManagement
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
