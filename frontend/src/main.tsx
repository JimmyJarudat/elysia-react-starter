import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MenuProvider } from "@/contexts/MenuContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ColorProvider } from "@/contexts/ColorContext";
import { FontProvider } from "@/contexts/FontContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SessionProvider } from "@/contexts/SessionContext";
import { SystemIdentityProvider } from "@/contexts/SystemIdentityContext";
import { RegionalProvider } from "@/contexts/RegionalContext";
import SessionExpiredModal from "@/common/SessionExpiredModal";
import router from "@/routes/router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ColorProvider>
        <FontProvider>
          <SessionProvider>
            <LanguageProvider>
              <SystemIdentityProvider>
                <RegionalProvider>
                  <MenuProvider>
                    <SidebarProvider>
                      <ToastContainer position="top-right" autoClose={3000} newestOnTop theme="colored" />
                      <SessionExpiredModal />
                      <RouterProvider router={router} />
                    </SidebarProvider>
                  </MenuProvider>
                </RegionalProvider>
              </SystemIdentityProvider>
            </LanguageProvider>
          </SessionProvider>
        </FontProvider>
      </ColorProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
