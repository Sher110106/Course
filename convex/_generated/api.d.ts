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
import type * as analysis from "../analysis.js";
import type * as auth from "../auth.js";
import type * as config from "../config.js";
import type * as courses from "../courses.js";
import type * as dualAnalysis from "../dualAnalysis.js";
import type * as dualTranscripts from "../dualTranscripts.js";
import type * as http from "../http.js";
import type * as router from "../router.js";
import type * as utils_azure from "../utils/azure.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  analysis: typeof analysis;
  auth: typeof auth;
  config: typeof config;
  courses: typeof courses;
  dualAnalysis: typeof dualAnalysis;
  dualTranscripts: typeof dualTranscripts;
  http: typeof http;
  router: typeof router;
  "utils/azure": typeof utils_azure;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
