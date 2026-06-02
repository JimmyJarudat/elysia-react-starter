import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./routes/router";
import { SessionProvider } from "./contexts/SessionContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import axios from "axios";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


import "./index.css";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { MenuProvider } from "./contexts/MenuContext";

// ตั้งค่า base URL สำหรับ axios
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL;

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
  <ThemeProvider>
    {/* <ColorProvider > */}
      <LanguageProvider>
        <LoadingProvider>
          {/* <ViewModeProvider> */}
            <SessionProvider>
              <MenuProvider>
                <SidebarProvider>
                  {/* ToastContainer สำหรับการแจ้งเตือน */}
                  <ToastContainer
                    position="top-right"
                    autoClose={4000}
                    hideProgressBar={false}
                    newestOnTop={true}
                    closeOnClick
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                    toastStyle={{
                      borderRadius: "10px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  />
                  <RouterProvider router={router} />
                </SidebarProvider>
              </MenuProvider>
            </SessionProvider>
          {/* </ViewModeProvider> */}
        </LoadingProvider>
      </LanguageProvider>
    {/* </ColorProvider> */}
  </ThemeProvider>
  // </React.StrictMode >
);