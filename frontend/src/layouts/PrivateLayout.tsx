import { Outlet } from "react-router-dom";
import Navbar from "";
import Sidebar from "./Sidebar";

const PrivateLayout = () => {
  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="flex-1 overflow-auto p-7 max-[900px]:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PrivateLayout;
