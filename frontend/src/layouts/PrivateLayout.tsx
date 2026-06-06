import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import LoadingSpinner from "@/common/LoadingSpinner";
import Maintenance from "@/common/Maintenance";
import SystemDocumentTitle from "@/common/SystemDocumentTitle";
import EmailVerificationReminderModal from "@/common/EmailVerificationReminderModal";
import api from "@/hooks/useApi";

interface MaintenanceStatus {
  success: boolean;
  data: { enabled: boolean; message: string };
}

interface EmailStatusResponse {
  success: boolean;
  data: {
    primaryEmail: string;
    primaryVerified: boolean;
  };
}

const PrivateLayout = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useSession();
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MaintenanceStatus>("/system-setting/maintenance/status")
      .then((res) => { if (res.data.success) setMaintenance(res.data.data); })
      .catch(() => setMaintenance({ enabled: false, message: "" }))
      .finally(() => setMaintenanceLoading(false));
  }, []);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !user?.id) {
      setUnverifiedEmail(null);
      return () => {
        active = false;
      };
    }

    api
      .get<EmailStatusResponse>("/account-security/emails")
      .then((response) => {
        if (!active || !response.data.success) return;
        setUnverifiedEmail(response.data.data.primaryVerified ? null : response.data.data.primaryEmail);
      })
      .catch(() => {
        if (active) setUnverifiedEmail(null);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id]);

  if (isLoading || maintenanceLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // SUPERADMIN ผ่านได้ตลอด — user อื่นเห็นหน้า maintenance
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  if (maintenance?.enabled && !isSuperAdmin) {
    return <Maintenance message={maintenance.message} />;
  }

  return (
    <>
      <SystemDocumentTitle />
      <div className="flex min-h-screen bg-app">
        <Sidebar />
        {/* บน mobile sidebar เป็น fixed จึงไม่กิน space — content ต้องเต็มจอ */}
        <div className="flex min-w-0 flex-1 flex-col max-[720px]:w-full">
          <Navbar />
          <main className="flex-1 overflow-auto p-7 max-[900px]:p-5">
            <Outlet />
          </main>
        </div>
      </div>
      {unverifiedEmail && (
        <EmailVerificationReminderModal email={unverifiedEmail} onClose={() => setUnverifiedEmail(null)} />
      )}
    </>
  );
};

export default PrivateLayout;
