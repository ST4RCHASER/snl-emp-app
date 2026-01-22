import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Card,
  CardHeader,
  Spinner,
  Badge,
  Divider,
  Button,
  Field,
  Input,
  tokens,
} from "@fluentui/react-components";
import {
  Mail24Regular,
  Person24Regular,
  Building24Regular,
  Location24Regular,
  Phone24Regular,
  Calendar24Regular,
  Edit24Regular,
  ArrowLeft24Regular,
} from "@fluentui/react-icons";
import { employeeQueries, useUpdateMyProfile } from "@/api/queries/employees";
import { leaveQueries } from "@/api/queries/leaves";
import { useAuth } from "@/auth/provider";
import { useWindowRefresh } from "@/components/desktop/WindowContext";

interface ProfileFormData {
  fullName: string;
  nickname: string;
  phone: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["employees"], ["leaves"]], []);
  useWindowRefresh(queryKeys);

  const { data: myEmployee, isLoading: loadingEmployee } = useQuery(
    employeeQueries.me,
  );
  const { data: balance, isLoading: loadingBalance } = useQuery(
    leaveQueries.balance,
  );

  const updateProfile = useUpdateMyProfile();

  const [form, setForm] = useState<ProfileFormData>({
    fullName: "",
    nickname: "",
    phone: "",
    dateOfBirth: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  useEffect(() => {
    if (myEmployee && "employeeId" in myEmployee) {
      // Use employee fullName, or fall back to Google account name
      const defaultName = myEmployee.fullName || myEmployee.user?.name || "";
      setForm({
        fullName: defaultName,
        nickname: myEmployee.nickname || "",
        phone: myEmployee.phone || "",
        dateOfBirth: myEmployee.dateOfBirth
          ? new Date(myEmployee.dateOfBirth).toISOString().split("T")[0]
          : "",
        addressLine1: myEmployee.addressLine1 || "",
        addressLine2: myEmployee.addressLine2 || "",
        city: myEmployee.city || "",
        state: myEmployee.state || "",
        postalCode: myEmployee.postalCode || "",
        country: myEmployee.country || "",
      });
    }
  }, [myEmployee]);

  const handleSave = async () => {
    await updateProfile.mutateAsync(form);
    setIsEditing(false);
  };

  if (loadingEmployee || loadingBalance) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading profile..." />
      </div>
    );
  }

  // Check if myEmployee is valid (not an error response)
  const employeeData =
    myEmployee && "employeeId" in myEmployee ? myEmployee : null;

  const getRoleBadge = (role: string) => {
    const colorMap: Record<string, "brand" | "success" | "warning" | "danger"> =
      {
        DEVELOPER: "danger",
        HR: "warning",
        MANAGEMENT: "success",
        EMPLOYEE: "brand",
      };
    return (
      <Badge color={colorMap[role] || "brand"} size="large">
        {role}
      </Badge>
    );
  };

  // Build full name from employee data or fall back to Google account name
  const getFullName = () => {
    if (employeeData?.fullName) {
      return employeeData.fullName;
    }
    // Fall back to Google account name
    return user?.name || user?.email || "User";
  };

  const fullName = getFullName();

  // Edit form view
  if (isEditing) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            paddingBottom: 16,
          }}
        >
          <Button
            appearance="subtle"
            icon={<ArrowLeft24Regular />}
            onClick={() => setIsEditing(false)}
          />
          <h3 style={{ margin: 0, fontWeight: 600 }}>Edit Profile</h3>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 600,
            }}
          >
            <h4
              style={{
                gridColumn: "1 / -1",
                margin: "0 0 8px",
                color: tokens.colorNeutralForeground2,
              }}
            >
              Personal Information
            </h4>
            <Field label="Full Name" style={{ gridColumn: "1 / -1" }}>
              <Input
                value={form.fullName}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, fullName: d.value }))
                }
                placeholder={user?.name || "Enter your full name"}
              />
            </Field>
            <Field label="Nickname">
              <Input
                value={form.nickname}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, nickname: d.value }))
                }
                placeholder="Optional"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(_, d) => setForm((f) => ({ ...f, phone: d.value }))}
              />
            </Field>
            <Field label="Date of Birth" style={{ gridColumn: "1 / -1" }}>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, dateOfBirth: d.value }))
                }
              />
            </Field>

            <h4
              style={{
                gridColumn: "1 / -1",
                margin: "16px 0 8px",
                color: tokens.colorNeutralForeground2,
              }}
            >
              Address
            </h4>
            <Field label="Address Line 1" style={{ gridColumn: "1 / -1" }}>
              <Input
                value={form.addressLine1}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, addressLine1: d.value }))
                }
              />
            </Field>
            <Field label="Address Line 2" style={{ gridColumn: "1 / -1" }}>
              <Input
                value={form.addressLine2}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, addressLine2: d.value }))
                }
              />
            </Field>
            <Field label="City">
              <Input
                value={form.city}
                onChange={(_, d) => setForm((f) => ({ ...f, city: d.value }))}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={(_, d) => setForm((f) => ({ ...f, state: d.value }))}
              />
            </Field>
            <Field label="Postal Code">
              <Input
                value={form.postalCode}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, postalCode: d.value }))
                }
              />
            </Field>
            <Field label="Country">
              <Input
                value={form.country}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, country: d.value }))
                }
              />
            </Field>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
            paddingTop: 16,
          }}
        >
          <Button appearance="secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button
            appearance="primary"
            onClick={handleSave}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Profile Header */}
      <Card>
        <div
          style={{
            padding: 24,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <Avatar
            name={fullName}
            image={{ src: employeeData?.avatar || user?.image || undefined }}
            size={96}
            color="colorful"
          />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, marginBottom: 8 }}>{fullName}</h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Mail24Regular
                style={{ color: tokens.colorNeutralForeground3 }}
              />
              <span>{user?.email}</span>
            </div>
            {employeeData && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Person24Regular
                  style={{ color: tokens.colorNeutralForeground3 }}
                />
                <span>
                  Employee ID: <code>{employeeData.employeeId}</code>
                </span>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              {getRoleBadge(user?.role || "EMPLOYEE")}
            </div>
          </div>
          <Button
            appearance="subtle"
            icon={<Edit24Regular />}
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        </div>
      </Card>

      {/* Employee Details */}
      {employeeData && (
        <Card>
          <CardHeader
            header={
              <span style={{ fontWeight: 600, fontSize: 16 }}>
                Personal Details
              </span>
            }
          />
          <div style={{ padding: "0 20px 20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <InfoItem
                icon={<Building24Regular />}
                label="Department"
                value={employeeData.department || "Not assigned"}
              />
              <InfoItem
                icon={<Person24Regular />}
                label="Position"
                value={employeeData.position || "Not assigned"}
              />
              <InfoItem
                icon={<Calendar24Regular />}
                label="Date of Birth"
                value={
                  employeeData.dateOfBirth
                    ? new Date(employeeData.dateOfBirth).toLocaleDateString()
                    : "Not set"
                }
              />
              <InfoItem
                icon={<Phone24Regular />}
                label="Phone"
                value={employeeData.phone || "Not set"}
              />
            </div>

            {(employeeData.addressLine1 ||
              employeeData.city ||
              employeeData.country) && (
              <>
                <Divider style={{ margin: "16px 0" }} />
                <InfoItem
                  icon={<Location24Regular />}
                  label="Address"
                  value={
                    [
                      employeeData.addressLine1,
                      employeeData.addressLine2,
                      [
                        employeeData.city,
                        employeeData.state,
                        employeeData.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", "),
                      employeeData.country,
                    ]
                      .filter(Boolean)
                      .join("\n") || "Not set"
                  }
                />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Leave Balance */}
      {balance && (
        <Card>
          <CardHeader
            header={
              <span style={{ fontWeight: 600, fontSize: 16 }}>
                Leave Balance
              </span>
            }
          />
          <div style={{ padding: "0 20px 20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              <BalanceCard
                label="Personal Leave"
                used={balance.personal.used}
                max={balance.personal.max}
                remaining={balance.personal.remaining}
              />
              <BalanceCard
                label="Annual Leave"
                used={balance.annual.used}
                max={balance.annual.max}
                remaining={balance.annual.remaining}
              />
              <BalanceCard
                label="Sick Leave"
                used={balance.sick.used}
                max={balance.sick.max}
                remaining={balance.sick.remaining}
              />
              <BalanceCard
                label="Birthday Leave"
                used={balance.birthday?.used ?? 0}
                max={balance.birthday?.max ?? 1}
                remaining={balance.birthday?.remaining ?? 1}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ color: tokens.colorNeutralForeground3 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
          {label}
        </div>
        <div style={{ whiteSpace: "pre-line" }}>{value}</div>
      </div>
    </div>
  );
}

function BalanceCard({
  label,
  used,
  max,
  remaining,
}: {
  label: string;
  used: number;
  max: number;
  remaining: number;
}) {
  const percentage = (used / max) * 100;
  const barColor =
    percentage > 80
      ? tokens.colorPaletteRedBackground3
      : tokens.colorBrandBackground;

  return (
    <div
      style={{
        padding: 16,
        background: tokens.colorNeutralBackground3,
        borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
        {remaining}{" "}
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: tokens.colorNeutralForeground3,
          }}
        >
          remaining
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: tokens.colorNeutralBackground5,
          borderRadius: 2,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: barColor,
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
        {used} used of {max}
      </div>
    </div>
  );
}
