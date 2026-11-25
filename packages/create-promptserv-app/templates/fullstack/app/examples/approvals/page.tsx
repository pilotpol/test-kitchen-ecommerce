"use client";

import { useSession } from "@repo/ai-gateway-sdk/auth/keycloak/client";
import { ApprovalQueue } from "@repo/ai-gateway-sdk/components";

export default function ApprovalsExamplePage() {
  const { user } = useSession();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Approvals Inbox</h1>
      <p className="mt-1 text-sm text-gray-600">
        Pending HITL approvals for <strong>{user?.email}</strong>.
      </p>
      <div className="mt-4">
        <ApprovalQueue approver={user?.email ?? ""} />
      </div>
    </main>
  );
}
