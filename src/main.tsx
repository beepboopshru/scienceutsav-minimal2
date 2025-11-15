import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import AuthPage from "@/pages/Auth.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Route, Routes, useLocation, useNavigate } from "react-router";
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
import DiscrepancyTickets from "./pages/DiscrepancyTickets";
import BillTracking from "@/pages/BillTracking.tsx";
import OrderRecords from "./pages/OrderRecords.tsx";
import LMS from "./pages/LMS.tsx";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import "./types/global.d.ts";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
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
    path: "/pending-approval",
    element: <PendingApproval />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Layout>
          <Dashboard />
        </Layout>
      </ProtectedRoute>
    ),
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
    element: (
      <ProtectedRoute>
        <Layout>
          <KitStatistics />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/lms",
    element: (
      <ProtectedRoute>
        <Layout>
          <LMS />
        </Layout>
      </ProtectedRoute>
    ),
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
    path: "*",
    element: <NotFound />,
  },
]);

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
        <RouterProvider router={router} />
      </ConvexAuthProvider>
    </InstrumentationProvider>
  </StrictMode>,
);