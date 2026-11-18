import { useState } from "react";
import { ScheduleManagement } from "../../components/competitions/ScheduleManagement";
import { Toast } from "../../components/shared/Toast";
import { useAppShell } from "../../layouts/AppShell";

export function ScheduleManagementPage() {
  const { dark } = useAppShell();
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" } | null>(null);

  return (
    <>
      <ScheduleManagement
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
