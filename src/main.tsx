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
import KitBuilder from "./pages/KitBuilder.tsx";
import Clients from "@/pages/Clients.tsx";
import B2CClients from "@/pages/B2CClients.tsx";
import B2BAssignments from "@/pages/B2BAssignments.tsx";
import B2CAssignments from "@/pages/B2CAssignments.tsx";
import LaserFiles from "@/pages/LaserFiles.tsx";
import ViewKitFiles from "@/pages/ViewKitFiles.tsx";
import UserManagement from "@/pages/UserManagement.tsx";
import AdminZone from "@/pages/AdminZone.tsx";
import Procurement from "@/pages/Procurement.tsx";
import Packing from "@/pages/Packing.tsx";
import Dispatch from "@/pages/Dispatch.tsx";
import OperationsInventoryRelations from "@/pages/OperationsInventoryRelations.tsx";
import KitStatistics from "./pages/KitStatistics";
import LMS from "./pages/LMS";
import DiscrepancyTickets from "./pages/DiscrepancyTickets";
import BillTracking from "@/pages/BillTracking.tsx";
import OrderRecords from "./pages/OrderRecords.tsx";
import Themes from "./pages/Themes";
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

function App() {
  return (
    <>
      <RouteSyncer />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/research" element={<Research />} />
        <Route path="/kit-builder" element={<KitBuilder />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/b2c-clients" element={<B2CClients />} />
        <Route path="/b2b-assignments" element={<B2BAssignments />} />
        <Route path="/b2c-assignments" element={<B2CAssignments />} />
        <Route path="/packing" element={<Packing />} />
        <Route path="/dispatch" element={<Dispatch />} />
        <Route path="/procurement" element={<Procurement />} />
        <Route path="/operations-inventory-relations" element={<OperationsInventoryRelations />} />
        <Route path="/laser-files" element={<LaserFiles />} />
        <Route path="/view-kit-files" element={<ViewKitFiles />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/admin-zone" element={<AdminZone />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/processing-jobs" element={<ProcessingJobs />} />
        <Route path="/inventory/bill-records" element={<BillRecords />} />
        <Route path="/vendor-contacts" element={<VendorContacts />} />
        <Route path="/services" element={<Services />} />
        <Route path="/kit-statistics" element={<KitStatistics />} />
        <Route path="/lms" element={<LMS />} />
        <Route path="/discrepancy-tickets" element={<DiscrepancyTickets />} />
        <Route path="/bill-tracking" element={<BillTracking />} />
        <Route path="/order-records" element={<OrderRecords />} />
        <Route path="/themes" element={<Themes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VlyToolbar />
    <InstrumentationProvider>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </ConvexAuthProvider>
    </InstrumentationProvider>
  </StrictMode>,
);