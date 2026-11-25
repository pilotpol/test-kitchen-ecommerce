import { createLoginHandler } from "@repo/auth-bff";
import { authConfig } from "@/lib/auth-config";

export const GET = createLoginHandler(authConfig, "/");
