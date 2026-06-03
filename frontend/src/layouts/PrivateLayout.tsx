import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import LoadingSpinner from "@/common/LoadingSpinner";

const PrivateLayout = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useSession();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
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
  );
};

export default PrivateLayout;
