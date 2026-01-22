import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Tab,
  TabList,
  Badge,
  Spinner,
  Card,
  CardHeader,
  Input,
  Select,
  Button,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  Search24Regular,
  ArrowClockwise24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Info16Regular,
  Warning16Regular,
  ErrorCircle16Regular,
  Checkmark16Regular,
} from "@fluentui/react-icons";
import {
  auditQueries,
  type ActionLog,
  type ApiLog,
  type ActionLogFilters,
  type ApiLogFilters,
} from "@/api/queries/audit";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { useMobile } from "@/hooks/useMobile";

export default function AuditLogs() {
  const [activeTab, setActiveTab] = useState<string>("actions");
  const isMobile = useMobile();

  // Action logs filters
  const [actionFilters, setActionFilters] = useState<ActionLogFilters>({
    page: 1,
    limit: 50,
  });

  // API logs filters
  const [apiFilters, setApiFilters] = useState<ApiLogFilters>({
    page: 1,
    limit: 50,
  });

  // Search inputs (debounced)
  const [actionSearch, setActionSearch] = useState("");
  const [apiSearch, setApiSearch] = useState("");

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["audit"]], []);
  useWindowRefresh(queryKeys);

  const {
    data: actionLogsData,
    isLoading: actionsLoading,
    refetch: refetchActions,
  } = useQuery(
    auditQueries.actionLogs({
      ...actionFilters,
      search: actionSearch || undefined,
    }),
  );

  const {
    data: apiLogsData,
    isLoading: apiLoading,
    refetch: refetchApiLogs,
  } = useQuery(
    auditQueries.apiLogs({ ...apiFilters, search: apiSearch || undefined }),
  );

  const { data: stats, isLoading: statsLoading } = useQuery(auditQueries.stats);

  const handleRefresh = () => {
    if (activeTab === "actions") {
      refetchActions();
    } else {
      refetchApiLogs();
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 16,
      }}
    >
      {/* Stats Cards */}
      {!statsLoading && stats && (
        <div
          style={{
            display: "flex",
            gap: isMobile ? 8 : 12,
            flexWrap: "wrap",
          }}
        >
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 100,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  Actions Today
                </span>
              }
              description={
                <span style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.actionsToday}
                </span>
              }
            />
          </Card>
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 100,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  API Calls Today
                </span>
              }
              description={
                <span style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.apiLogsToday}
                </span>
              }
            />
          </Card>
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 100,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  Total Actions
                </span>
              }
              description={
                <span style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.totalActions}
                </span>
              }
            />
          </Card>
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 100,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: 12 }}>Errors</span>
              }
              description={
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color:
                      stats.errorCount > 0
                        ? tokens.colorPaletteRedForeground1
                        : undefined,
                  }}
                >
                  {stats.errorCount}
                </span>
              }
            />
          </Card>
        </div>
      )}

      {/* Tabs and Actions */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 12 : 0,
        }}
      >
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, d) => handleTabChange(d.value as string)}
          size={isMobile ? "small" : "medium"}
        >
          <Tab value="actions">Action Logs</Tab>
          <Tab value="api">API Logs</Tab>
        </TabList>

        <Button
          appearance="subtle"
          icon={<ArrowClockwise24Regular />}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </div>

      {/* Content */}
      {activeTab === "actions" ? (
        <ActionLogsTab
          data={actionLogsData}
          isLoading={actionsLoading}
          filters={actionFilters}
          setFilters={setActionFilters}
          search={actionSearch}
          setSearch={setActionSearch}
          isMobile={isMobile}
        />
      ) : (
        <ApiLogsTab
          data={apiLogsData}
          isLoading={apiLoading}
          filters={apiFilters}
          setFilters={setApiFilters}
          search={apiSearch}
          setSearch={setApiSearch}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

// Action Logs Tab Component
function ActionLogsTab({
  data,
  isLoading,
  filters,
  setFilters,
  search,
  setSearch,
  isMobile,
}: {
  data:
    | {
        logs: ActionLog[];
        pagination: { page: number; totalPages: number; total: number };
      }
    | undefined;
  isLoading: boolean;
  filters: ActionLogFilters;
  setFilters: (filters: ActionLogFilters) => void;
  search: string;
  setSearch: (search: string) => void;
  isMobile: boolean;
}) {
  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          contentBefore={<Search24Regular />}
          style={{ minWidth: 200, flex: isMobile ? 1 : undefined }}
        />
        <Select
          value={filters.category || ""}
          onChange={(_, d) =>
            setFilters({ ...filters, category: d.value || undefined, page: 1 })
          }
          style={{ minWidth: 120 }}
        >
          <option value="">All Categories</option>
          <option value="auth">Auth</option>
          <option value="app">App</option>
          <option value="navigation">Navigation</option>
          <option value="form">Form</option>
        </Select>
      </div>

      {/* Logs List */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isLoading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <Spinner size="medium" label="Loading..." />
          </div>
        ) : data?.logs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: tokens.colorNeutralForeground3,
            }}
          >
            No action logs found
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data?.logs.map((log) => (
              <ActionLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      )}
    </>
  );
}

