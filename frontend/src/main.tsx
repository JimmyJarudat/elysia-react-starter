import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MenuProvider } from "@/contexts/MenuContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import router from "@/routes/router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <MenuProvider>
        <SidebarProvider>
          <ToastContainer position="top-right" autoClose={3000} newestOnTop theme="colored" />
          <RouterProvider router={router} />
        </SidebarProvider>
      </MenuProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
