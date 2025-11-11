/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as activityLogs from "../activityLogs.js";
import type * as ai from "../ai.js";
import type * as assignments from "../assignments.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as auth from "../auth.js";
import type * as authCleanup from "../authCleanup.js";
import type * as b2cClients from "../b2cClients.js";
import type * as batches from "../batches.js";
import type * as clients from "../clients.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as inventoryCategories from "../inventoryCategories.js";
import type * as kitPdf from "../kitPdf.js";
import type * as kits from "../kits.js";
import type * as laserFiles from "../laserFiles.js";
import type * as operations from "../operations.js";
import type * as processingJobs from "../processingJobs.js";
import type * as programs from "../programs.js";
import type * as services from "../services.js";
import type * as userPermissions from "../userPermissions.js";
import type * as users from "../users.js";
import type * as vendorImports from "../vendorImports.js";
import type * as vendors from "../vendors.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  activityLogs: typeof activityLogs;
  ai: typeof ai;
  assignments: typeof assignments;
  "auth/emailOtp": typeof auth_emailOtp;
  auth: typeof auth;
  authCleanup: typeof authCleanup;
  b2cClients: typeof b2cClients;
  batches: typeof batches;
  clients: typeof clients;
  http: typeof http;
  inventory: typeof inventory;
  inventoryCategories: typeof inventoryCategories;
  kitPdf: typeof kitPdf;
  kits: typeof kits;
  laserFiles: typeof laserFiles;
  operations: typeof operations;
  processingJobs: typeof processingJobs;
  programs: typeof programs;
  services: typeof services;
  userPermissions: typeof userPermissions;
  users: typeof users;
  vendorImports: typeof vendorImports;
  vendors: typeof vendors;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