// API Logs Tab Component
function ApiLogsTab({
  data,
  isLoading,
  filters,
  setFilters,
  search,
  setSearch,
  isMobile,
}: {
  data:
    | {
        logs: ApiLog[];
        pagination: { page: number; totalPages: number; total: number };
      }
    | undefined;
  isLoading: boolean;
  filters: ApiLogFilters;
  setFilters: (filters: ApiLogFilters) => void;
  search: string;
  setSearch: (search: string) => void;
  isMobile: boolean;
}) {
  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input
          placeholder="Search path..."
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          contentBefore={<Search24Regular />}
          style={{ minWidth: 200, flex: isMobile ? 1 : undefined }}
        />
        <Select
          value={filters.method || ""}
          onChange={(_, d) =>
            setFilters({ ...filters, method: d.value || undefined, page: 1 })
          }
          style={{ minWidth: 100 }}
        >
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </Select>
        <Select
          value={filters.statusCode?.toString() || ""}
          onChange={(_, d) =>
            setFilters({
              ...filters,
              statusCode: d.value ? parseInt(d.value) : undefined,
              page: 1,
            })
          }
          style={{ minWidth: 120 }}
        >
          <option value="">All Status</option>
          <option value="200">200 OK</option>
          <option value="201">201 Created</option>
          <option value="400">400 Bad Request</option>
          <option value="401">401 Unauthorized</option>
          <option value="403">403 Forbidden</option>
          <option value="404">404 Not Found</option>
          <option value="500">500 Server Error</option>
        </Select>
      </div>

      {/* Logs List */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isLoading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <Spinner size="medium" label="Loading..." />
          </div>
        ) : data?.logs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: tokens.colorNeutralForeground3,
            }}
          >
            No API logs found
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data?.logs.map((log) => (
              <ApiLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      )}
    </>
  );
}

// Action Log Card
function ActionLogCard({ log }: { log: ActionLog }) {
  const [expanded, setExpanded] = useState(false);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "auth":
        return "brand";
      case "app":
        return "success";
      case "navigation":
        return "informative";
      case "form":
        return "warning";
      default:
        return "informative";
    }
  };

  return (
    <Card
      style={{ padding: 12, cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <Badge
              appearance="outline"
              color={
                getCategoryColor(log.category) as
                  | "brand"
                  | "success"
                  | "warning"
                  | "informative"
              }
            >
              {log.category}
            </Badge>
            <span style={{ fontWeight: 500 }}>{log.action}</span>
          </div>
          {log.description && (
            <div
              style={{
                fontSize: 13,
                color: tokens.colorNeutralForeground2,
                marginBottom: 4,
              }}
            >
              {log.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}>
            {new Date(log.createdAt).toLocaleString()}
            {log.user && <span> | {log.user.name || log.user.email}</span>}
          </div>
        </div>
      </div>

      {expanded && log.metadata && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            background: tokens.colorNeutralBackground3,
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
            overflow: "auto",
            maxHeight: 200,
          }}
        >
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

// API Log Card
function ApiLogCard({ log }: { log: ApiLog }) {
  const [expanded, setExpanded] = useState(false);

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "success";
      case "POST":
        return "brand";
      case "PUT":
        return "warning";
      case "DELETE":
        return "danger";
      case "PATCH":
        return "warning";
      default:
        return "informative";
    }
  };

  const getStatusIcon = (status: number) => {
    if (status >= 500)
      return (
        <ErrorCircle16Regular
          style={{ color: tokens.colorPaletteRedForeground1 }}
        />
      );
    if (status >= 400)
      return (
        <Warning16Regular
          style={{ color: tokens.colorPaletteYellowForeground1 }}
        />
      );
    if (status >= 200 && status < 300)
      return (
        <Checkmark16Regular
          style={{ color: tokens.colorPaletteGreenForeground1 }}
        />
      );
    return <Info16Regular />;
  };

  const getStatusColor = (
    status: number,
  ): "success" | "warning" | "danger" | "informative" => {
    if (status >= 500) return "danger";
    if (status >= 400) return "warning";
    if (status >= 200 && status < 300) return "success";
    return "informative";
  };

  return (
    <Card
      style={{ padding: 12, cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <Badge
              appearance="filled"
              color={
                getMethodColor(log.method) as
                  | "brand"
                  | "success"
                  | "warning"
                  | "danger"
              }
            >
              {log.method}
            </Badge>
            <span style={{ fontFamily: "monospace", fontSize: 13 }}>
              {log.path}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 12,
              color: tokens.colorNeutralForeground3,
            }}
          >
            <Tooltip content={`Status: ${log.statusCode}`} relationship="label">
              <Badge
                appearance="outline"
                color={getStatusColor(log.statusCode)}
                icon={getStatusIcon(log.statusCode)}
              >
                {log.statusCode}
              </Badge>
            </Tooltip>
            <span>{log.responseTime}ms</span>
            {log.responseSize && (
              <span>{(log.responseSize / 1024).toFixed(1)}KB</span>
            )}
          </div>
          {log.error && (
            <div
              style={{
                fontSize: 12,
                color: tokens.colorPaletteRedForeground1,
                marginTop: 4,
              }}
            >
              {log.error}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: tokens.colorNeutralForeground3,
              marginTop: 4,
            }}
          >
            {new Date(log.createdAt).toLocaleString()}
            {log.user && <span> | {log.user.name || log.user.email}</span>}
          </div>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {log.query && Object.keys(log.query).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                Query Params
              </div>
              <div
                style={{
                  padding: 8,
                  background: tokens.colorNeutralBackground3,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(log.query, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {log.body && Object.keys(log.body).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                Request Body
              </div>
              <div
                style={{
                  padding: 8,
                  background: tokens.colorNeutralBackground3,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: "monospace",
                  overflow: "auto",
                  maxHeight: 200,
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(log.body, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Pagination Component
function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 8,
        borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
      }}
    >
      <span style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
        {total} total records
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button
          appearance="subtle"
          size="small"
          icon={<ChevronLeft24Regular />}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span style={{ fontSize: 13 }}>
          {page} / {totalPages}
        </span>
        <Button
          appearance="subtle"
          size="small"
          icon={<ChevronRight24Regular />}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}
