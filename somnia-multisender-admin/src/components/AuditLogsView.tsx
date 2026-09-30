import React, { useState, useEffect } from "react";
import { AuditLogItem } from "../types";
import { fetchAuditLogs } from "../api";
import { FileText, Search, ShieldCheck } from "lucide-react";

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs().then((res) => {
      setLogs(res);
      setIsLoading(false);
    });
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.adminUserId.toLowerCase().includes(search.toLowerCase()) ||
      l.reason.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="panel-card">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: 16 }}>
          <div className="panel-title">
            <ShieldCheck size={18} />
            Immutable Admin Audit Trail
            <span className="badge badge-neutral">{logs.length} Entries</span>
          </div>

          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search audit trail..."
              className="input-field"
              style={{ paddingLeft: 32, marginTop: 0, width: 260 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          Every privileged action (reconciliation triggers, sponsorship pause/resume, policy updates) is recorded with operational justification.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Admin Operator</th>
                <th>Action</th>
                <th>Target Resource</th>
                <th>Mandatory Reason</th>
                <th>State Change</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      {log.adminUserId}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {log.resourceType}:{log.resourceId}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 300 }}>{log.reason}</td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {log.afterJson ? log.afterJson : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
