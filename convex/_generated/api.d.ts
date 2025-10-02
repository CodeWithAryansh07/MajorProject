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
import type * as codeExecution from "../codeExecution.js";
import type * as codeExecutions from "../codeExecutions.js";
import type * as collaboration from "../collaboration.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as lemonSqueezy from "../lemonSqueezy.js";
import type * as migration from "../migration.js";
import type * as sessionActivity from "../sessionActivity.js";
import type * as sessionFiles from "../sessionFiles.js";
import type * as sessionFolders from "../sessionFolders.js";
import type * as snippets from "../snippets.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  codeExecution: typeof codeExecution;
  codeExecutions: typeof codeExecutions;
  collaboration: typeof collaboration;
  crons: typeof crons;
  files: typeof files;
  folders: typeof folders;
  http: typeof http;
  lemonSqueezy: typeof lemonSqueezy;
  migration: typeof migration;
  sessionActivity: typeof sessionActivity;
  sessionFiles: typeof sessionFiles;
  sessionFolders: typeof sessionFolders;
  snippets: typeof snippets;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
