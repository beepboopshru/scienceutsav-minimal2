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
import type * as assignments from "../assignments.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as auth from "../auth.js";
import type * as clients from "../clients.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as kits from "../kits.js";
import type * as processingJobs from "../processingJobs.js";
import type * as programs from "../programs.js";
import type * as services from "../services.js";
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
  assignments: typeof assignments;
  "auth/emailOtp": typeof auth_emailOtp;
  auth: typeof auth;
  clients: typeof clients;
  http: typeof http;
  inventory: typeof inventory;
  kits: typeof kits;
  processingJobs: typeof processingJobs;
  programs: typeof programs;
  services: typeof services;
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
