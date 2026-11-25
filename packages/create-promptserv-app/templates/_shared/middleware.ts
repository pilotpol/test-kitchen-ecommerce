import { withPromptServAuth } from "@repo/ai-gateway-sdk/next/middleware";
import { NextResponse } from "next/server";

export default withPromptServAuth({ NextResponse });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
};
