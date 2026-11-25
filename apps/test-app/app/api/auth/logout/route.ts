import { createLogoutHandler } from "@repo/auth-bff";
import { authConfig } from "@/lib/auth-config";

export const GET = createLogoutHandler(authConfig);
