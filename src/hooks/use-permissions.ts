import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./use-auth";
import { Id } from "@/convex/_generated/dataModel";

type PermissionResource = 
  | "programs" | "kits" | "clients" | "b2cClients" | "batches" 
  | "assignments" | "inventory" | "vendors" | "services" 
  | "processingJobs" | "procurementJobs" | "packing" | "dispatch"
  | "discrepancyTickets" | "billTracking" | "vendorImports" 
  | "orderHistory" | "laserFiles" | "reports" | "adminZone" | "userManagement"
  | "kitStatistics" | "lms";

type PermissionAction = string;

// Role-based default permissions (same as backend)
const ROLE_DEFAULTS: Record<string, Record<PermissionResource, Record<string, boolean>>> = {
  admin: {
    programs: { view: true, create: true, edit: true, delete: true, archive: true },
    kits: { view: true, create: true, edit: true, delete: true, editStock: true, uploadImages: true, clone: true },
    clients: { view: true, create: true, edit: true, delete: true },
    b2cClients: { view: true, create: true, edit: true, delete: true },
    batches: { view: true, create: true, edit: true, delete: true },
    assignments: { view: true, create: true, edit: true, delete: true, updateStatus: true },
    inventory: { view: true, create: true, edit: true, delete: true, editStock: true, createCategories: true, importData: true },
    vendors: { view: true, create: true, edit: true, delete: true },
    services: { view: true, create: true, edit: true, delete: true },
    processingJobs: { view: true, create: true, edit: true, complete: true, delete: true, editBOM: true },
    procurementJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    packing: { view: true, initiate: true, validate: true, transfer: true, edit: true },
    dispatch: { view: true, verify: true, dispatch: true, updateStatus: true, edit: true },
    discrepancyTickets: { view: true, create: true, edit: true, resolve: true, delete: true },
    billTracking: { view: true, create: true, edit: true, updateStatus: true, delete: true },
    vendorImports: { view: true, create: true, edit: true, updatePaymentStatus: true, delete: true },
    orderHistory: { view: true, export: true },
    laserFiles: { view: true, upload: true, delete: true },
    reports: { view: true, download: true },
    adminZone: { view: true, clearAssignments: true, viewActivityLogs: true, deleteActivityLogs: true },
    userManagement: { view: true, approveUsers: true, manageRoles: true, managePermissions: true, deleteUsers: true },
    kitStatistics: { view: true, viewStock: true, editStock: true, viewFiles: true, viewCapacityPricing: true },
    lms: { view: true, edit: true },
  },
  manager: {
    programs: { view: true, create: true, edit: true, delete: true, archive: true },
    kits: { view: true, create: true, edit: true, delete: true, editStock: true, uploadImages: true, clone: true },
    clients: { view: true, create: true, edit: true, delete: true },
    b2cClients: { view: true, create: true, edit: true, delete: true },
    batches: { view: true, create: true, edit: true, delete: true },
    assignments: { view: true, create: true, edit: true, delete: true, updateStatus: true },
    inventory: { view: true, create: true, edit: true, delete: true, editStock: true, createCategories: true, importData: true },
    vendors: { view: true, create: true, edit: true, delete: true },
    services: { view: true, create: true, edit: true, delete: true },
    processingJobs: { view: true, create: true, edit: true, complete: true, delete: true, editBOM: true },
    procurementJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    packing: { view: true, initiate: true, validate: true, transfer: true, edit: true },
    dispatch: { view: true, verify: true, dispatch: true, updateStatus: true, edit: true },
    discrepancyTickets: { view: true, create: true, edit: true, resolve: true, delete: true },
    billTracking: { view: true, create: true, edit: true, updateStatus: true, delete: true },
    vendorImports: { view: true, create: true, edit: true, updatePaymentStatus: true, delete: true },
    orderHistory: { view: true, export: true },
    laserFiles: { view: true, upload: true, delete: true },
    reports: { view: true, download: true },
    adminZone: { view: true, clearAssignments: false, viewActivityLogs: true, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: true, viewStock: true, editStock: true, viewFiles: true, viewCapacityPricing: true },
    lms: { view: true, edit: true },
  },
  finance: {
    programs: { view: false, create: false, edit: false, delete: false, archive: false },
    kits: { view: true, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
    clients: { view: true, create: false, edit: false, delete: false },
    b2cClients: { view: true, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: true, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: true, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
    vendors: { view: true, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false, editBOM: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: true, create: true, edit: true, updateStatus: true, delete: true },
    vendorImports: { view: true, create: true, edit: true, updatePaymentStatus: true, delete: false },
    orderHistory: { view: true, export: true },
    laserFiles: { view: false, upload: false, delete: false },
    reports: { view: true, download: true },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: false, viewStock: false, editStock: false, viewFiles: false, viewCapacityPricing: false },
    lms: { view: false, edit: false },
  },
  operations: {
    programs: { view: false, create: false, edit: false, delete: false, archive: false },
    kits: { view: true, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
    clients: { view: true, create: false, edit: false, delete: false },
    b2cClients: { view: true, create: false, edit: false, delete: false },
    batches: { view: true, create: true, edit: true, delete: false },
    assignments: { view: true, create: true, edit: true, delete: false, updateStatus: true },
    inventory: { view: true, create: true, edit: true, delete: false, editStock: true, createCategories: false, importData: true },
    vendors: { view: true, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: true, create: true, edit: true, complete: true, delete: false, editBOM: true },
    procurementJobs: { view: true, create: true, edit: true, complete: true, delete: false },
    packing: { view: true, initiate: true, validate: true, transfer: true, edit: true },
    dispatch: { view: true, verify: true, dispatch: true, updateStatus: true, edit: true },
    discrepancyTickets: { view: true, create: true, edit: true, resolve: true, delete: false },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: false, create: false, edit: false, updatePaymentStatus: false, delete: false },
    orderHistory: { view: true, export: false },
    laserFiles: { view: false, upload: false, delete: false },
    reports: { view: true, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: true, viewStock: true, editStock: true, viewFiles: false, viewCapacityPricing: true },
    lms: { view: false, edit: false },
  },
  sales: {
    programs: { view: false, create: false, edit: false, delete: false, archive: false },
    kits: { view: false, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
    clients: { view: true, create: true, edit: true, delete: true },
    b2cClients: { view: true, create: true, edit: true, delete: true },
    batches: { view: true, create: true, edit: true, delete: true },
    assignments: { view: true, create: true, edit: true, delete: true, updateStatus: true },
    inventory: { view: false, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
    vendors: { view: false, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false, edit: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: false, create: false, edit: false, updatePaymentStatus: false, delete: false },
    orderHistory: { view: false, export: false },
    laserFiles: { view: false, upload: false, delete: false },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: true, viewStock: true, editStock: false, viewFiles: false, viewCapacityPricing: true },
    lms: { view: false, edit: false },
  },
  laser_operator: {
    programs: { view: false, create: false, edit: false, delete: false, archive: false },
    kits: { view: false, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
    clients: { view: false, create: false, edit: false, delete: false },
    b2cClients: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: false, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
    vendors: { view: false, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false, edit: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: false, create: false, edit: false, updatePaymentStatus: false, delete: false },
    orderHistory: { view: false, export: false },
    laserFiles: { view: true, upload: true, delete: true },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: false, viewStock: false, editStock: false, viewFiles: false, viewCapacityPricing: false },
    lms: { view: false, edit: false },
  },
  research_head: {
    programs: { view: true, create: true, edit: true, delete: true, archive: true },
    kits: { view: true, create: true, edit: true, delete: true, editStock: true, uploadImages: true, clone: true },
    clients: { view: false, create: false, edit: false, delete: false },
    b2cClients: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: true, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
    vendors: { view: false, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false, edit: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: false, create: false, edit: false, updatePaymentStatus: false, delete: false },
    orderHistory: { view: false, export: false },
    laserFiles: { view: true, upload: true, delete: true },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: true, viewStock: true, editStock: false, viewFiles: true, viewCapacityPricing: false },
    lms: { view: true, edit: true },
  },
  research_development: {
    programs: { view: true, create: false, edit: false, delete: false, archive: false },
    kits: { view: true, create: true, edit: true, delete: true, editStock: true, uploadImages: true, clone: true },
    clients: { view: false, create: false, edit: false, delete: false },
    b2cClients: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: true, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
    vendors: { view: false, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false, edit: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: false, create: false, edit: false, updatePaymentStatus: false, delete: false },
    orderHistory: { view: false, export: false },
    laserFiles: { view: true, upload: true, delete: true },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: true, viewStock: true, editStock: false, viewFiles: true, viewCapacityPricing: false },
    lms: { view: true, edit: true },
  },
  inventory: {
    programs: { view: false, create: false, edit: false, delete: false, archive: false },
    kits: { view: false, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
    clients: { view: false, create: false, edit: false, delete: false },
    b2cClients: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: true, create: true, edit: true, delete: true, editStock: true, createCategories: true, importData: true },
    vendors: { view: true, create: true, edit: true, delete: true },
    services: { view: true, create: true, edit: true, delete: true },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false, edit: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: true, create: true, edit: true, updatePaymentStatus: false, delete: false },
    orderHistory: { view: false, export: false },
    laserFiles: { view: false, upload: false, delete: false },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: false, viewStock: false, editStock: false, viewFiles: false, viewCapacityPricing: false },
    lms: { view: false, edit: false },
  },
  content: {
    programs: { view: true, create: false, edit: false, delete: false, archive: false },
    kits: { view: true, create: false, edit: false, delete: false, editStock: false, uploadImages: true, clone: false },
    clients: { view: false, create: false, edit: false, delete: false },
    b2cClients: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: false, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
    vendors: { view: false, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false, edit: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false, edit: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: false, create: false, edit: false, updatePaymentStatus: false, delete: false },
    orderHistory: { view: false, export: false },
    laserFiles: { view: false, upload: false, delete: false },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: false, viewStock: false, editStock: false, viewFiles: false, viewCapacityPricing: false },
    lms: { view: false, edit: false },
  },
};

export function usePermissions() {
  const { user } = useAuth();
  const customPermissions = useQuery(
    api.userPermissions.get,
    user?._id ? { userId: user._id as Id<"users"> } : "skip"
  );

  const hasPermission = (resource: PermissionResource, action: PermissionAction): boolean => {
    if (!user) return false;

    // Check custom permissions first
    if (customPermissions?.permissions) {
      const perms = customPermissions.permissions as any;
      const resourcePerms = perms[resource] as Record<string, boolean> | undefined;
      if (resourcePerms && action in resourcePerms) {
        return resourcePerms[action] === true;
      }
    }

    // Fall back to role-based defaults
    const role = user.role || "content";
    const roleDefaults = ROLE_DEFAULTS[role];
    if (roleDefaults && roleDefaults[resource]) {
      const resourcePerms = roleDefaults[resource] as Record<string, boolean>;
      return resourcePerms[action] === true;
    }

    return false;
  };

  return { hasPermission };
}