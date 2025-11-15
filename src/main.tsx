import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import AuthPage from "@/pages/Auth.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Route, Routes, useLocation } from "react-router";
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

const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/auth",
    element: <AuthPage redirectAfterAuth="/dashboard" />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/pending-approval",
    element: <PendingApproval />,
  },
  {
    path: "/research",
    element: <Research />,
  },
  {
    path: "/kit-builder",
    element: <KitBuilder />,
  },
  {
    path: "/clients",
    element: <Clients />,
  },
  {
    path: "/b2c-clients",
    element: <B2CClients />,
  },
  {
    path: "/b2b-assignments",
    element: <B2BAssignments />,
  },
  {
    path: "/b2c-assignments",
    element: <B2CAssignments />,
  },
  {
    path: "/packing",
    element: <Packing />,
  },
  {
    path: "/dispatch",
    element: <Dispatch />,
  },
  {
    path: "/procurement",
    element: <Procurement />,
  },
  {
    path: "/operations-inventory-relations",
    element: <OperationsInventoryRelations />,
  },
  {
    path: "/laser-files",
    element: <LaserFiles />,
  },
  {
    path: "/view-kit-files",
    element: <ViewKitFiles />,
  },
  {
    path: "/user-management",
    element: <UserManagement />,
  },
  {
    path: "/admin-zone",
    element: <AdminZone />,
  },
  {
    path: "/inventory",
    element: <Inventory />,
  },
  {
    path: "/inventory/processing-jobs",
    element: <ProcessingJobs />,
  },
  {
    path: "/inventory/bill-records",
    element: <BillRecords />,
  },
  {
    path: "/vendor-contacts",
    element: <VendorContacts />,
  },
  {
    path: "/services",
    element: <Services />,
  },
  {
    path: "/kit-statistics",
    element: <KitStatistics />,
  },
  {
    path: "/lms",
    element: <LMS />,
  },
  {
    path: "/discrepancy-tickets",
    element: <DiscrepancyTickets />,
  },
  {
    path: "/bill-tracking",
    element: <BillTracking />,
  },
  {
    path: "/order-records",
    element: <OrderRecords />,
  },
  {
    path: "/themes",
    element: <Themes />,
  },
  {
    path: "/themes",
    element: <Themes />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VlyToolbar />
    <InstrumentationProvider>
      <ConvexAuthProvider client={convex}>
        <Routes>
          <Route path="/" element={<><RouteSyncer /><Landing /></>} />
          <Route path="/auth" element={<><RouteSyncer /><AuthPage redirectAfterAuth="/dashboard" /></>} />
          <Route path="/dashboard" element={<><RouteSyncer /><Dashboard /></>} />
          <Route path="/pending-approval" element={<><RouteSyncer /><PendingApproval /></>} />
          <Route path="/research" element={<><RouteSyncer /><Research /></>} />
          <Route path="/kit-builder" element={<><RouteSyncer /><KitBuilder /></>} />
          <Route path="/clients" element={<><RouteSyncer /><Clients /></>} />
          <Route path="/b2c-clients" element={<><RouteSyncer /><B2CClients /></>} />
          <Route path="/b2b-assignments" element={<><RouteSyncer /><B2BAssignments /></>} />
          <Route path="/b2c-assignments" element={<><RouteSyncer /><B2CAssignments /></>} />
          <Route path="/packing" element={<><RouteSyncer /><Packing /></>} />
          <Route path="/dispatch" element={<><RouteSyncer /><Dispatch /></>} />
          <Route path="/procurement" element={<><RouteSyncer /><Procurement /></>} />
          <Route path="/operations-inventory-relations" element={<><RouteSyncer /><OperationsInventoryRelations /></>} />
          <Route path="/laser-files" element={<><RouteSyncer /><LaserFiles /></>} />
          <Route path="/view-kit-files" element={<><RouteSyncer /><ViewKitFiles /></>} />
          <Route path="/user-management" element={<><RouteSyncer /><UserManagement /></>} />
          <Route path="/admin-zone" element={<><RouteSyncer /><AdminZone /></>} />
          <Route path="/inventory" element={<><RouteSyncer /><Inventory /></>} />
          <Route path="/inventory/processing-jobs" element={<><RouteSyncer /><ProcessingJobs /></>} />
          <Route path="/inventory/bill-records" element={<><RouteSyncer /><BillRecords /></>} />
          <Route path="/vendor-contacts" element={<><RouteSyncer /><VendorContacts /></>} />
          <Route path="/services" element={<><RouteSyncer /><Services /></>} />
          <Route path="/kit-statistics" element={<><RouteSyncer /><KitStatistics /></>} />
          <Route path="/lms" element={<><RouteSyncer /><LMS /></>} />
          <Route path="/discrepancy-tickets" element={<><RouteSyncer /><DiscrepancyTickets /></>} />
          <Route path="/bill-tracking" element={<><RouteSyncer /><BillTracking /></>} />
          <Route path="/order-records" element={<><RouteSyncer /><OrderRecords /></>} />
          <Route path="/themes" element={<><RouteSyncer /><Themes /></>} />
          <Route path="*" element={<><RouteSyncer /><NotFound /></>} />
        </Routes>
        <Toaster />
      </ConvexAuthProvider>
    </InstrumentationProvider>
  </StrictMode>,
);