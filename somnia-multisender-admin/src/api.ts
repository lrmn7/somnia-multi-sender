import { AdminDashboardData, BatchItem, AuditLogItem, AdminRole } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/v1";

// Server-recognized role credentials
const ROLE_KEYS: Record<AdminRole, string> = {
  SUPER_ADMIN: import.meta.env.VITE_ADMIN_KEY_SUPER || "somnia-admin-super-key-secret-999",
  OPERATOR: import.meta.env.VITE_ADMIN_KEY_OPERATOR || "somnia-admin-operator-key-secret-888",
  FINANCE: import.meta.env.VITE_ADMIN_KEY_FINANCE || "somnia-admin-finance-key-secret-777",
  SECURITY: import.meta.env.VITE_ADMIN_KEY_SECURITY || "somnia-admin-security-key-secret-666",
};

function getAuthHeaders(role: AdminRole = "OPERATOR"): HeadersInit {
  const adminKey = ROLE_KEYS[role] || ROLE_KEYS.OPERATOR;
  return {
    "Content-Type": "application/json",
    "x-admin-key": adminKey,
    "x-admin-user": `${role.toLowerCase()}_agent`,
  };
}

export async function fetchDashboardData(role: AdminRole = "OPERATOR"): Promise<AdminDashboardData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: getAuthHeaders(role),
    });
    if (!res.ok) {
      console.warn("Failed to fetch dashboard data, status:", res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return null;
  }
}

export async function fetchTransactions(
  status = "ALL",
  wallet = "",
  role: AdminRole = "OPERATOR"
): Promise<BatchItem[]> {
  try {
    const params = new URLSearchParams();
    if (status !== "ALL") params.append("status", status);
    if (wallet) params.append("wallet", wallet);

    const res = await fetch(`${API_BASE_URL}/admin/transactions?${params.toString()}`, {
      headers: getAuthHeaders(role),
    });
    if (!res.ok) throw new Error("Failed to query transactions");
    const data = await res.json();
    return data.batches || [];
  } catch (err) {
    console.error("Transactions query error:", err);
    return [];
  }
}

export async function triggerReconciliation(
  reason: string,
  adminUserId = "operator",
  role: AdminRole = "OPERATOR"
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/reconcile`, {
    method: "POST",
    headers: getAuthHeaders(role),
    body: JSON.stringify({ reason, adminUserId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to trigger reconciliation");
  }
  return await res.json();
}

export async function toggleSponsorship(
  paused: boolean,
  reason: string,
  adminUserId = "security_officer",
  role: AdminRole = "SECURITY"
): Promise<{ message: string; paused: boolean }> {
  const res = await fetch(`${API_BASE_URL}/admin/pause-sponsorship`, {
    method: "POST",
    headers: getAuthHeaders(role),
    body: JSON.stringify({ paused, reason, adminUserId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to toggle sponsorship");
  }
  return await res.json();
}

export async function fetchAuditLogs(role: AdminRole = "SUPER_ADMIN"): Promise<AuditLogItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/audit-logs`, {
      headers: getAuthHeaders(role),
    });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    const data = await res.json();
    return data.logs || [];
  } catch (err) {
    console.error("Audit logs fetch error:", err);
    return [];
  }
}
