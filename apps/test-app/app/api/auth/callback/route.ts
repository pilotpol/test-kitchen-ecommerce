import { createCallbackHandler } from "@repo/auth-bff";
import { authConfig } from "@/lib/auth-config";

export const GET = createCallbackHandler(authConfig, "/");
