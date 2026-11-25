import "@repo/core-ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PromptServ Channel Chat",
  description: "AI Channel App powered by PromptServ AI Gateway",
};

import { AuthProvider } from "@repo/auth-core";
import { ProtectedRoute } from "@repo/ai-gateway-sdk/auth/keycloak/client";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className={geist.className}>
        <AuthProvider>
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}
