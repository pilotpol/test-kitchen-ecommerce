import type { MetadataRoute } from "next";

import { isPreview } from "@/lib/preview-access";

// Read at request time: a Playground and the published app run the same image.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return isPreview() ? { rules: { userAgent: "*", disallow: "/" } } : { rules: { userAgent: "*", allow: "/" } };
}
