import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const PrivateLayout = () => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PrivateLayout;
