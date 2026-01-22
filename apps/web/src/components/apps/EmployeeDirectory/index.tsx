import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Badge,
  Spinner,
  SearchBox,
  Button,
  Input,
  Field,
  Checkbox,
  tokens,
  makeStyles,
  Dropdown,
  Option,
  Card,
} from "@fluentui/react-components";
import {
  Search24Regular,
  Edit24Regular,
  ArrowLeft24Regular,
  Mail24Regular,
  Building24Regular,
  Person24Regular,
} from "@fluentui/react-icons";
import {
  employeeQueries,
  useUpdateEmployee,
  useAssignManagers,
  useUpdateUserRole,
} from "@/api/queries/employees";
import { logAction } from "@/api/queries/audit";
import { useAuth } from "@/auth/provider";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { useMobile } from "@/hooks/useMobile";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  searchBar: {
    marginBottom: "16px",
    flexShrink: 0,
  },
  tableContainer: {
    flex: 1,
    overflow: "auto",
    minHeight: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  th: {
    textAlign: "left",
    padding: "12px 8px",
    fontWeight: 600,
    fontSize: "12px",
    color: tokens.colorNeutralForeground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
    position: "sticky",
    top: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  td: {
    padding: "12px 8px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tr: {
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  employeeCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  employeeInfo: {
    minWidth: 0,
    overflow: "hidden",
  },
  employeeName: {
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  employeeEmail: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  textCell: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  footer: {
    marginTop: "16px",
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  editButton: {
    minWidth: "auto",
    padding: "4px 8px",
  },
  // Edit form styles
  editPanel: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  editHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    paddingBottom: "16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    marginBottom: "16px",
    flexShrink: 0,
  },
  editTitle: {
    flex: 1,
    fontWeight: 600,
    fontSize: "16px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  editContent: {
    flex: 1,
    overflow: "auto",
    minHeight: 0,
    paddingRight: "8px",
  },
  editFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    paddingTop: "16px",
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    marginTop: "16px",
    flexShrink: 0,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  fullWidth: {
    gridColumn: "1 / -1",
  },
  sectionTitle: {
    gridColumn: "1 / -1",
    fontWeight: 600,
    fontSize: "13px",
    marginTop: "12px",
    marginBottom: "0",
    color: tokens.colorNeutralForeground2,
  },
  managerList: {
    gridColumn: "1 / -1",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "120px",
    overflowY: "auto",
    padding: "8px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: "4px",
  },
  managerItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
});

interface Employee {
  id: string;
  employeeId: string;
  fullName: string | null;
  nickname: string | null;
  avatar: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  department: string | null;
  position: string | null;
  salary: string | number | null;
  hireDate: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: string;
  };
}

interface EditFormData {
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
  department: string;
  position: string;
  salary: string;
  hireDate: string;
}

export default function EmployeeDirectory() {
  const styles = useStyles();
  const isMobile = useMobile();
  const [search, setSearch] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [formData, setFormData] = useState<EditFormData>({
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
    department: "",
    position: "",
    salary: "",
    hireDate: "",
  });

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["employees"]], []);
  useWindowRefresh(queryKeys);

  const {
    data: employeesData,
    isLoading,
    error,
  } = useQuery(employeeQueries.all);
  const employees = employeesData as Employee[] | undefined;
  const { data: currentManagers } = useQuery({
    ...employeeQueries.managers(editingEmployee?.id || ""),
    enabled: !!editingEmployee,
  });
  const { user } = useAuth();
  const updateEmployee = useUpdateEmployee();
  const assignManagers = useAssignManagers();
  const updateUserRole = useUpdateUserRole();

  const userRole = (user as { role?: string } | undefined)?.role;
  const isHR = userRole === "HR" || userRole === "DEVELOPER";
  const isDeveloper = userRole === "DEVELOPER";

  // Get employees who can be managers (MANAGEMENT or DEVELOPER role)
  const availableManagers = employees?.filter(
    (emp) =>
      (emp.user.role === "MANAGEMENT" || emp.user.role === "DEVELOPER") &&
      emp.id !== editingEmployee?.id,
  );

  // Update selected managers when currentManagers data loads
  useEffect(() => {
    if (currentManagers && Array.isArray(currentManagers)) {
      setSelectedManagers(currentManagers.map((m: { id: string }) => m.id));
    }
  }, [currentManagers]);

  const filteredEmployees = employees?.filter((emp: Employee) => {
    const searchLower = search.toLowerCase();
    return (
      emp.fullName?.toLowerCase().includes(searchLower) ||
      emp.nickname?.toLowerCase().includes(searchLower) ||
      emp.user.email.toLowerCase().includes(searchLower) ||
      emp.employeeId.toLowerCase().includes(searchLower) ||
      emp.department?.toLowerCase().includes(searchLower) ||
      emp.position?.toLowerCase().includes(searchLower)
    );
  });

  const handleEditClick = (emp: Employee) => {
    setEditingEmployee(emp);
    setSelectedManagers([]);
    // Use employee fullName or fall back to Google account name
    const defaultName = emp.fullName || emp.user.name || "";
    setFormData({
      fullName: defaultName,
      nickname: emp.nickname || "",
      phone: emp.phone || "",
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split("T")[0] : "",
      addressLine1: emp.addressLine1 || "",
      addressLine2: emp.addressLine2 || "",
      city: emp.city || "",
      state: emp.state || "",
      postalCode: emp.postalCode || "",
      country: emp.country || "",
      department: emp.department || "",
      position: emp.position || "",
      salary: emp.salary ? String(emp.salary) : "",
      hireDate: emp.hireDate ? emp.hireDate.split("T")[0] : "",
    });
    logAction(
      "edit_employee",
      "navigation",
      `Opened edit form for employee ${emp.employeeId}`,
      { employeeId: emp.id },
    );
  };

  const handleBack = () => {
    setEditingEmployee(null);
    setSelectedManagers([]);
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleManagerToggle = (managerId: string, checked: boolean) => {
    setSelectedManagers((prev) =>
      checked ? [...prev, managerId] : prev.filter((id) => id !== managerId),
    );
  };

  const handleSave = async () => {
    if (!editingEmployee) return;

    const dataToSend: Record<string, unknown> = {};

    if (formData.fullName) dataToSend.fullName = formData.fullName;
    if (formData.nickname) dataToSend.nickname = formData.nickname;
    if (formData.phone) dataToSend.phone = formData.phone;
    if (formData.dateOfBirth) dataToSend.dateOfBirth = formData.dateOfBirth;
    if (formData.addressLine1) dataToSend.addressLine1 = formData.addressLine1;
    if (formData.addressLine2) dataToSend.addressLine2 = formData.addressLine2;
    if (formData.city) dataToSend.city = formData.city;
    if (formData.state) dataToSend.state = formData.state;
    if (formData.postalCode) dataToSend.postalCode = formData.postalCode;
    if (formData.country) dataToSend.country = formData.country;
    if (formData.department) dataToSend.department = formData.department;
    if (formData.position) dataToSend.position = formData.position;
    if (formData.salary) dataToSend.salary = parseFloat(formData.salary);
    if (formData.hireDate) dataToSend.hireDate = formData.hireDate;

    try {
      // Update employee details
      await updateEmployee.mutateAsync({
        id: editingEmployee.id,
        data: dataToSend,
      });

      // Update manager assignments
      await assignManagers.mutateAsync({
        id: editingEmployee.id,
        managerIds: selectedManagers,
      });

      handleBack();
    } catch (err) {
      console.error("Failed to update employee:", err);
    }
  };

  const getEmployeeName = (emp: Employee) => {
    // Use employee fullName, or fall back to Google account name
    if (emp.fullName) {
      return emp.fullName;
    }
    return emp.user.name || emp.user.email;
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading employees..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: tokens.colorPaletteRedForeground1 }}>
        Error loading employees: {String(error)}
      </div>
    );
  }

  const isSaving = updateEmployee.isPending || assignManagers.isPending;

  // Show edit form when editing
  if (editingEmployee) {
    return (
      <div className={styles.editPanel}>
        <div className={styles.editHeader}>
          <Button
            appearance="subtle"
            icon={<ArrowLeft24Regular />}
            onClick={handleBack}
          />
          <span className={styles.editTitle}>
            Edit: {getEmployeeName(editingEmployee)}
          </span>
        </div>

        <div className={styles.editContent}>
          <div
            className={styles.formGrid}
            style={isMobile ? { gridTemplateColumns: "1fr" } : undefined}
          >
            <div className={styles.sectionTitle}>Personal Information</div>
            <Field label="Full Name" size="small" className={styles.fullWidth}>
              <Input
                size="small"
                value={formData.fullName}
                onChange={(_, data) =>
                  handleInputChange("fullName", data.value)
                }
                placeholder={editingEmployee?.user.name || ""}
              />
            </Field>
            <Field label="Nickname" size="small">
              <Input
                size="small"
                value={formData.nickname}
                onChange={(_, data) =>
                  handleInputChange("nickname", data.value)
                }
              />
            </Field>
            <Field label="Phone" size="small">
              <Input
                size="small"
                value={formData.phone}
                onChange={(_, data) => handleInputChange("phone", data.value)}
              />
            </Field>
            <Field label="Date of Birth" size="small">
              <Input
                size="small"
                type="date"
                value={formData.dateOfBirth}
                onChange={(_, data) =>
                  handleInputChange("dateOfBirth", data.value)
                }
              />
            </Field>

            <div className={styles.sectionTitle}>Address</div>
            <Field
              label="Address Line 1"
              size="small"
              className={styles.fullWidth}
            >
              <Input
                size="small"
                value={formData.addressLine1}
                onChange={(_, data) =>
                  handleInputChange("addressLine1", data.value)
                }
              />
            </Field>
            <Field
              label="Address Line 2"
              size="small"
              className={styles.fullWidth}
            >
              <Input
                size="small"
                value={formData.addressLine2}
                onChange={(_, data) =>
                  handleInputChange("addressLine2", data.value)
                }
              />
            </Field>
            <Field label="City" size="small">
              <Input
                size="small"
                value={formData.city}
                onChange={(_, data) => handleInputChange("city", data.value)}
              />
            </Field>
            <Field label="State" size="small">
              <Input
                size="small"
                value={formData.state}
                onChange={(_, data) => handleInputChange("state", data.value)}
              />
            </Field>
            <Field label="Postal Code" size="small">
              <Input
                size="small"
                value={formData.postalCode}
                onChange={(_, data) =>
                  handleInputChange("postalCode", data.value)
                }
              />
            </Field>
            <Field label="Country" size="small">
              <Input
                size="small"
                value={formData.country}
                onChange={(_, data) => handleInputChange("country", data.value)}
              />
            </Field>

            <div className={styles.sectionTitle}>Employment Details</div>
            <Field label="Department" size="small">
              <Input
                size="small"
                value={formData.department}
                onChange={(_, data) =>
                  handleInputChange("department", data.value)
                }
              />
            </Field>
            <Field label="Position" size="small">
              <Input
                size="small"
                value={formData.position}
                onChange={(_, data) =>
                  handleInputChange("position", data.value)
                }
              />
            </Field>
            <Field label="Salary" size="small">
              <Input
                size="small"
                type="number"
                value={formData.salary}
                onChange={(_, data) => handleInputChange("salary", data.value)}
              />
            </Field>
            <Field label="Hire Date" size="small">
              <Input
                size="small"
                type="date"
                value={formData.hireDate}
                onChange={(_, data) =>
                  handleInputChange("hireDate", data.value)
                }
              />
            </Field>

            <div className={styles.sectionTitle}>Assign Managers</div>
            <div className={styles.managerList}>
              {availableManagers && availableManagers.length > 0 ? (
                availableManagers.map((manager: Employee) => (
                  <div key={manager.id} className={styles.managerItem}>
                    <Checkbox
                      size="medium"
                      checked={selectedManagers.includes(manager.id)}
                      onChange={(_, data) =>
                        handleManagerToggle(manager.id, data.checked === true)
                      }
                    />
                    <Avatar
                      name={getEmployeeName(manager)}
                      image={{
                        src: manager.avatar || manager.user.image || undefined,
                      }}
                      size={24}
                      color="colorful"
                    />
                    <span style={{ fontSize: "13px" }}>
                      {getEmployeeName(manager)}
                    </span>
                    <Badge
                      size="small"
                      color={
                        manager.user.role === "DEVELOPER" ? "danger" : "success"
                      }
                    >
                      {manager.user.role}
                    </Badge>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    color: tokens.colorNeutralForeground3,
                    fontStyle: "italic",
                    fontSize: "13px",
                  }}
                >
                  No managers available
                </div>
              )}
            </div>

            {/* Role Management - Developer Only */}
            {isDeveloper && editingEmployee.user.id !== user?.id && (
              <>
                <div className={styles.sectionTitle}>Role Management</div>
                <Field label="User Role" size="small">
                  <Dropdown
                    size="small"
                    value={editingEmployee.user.role}
                    selectedOptions={[editingEmployee.user.role]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        updateUserRole.mutate({
                          id: editingEmployee.id,
                          role: data.optionValue as
                            | "EMPLOYEE"
                            | "HR"
                            | "MANAGEMENT"
                            | "DEVELOPER",
                        });
                      }
                    }}
                  >
                    <Option value="EMPLOYEE">EMPLOYEE</Option>
                    <Option value="HR">HR</Option>
                    <Option value="MANAGEMENT">MANAGEMENT</Option>
                    <Option value="DEVELOPER">DEVELOPER</Option>
                  </Dropdown>
                </Field>
                {updateUserRole.isPending && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: tokens.colorNeutralForeground3,
                    }}
                  >
                    Updating role...
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className={styles.editFooter}>
          <Button appearance="secondary" onClick={handleBack} size="small">
            Cancel
          </Button>
          <Button
            appearance="primary"
            onClick={handleSave}
            disabled={isSaving}
            size="small"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  }

  // Column widths
  const colWidths = isHR
    ? {
        employee: "35%",
        dept: "20%",
        position: "20%",
        phone: "18%",
        actions: "7%",
      }
    : {
        employee: "40%",
        dept: "22%",
        position: "22%",
        phone: "16%",
      };

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <SearchBox
          placeholder="Search employees..."
          value={search}
          onChange={(_, data) => setSearch(data.value)}
          contentBefore={<Search24Regular />}
          style={{ maxWidth: isMobile ? "100%" : 300, width: "100%" }}
        />
      </div>

      <div className={styles.tableContainer}>
        {isMobile ? (
          // Mobile Card View
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "0 4px",
            }}
          >
            {filteredEmployees?.map((emp: Employee) => (
              <Card key={emp.id} style={{ padding: 12 }}>
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <Avatar
                    name={getEmployeeName(emp)}
                    image={{ src: emp.avatar || emp.user.image || undefined }}
                    size={40}
                    color="colorful"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>
                      {getEmployeeName(emp)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: tokens.colorNeutralForeground3,
                        marginBottom: 6,
                      }}
                    >
                      <Mail24Regular style={{ fontSize: 14 }} />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {emp.user.email}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        fontSize: 12,
                        color: tokens.colorNeutralForeground2,
                      }}
                    >
                      {emp.department && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Building24Regular style={{ fontSize: 14 }} />
                          <span>{emp.department}</span>
                        </div>
                      )}
                      {emp.position && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Person24Regular style={{ fontSize: 14 }} />
                          <span>{emp.position}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isHR && (
                    <Button
                      appearance="subtle"
                      icon={<Edit24Regular />}
                      onClick={() => handleEditClick(emp)}
                      size="small"
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          // Desktop Table View
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: colWidths.employee }}>
                  Employee
                </th>
                <th className={styles.th} style={{ width: colWidths.dept }}>
                  Department
                </th>
                <th className={styles.th} style={{ width: colWidths.position }}>
                  Position
                </th>
                <th className={styles.th} style={{ width: colWidths.phone }}>
                  Phone
                </th>
                {isHR && (
                  <th
                    className={styles.th}
                    style={{ width: colWidths.actions }}
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees?.map((emp: Employee) => (
                <tr key={emp.id} className={styles.tr}>
                  <td className={styles.td}>
                    <div className={styles.employeeCell}>
                      <Avatar
                        name={getEmployeeName(emp)}
                        image={{
                          src: emp.avatar || emp.user.image || undefined,
                        }}
                        size={32}
                        color="colorful"
                      />
                      <div className={styles.employeeInfo}>
                        <div
                          className={styles.employeeName}
                          title={getEmployeeName(emp)}
                        >
                          {getEmployeeName(emp)}
                        </div>
                        <div
                          className={styles.employeeEmail}
                          title={emp.user.email}
                        >
                          {emp.user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span
                      className={styles.textCell}
                      title={emp.department || "-"}
                    >
                      {emp.department || "-"}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span
                      className={styles.textCell}
                      title={emp.position || "-"}
                    >
                      {emp.position || "-"}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.textCell} title={emp.phone || "-"}>
                      {emp.phone || "-"}
                    </span>
                  </td>
                  {isHR && (
                    <td className={styles.td}>
                      <Button
                        className={styles.editButton}
                        appearance="subtle"
                        icon={<Edit24Regular />}
                        onClick={() => handleEditClick(emp)}
                        title="Edit employee"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {filteredEmployees?.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: tokens.colorNeutralForeground3,
            }}
          >
            No employees found
          </div>
        )}
      </div>

      <div className={styles.footer}>
        Total: {filteredEmployees?.length || 0} employees
      </div>
    </div>
  );
}
