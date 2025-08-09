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
import type * as courseExtraction from "../courseExtraction.js";
import type * as courseMatching from "../courseMatching.js";
import type * as courseVerification from "../courseVerification.js";
import type * as courses from "../courses.js";
import type * as dualAnalysis from "../dualAnalysis.js";
import type * as dualTranscripts from "../dualTranscripts.js";
import type * as enhancedCourseExtraction from "../enhancedCourseExtraction.js";
import type * as gradeFilter from "../gradeFilter.js";
import type * as gradeNormalization from "../gradeNormalization.js";
import type * as http from "../http.js";
import type * as maintenance from "../maintenance.js";
import type * as migration from "../migration.js";
import type * as router from "../router.js";
import type * as seedData from "../seedData.js";
import type * as testEnhancedExtraction from "../testEnhancedExtraction.js";
import type * as transcriptData from "../transcriptData.js";
import type * as transcripts from "../transcripts.js";
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
  courseExtraction: typeof courseExtraction;
  courseMatching: typeof courseMatching;
  courseVerification: typeof courseVerification;
  courses: typeof courses;
  dualAnalysis: typeof dualAnalysis;
  dualTranscripts: typeof dualTranscripts;
  enhancedCourseExtraction: typeof enhancedCourseExtraction;
  gradeFilter: typeof gradeFilter;
  gradeNormalization: typeof gradeNormalization;
  http: typeof http;
  maintenance: typeof maintenance;
  migration: typeof migration;
  router: typeof router;
  seedData: typeof seedData;
  testEnhancedExtraction: typeof testEnhancedExtraction;
  transcriptData: typeof transcriptData;
  transcripts: typeof transcripts;
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
