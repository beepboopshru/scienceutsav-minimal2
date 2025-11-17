import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type PermissionResource = 
  | "programs" | "kits" | "clients" | "b2cClients" | "batches" 
  | "assignments" | "inventory" | "vendors" | "services" 
  | "processingJobs" | "procurementJobs" | "packing" | "dispatch"
  | "discrepancyTickets" | "billTracking" | "vendorImports" 
  | "orderHistory" | "laserFiles" | "reports" | "adminZone" | "userManagement"
  | "kitStatistics" | "lms";

type PermissionAction = string;

// Role-based default permissions
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
    processingJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    procurementJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    packing: { view: true, initiate: true, validate: true, transfer: true },
    dispatch: { view: true, verify: true, dispatch: true, updateStatus: true },
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
    processingJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    procurementJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    packing: { view: true, initiate: true, validate: true, transfer: true },
    dispatch: { view: true, verify: true, dispatch: true, updateStatus: true },
    discrepancyTickets: { view: true, create: true, edit: true, resolve: true, delete: true },
    billTracking: { view: true, create: true, edit: true, updateStatus: true, delete: true },
    vendorImports: { view: true, create: true, edit: true, updatePaymentStatus: true, delete: true },
    orderHistory: { view: true, export: true },
    laserFiles: { view: true, upload: true, delete: true },
    reports: { view: true, download: true },
    adminZone: { view: true, clearAssignments: true, viewActivityLogs: true, deleteActivityLogs: true },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: true, viewStock: true, editStock: true, viewFiles: true, viewCapacityPricing: true },
    lms: { view: true, edit: true },
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
    packing: { view: false, initiate: false, validate: false, transfer: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
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
  finance: {
    programs: { view: false, create: false, edit: false, delete: false, archive: false },
    kits: { view: false, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
    clients: { view: false, create: false, edit: false, delete: false },
    b2cClients: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: false, create: false, edit: false, delete: false, editStock: false, createCategories: false, importData: false },
    vendors: { view: true, create: false, edit: false, delete: false },
    services: { view: false, create: false, edit: false, delete: false },
    processingJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    procurementJobs: { view: false, create: false, edit: false, complete: false, delete: false },
    packing: { view: false, initiate: false, validate: false, transfer: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
    discrepancyTickets: { view: false, create: false, edit: false, resolve: false, delete: false },
    billTracking: { view: true, create: true, edit: true, updateStatus: true, delete: true },
    vendorImports: { view: true, create: true, edit: true, updatePaymentStatus: true, delete: true },
    orderHistory: { view: false, export: false },
    laserFiles: { view: false, upload: false, delete: false },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: false, viewStock: false, editStock: false, viewFiles: false, viewCapacityPricing: false },
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
    packing: { view: false, initiate: false, validate: false, transfer: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
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
    packing: { view: false, initiate: false, validate: false, transfer: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
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
    packing: { view: false, initiate: false, validate: false, transfer: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
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
  operations: {
    programs: { view: false, create: false, edit: false, delete: false, archive: false },
    kits: { view: false, create: false, edit: false, delete: false, editStock: false, uploadImages: false, clone: false },
    clients: { view: false, create: false, edit: false, delete: false },
    b2cClients: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    assignments: { view: false, create: false, edit: false, delete: false, updateStatus: false },
    inventory: { view: true, create: true, edit: true, delete: true, editStock: true, createCategories: true, importData: true },
    vendors: { view: true, create: true, edit: true, delete: true },
    services: { view: true, create: true, edit: true, delete: true },
    processingJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    procurementJobs: { view: true, create: true, edit: true, complete: true, delete: true },
    packing: { view: true, initiate: true, validate: true, transfer: true },
    dispatch: { view: true, verify: true, dispatch: true, updateStatus: true },
    discrepancyTickets: { view: true, create: true, edit: true, resolve: true, delete: true },
    billTracking: { view: false, create: false, edit: false, updateStatus: false, delete: false },
    vendorImports: { view: true, create: true, edit: true, updatePaymentStatus: false, delete: false },
    orderHistory: { view: false, export: false },
    laserFiles: { view: false, upload: false, delete: false },
    reports: { view: false, download: false },
    adminZone: { view: false, clearAssignments: false, viewActivityLogs: false, deleteActivityLogs: false },
    userManagement: { view: false, approveUsers: false, manageRoles: false, managePermissions: false, deleteUsers: false },
    kitStatistics: { view: true, viewStock: true, editStock: true, viewFiles: false, viewCapacityPricing: true },
    lms: { view: false, edit: false },
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
    packing: { view: false, initiate: false, validate: false, transfer: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
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
    packing: { view: false, initiate: false, validate: false, transfer: false },
    dispatch: { view: false, verify: false, dispatch: false, updateStatus: false },
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

/**
 * Get user permissions with role-based defaults
 */
async function getUserPermissions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Record<string, Record<string, boolean>>> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");

  // Check for custom permissions
  const customPermissions = await ctx.db
    .query("userPermissions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (customPermissions) {
    return customPermissions.permissions as any;
  }

  // Fall back to role-based defaults
  const role = user.role || "content";
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.content;
}

/**
 * Check if user has permission (throws error if not)
 */
export async function checkPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  resource: PermissionResource,
  action: PermissionAction
): Promise<void> {
  const permissions = await getUserPermissions(ctx, userId);
  const resourcePerms = permissions[resource];

  if (!resourcePerms || !resourcePerms[action]) {
    throw new Error(`Permission denied: ${resource}.${action}`);
  }
}

/**
 * Check if user has permission (returns boolean)
 */
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  resource: PermissionResource,
  action: PermissionAction
): Promise<boolean> {
  try {
    const permissions = await getUserPermissions(ctx, userId);
    const resourcePerms = permissions[resource];
    return resourcePerms?.[action] === true;
  } catch {
    return false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getAllPermissions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Record<string, Record<string, boolean>>> {
  return await getUserPermissions(ctx, userId);
}