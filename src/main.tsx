import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import AuthPage from "@/pages/Auth.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import PendingApproval from "./pages/PendingApproval.tsx";
import Research from "./pages/Research.tsx";
import Inventory from "./pages/Inventory.tsx";
import ProcessingJobs from "./pages/ProcessingJobs.tsx";
import BillRecords from "./pages/BillRecords.tsx";
import VendorContacts from "./pages/VendorContacts.tsx";
import Services from "./pages/Services.tsx";
import KitSheetMaker from "./pages/KitSheetMaker.tsx";
import KitBuilder from "./pages/KitBuilder.tsx";
import Clients from "@/pages/Clients.tsx";
import Assignments from "@/pages/Assignments.tsx";
import LaserFiles from "@/pages/LaserFiles.tsx";
import UserManagement from "@/pages/UserManagement.tsx";
import AdminZone from "@/pages/AdminZone.tsx";
import "./types/global.d.ts";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VlyToolbar />
    <InstrumentationProvider>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/research" element={<Research />} />
            <Route path="/kit-builder" element={<KitBuilder />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/laser-files" element={<LaserFiles />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/admin-zone" element={<AdminZone />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/processing-jobs" element={<ProcessingJobs />} />
            <Route path="/inventory/bill-records" element={<BillRecords />} />
            <Route path="/vendor-contacts" element={<VendorContacts />} />
            <Route path="/services" element={<Services />} />
            <Route path="/kit-sheet-maker" element={<KitSheetMaker />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </InstrumentationProvider>
  </StrictMode>,
);