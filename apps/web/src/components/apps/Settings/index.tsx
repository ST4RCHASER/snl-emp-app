import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Field,
  Input,
  Button,
  Spinner,
  tokens,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Radio,
  RadioGroup,
  Dropdown,
  Option,
  Switch,
  Card,
} from "@fluentui/react-components";
import {
  Save24Regular,
  Image24Regular,
  Delete24Regular,
  Color24Regular,
  Desktop24Regular,
  ScaleFit24Regular,
  Clock24Regular,
  ChatWarning24Regular,
  CalendarAgenda24Regular,
} from "@fluentui/react-icons";
import { settingsQueries, useUpdateSettings } from "@/api/queries/settings";
import {
  preferencesQueries,
  useUpdatePreferences,
  useUploadBackground,
  type BackgroundFit,
} from "@/api/queries/preferences";
import { useAuth } from "@/auth/provider";
import {
  useWindowRefresh,
  useWindowProps,
} from "@/components/desktop/WindowContext";

const BACKGROUND_FIT_OPTIONS: { value: BackgroundFit; label: string }[] = [
  { value: "cover", label: "Fill Screen" },
  { value: "contain", label: "Fit to Screen" },
  { value: "fill", label: "Stretch to Fill" },
  { value: "center", label: "Center" },
];

type MenuSection =
  | "appearance"
  | "wallpaper"
  | "display"
  | "work-policy"
  | "reservations"
  | "complaints";

interface MenuItem {
  id: MenuSection;
  label: string;
  icon: React.ReactNode;
  hrOnly?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "appearance", label: "Appearance", icon: <Color24Regular /> },
  { id: "wallpaper", label: "Wallpaper", icon: <Desktop24Regular /> },
  { id: "display", label: "Display", icon: <ScaleFit24Regular /> },
  {
    id: "work-policy",
    label: "Work Hours",
    icon: <Clock24Regular />,
    hrOnly: true,
  },
  {
    id: "reservations",
    label: "Reservations",
    icon: <CalendarAgenda24Regular />,
    hrOnly: true,
  },
  {
    id: "complaints",
    label: "Complaints",
    icon: <ChatWarning24Regular />,
    hrOnly: true,
  },
];

// Color picker component
function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          backgroundColor: value,
          border: `2px solid ${tokens.colorNeutralStroke1}`,
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
        title={label}
      >
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </button>
      <Input
        value={value}
        onChange={(_, data) => {
          if (/^#[0-9A-Fa-f]{0,6}$/.test(data.value)) {
            onChange(data.value);
          }
        }}
        style={{ width: 100, fontFamily: "monospace" }}
        maxLength={7}
      />
    </div>
  );
}

interface SettingsWindowProps {
  initialSection?: MenuSection;
}

export default function Settings() {
  const { user } = useAuth();
  const userRole = (user as { role?: string } | undefined)?.role;
  const isHR = userRole === "HR" || userRole === "DEVELOPER";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const windowProps = useWindowProps<SettingsWindowProps>();
  const [activeSection, setActiveSection] = useState<MenuSection>(
    windowProps?.initialSection || "appearance",
  );

  // Update active section when window props change (e.g., when opening from context menu)
  useEffect(() => {
    if (windowProps?.initialSection) {
      setActiveSection(windowProps.initialSection);
    }
  }, [windowProps?.initialSection]);

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["settings"], ["preferences"]], []);
  useWindowRefresh(queryKeys);

  const { data: settings, isLoading: loadingSettings } = useQuery({
    ...settingsQueries.global,
    enabled: isHR,
  });
  const { data: preferences, isLoading: loadingPreferences } = useQuery(
    preferencesQueries.user,
  );

  const updateSettings = useUpdateSettings();
  const updatePreferences = useUpdatePreferences();
  const uploadBackground = useUploadBackground();

  const [form, setForm] = useState({
    workHoursPerDay: 8,
    complaintChatEnabled: true,
    reservationRequiresApproval: true,
  });

  const [appearance, setAppearance] = useState({
    theme: "system" as "system" | "light" | "dark",
    accentColor: "#0078d4",
    backgroundImage: null as string | null,
    backgroundFit: "cover" as BackgroundFit,
    backgroundColor: "#1a1a1a",
    guiScale: 1.0,
    desktopIconSize: 1.0,
    taskbarSize: 1.0,
    appDrawerIconSize: 1.0,
  });

  useEffect(() => {
    if (settings) {
      const s = settings as {
        workHoursPerDay?: number;
        complaintChatEnabled?: boolean;
        reservationRequiresApproval?: boolean;
      };
      setForm({
        workHoursPerDay: s.workHoursPerDay ?? 8,
        complaintChatEnabled: s.complaintChatEnabled ?? true,
        reservationRequiresApproval: s.reservationRequiresApproval ?? true,
      });
    }
  }, [settings]);

  useEffect(() => {
    if (preferences && "theme" in preferences) {
      const prefs = preferences as {
        theme?: string;
        accentColor?: string;
        backgroundImage?: string | null;
        backgroundFit?: string;
        backgroundColor?: string;
        guiScale?: number;
        desktopIconSize?: number;
        taskbarSize?: number;
        appDrawerIconSize?: number;
      };
      setAppearance({
        theme: (prefs.theme as "system" | "light" | "dark") || "system",
        accentColor: prefs.accentColor || "#0078d4",
        backgroundImage: prefs.backgroundImage || null,
        backgroundFit: (prefs.backgroundFit as BackgroundFit) || "cover",
        backgroundColor: prefs.backgroundColor || "#1a1a1a",
        guiScale: prefs.guiScale || 1.0,
        desktopIconSize: prefs.desktopIconSize || 1.0,
        taskbarSize: prefs.taskbarSize || 1.0,
        appDrawerIconSize: prefs.appDrawerIconSize || 1.0,
      });
    }
  }, [preferences]);

  const handleSaveSettings = async () => {
    await updateSettings.mutateAsync(form);
  };

  const handleThemeChange = async (theme: "system" | "light" | "dark") => {
    setAppearance((a) => ({ ...a, theme }));
    await updatePreferences.mutateAsync({ theme });
  };

  const handleAccentColorChange = async (color: string) => {
    setAppearance((a) => ({ ...a, accentColor: color }));
    if (color.length === 7) {
      await updatePreferences.mutateAsync({ accentColor: color });
    }
  };

  const handleBackgroundFitChange = async (fit: BackgroundFit) => {
    setAppearance((a) => ({ ...a, backgroundFit: fit }));
    await updatePreferences.mutateAsync({ backgroundFit: fit });
  };

  const handleBackgroundColorChange = async (color: string) => {
    setAppearance((a) => ({ ...a, backgroundColor: color }));
    if (color.length === 7) {
      await updatePreferences.mutateAsync({ backgroundColor: color });
    }
  };

  const handleGuiScaleChange = async (scale: number) => {
    setAppearance((a) => ({ ...a, guiScale: scale }));
    await updatePreferences.mutateAsync({ guiScale: scale });
  };

  const handleDesktopIconSizeChange = async (size: number) => {
    setAppearance((a) => ({ ...a, desktopIconSize: size }));
    await updatePreferences.mutateAsync({ desktopIconSize: size });
  };

  const handleTaskbarSizeChange = async (size: number) => {
    setAppearance((a) => ({ ...a, taskbarSize: size }));
    await updatePreferences.mutateAsync({ taskbarSize: size });
  };

  const handleAppDrawerIconSizeChange = async (size: number) => {
    setAppearance((a) => ({ ...a, appDrawerIconSize: size }));
    await updatePreferences.mutateAsync({ appDrawerIconSize: size });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = await uploadBackground.mutateAsync(file);
      if (result?.url) {
        setAppearance((a) => ({ ...a, backgroundImage: result.url }));
      }
    }
  };

  const handleRemoveBackground = async () => {
    setAppearance((a) => ({ ...a, backgroundImage: null }));
    await updatePreferences.mutateAsync({ backgroundImage: null });
  };

  const visibleMenuItems = MENU_ITEMS.filter((item) => !item.hrOnly || isHR);

  if (loadingPreferences) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Spinner size="large" label="Loading settings..." />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case "appearance":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Theme
              </h3>
              <RadioGroup
                value={appearance.theme}
                onChange={(_, data) =>
                  handleThemeChange(data.value as "system" | "light" | "dark")
                }
              >
                <Radio
                  value="system"
                  label="System - Automatically switch based on system settings"
                />
                <Radio value="light" label="Light" />
                <Radio value="dark" label="Dark" />
              </RadioGroup>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Accent Color
              </h3>
              <ColorPicker
                value={appearance.accentColor}
                onChange={handleAccentColorChange}
                label="Accent Color"
              />
            </div>
          </div>
        );

      case "wallpaper":
        const showBgColorPicker =
          appearance.backgroundImage &&
          (appearance.backgroundFit === "contain" ||
            appearance.backgroundFit === "center");
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Desktop Background
              </h3>

              {appearance.backgroundImage && (
                <div
                  style={{
                    width: "100%",
                    maxWidth: 400,
                    height: 200,
                    borderRadius: 12,
                    backgroundColor: appearance.backgroundColor,
                    backgroundImage: `url(${appearance.backgroundImage})`,
                    backgroundSize:
                      appearance.backgroundFit === "center"
                        ? "auto"
                        : appearance.backgroundFit === "fill"
                          ? "100% 100%"
                          : appearance.backgroundFit,
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    border: `1px solid ${tokens.colorNeutralStroke1}`,
                    marginBottom: 16,
                  }}
                />
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  style={{ display: "none" }}
                />
                <Button
                  appearance="primary"
                  icon={<Image24Regular />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadBackground.isPending}
                >
                  {uploadBackground.isPending ? "Uploading..." : "Choose Image"}
                </Button>
                {appearance.backgroundImage && (
                  <Button
                    icon={<Delete24Regular />}
                    onClick={handleRemoveBackground}
                    disabled={updatePreferences.isPending}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {appearance.backgroundImage && (
              <div>
                <h3
                  style={{
                    margin: "0 0 16px",
                    fontWeight: 600,
                    color: tokens.colorNeutralForeground1,
                  }}
                >
                  Picture Position
                </h3>
                <Dropdown
                  value={
                    BACKGROUND_FIT_OPTIONS.find(
                      (o) => o.value === appearance.backgroundFit,
                    )?.label
                  }
                  selectedOptions={[appearance.backgroundFit]}
                  onOptionSelect={(_, data) => {
                    if (data.optionValue) {
                      handleBackgroundFitChange(
                        data.optionValue as BackgroundFit,
                      );
                    }
                  }}
                  style={{ minWidth: 200 }}
                >
                  {BACKGROUND_FIT_OPTIONS.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Dropdown>
              </div>
            )}

            {showBgColorPicker && (
              <div>
                <h3
                  style={{
                    margin: "0 0 16px",
                    fontWeight: 600,
                    color: tokens.colorNeutralForeground1,
                  }}
                >
                  Background Color
                </h3>
                <ColorPicker
                  value={appearance.backgroundColor}
                  onChange={handleBackgroundColorChange}
                  label="Background Color"
                />
              </div>
            )}
          </div>
        );

      case "display":
        const scaleOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
        const iconSizeOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                GUI Scaling
              </h3>
              <p
                style={{
                  margin: "0 0 16px",
                  color: tokens.colorNeutralForeground2,
                  fontSize: 13,
                }}
              >
                Adjust the size of windows and UI elements.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {scaleOptions.map((scale) => (
                  <Button
                    key={scale}
                    appearance={
                      appearance.guiScale === scale ? "primary" : "secondary"
                    }
                    onClick={() => handleGuiScaleChange(scale)}
                    style={{ minWidth: 60 }}
                  >
                    {scale}x
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Desktop Icons Size
              </h3>
              <p
                style={{
                  margin: "0 0 16px",
                  color: tokens.colorNeutralForeground2,
                  fontSize: 13,
                }}
              >
                Adjust the size of icons on the desktop.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {iconSizeOptions.map((size) => (
                  <Button
                    key={size}
                    appearance={
                      appearance.desktopIconSize === size
                        ? "primary"
                        : "secondary"
                    }
                    onClick={() => handleDesktopIconSizeChange(size)}
                    style={{ minWidth: 60 }}
                  >
                    {size}x
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Taskbar Size
              </h3>
              <p
                style={{
                  margin: "0 0 16px",
                  color: tokens.colorNeutralForeground2,
                  fontSize: 13,
                }}
              >
                Adjust the size of taskbar icons and height.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {iconSizeOptions.map((size) => (
                  <Button
                    key={size}
                    appearance={
                      appearance.taskbarSize === size ? "primary" : "secondary"
                    }
                    onClick={() => handleTaskbarSizeChange(size)}
                    style={{ minWidth: 60 }}
                  >
                    {size}x
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                App Drawer Icon Size
              </h3>
              <p
                style={{
                  margin: "0 0 16px",
                  color: tokens.colorNeutralForeground2,
                  fontSize: 13,
                }}
              >
                Adjust the size of icons in the app drawer.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {iconSizeOptions.map((size) => (
                  <Button
                    key={size}
                    appearance={
                      appearance.appDrawerIconSize === size
                        ? "primary"
                        : "secondary"
                    }
                    onClick={() => handleAppDrawerIconSizeChange(size)}
                    style={{ minWidth: 60 }}
                  >
                    {size}x
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );

      case "work-policy":
        if (loadingSettings) {
          return (
            <div
              style={{ display: "flex", justifyContent: "center", padding: 40 }}
            >
              <Spinner size="medium" label="Loading..." />
            </div>
          );
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <p style={{ margin: 0, color: tokens.colorNeutralForeground2 }}>
              Configure standard work hours for employees.
            </p>

            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Standard Work Hours
              </h3>
              <div style={{ display: "grid", gap: 16, maxWidth: 400 }}>
                <Field
                  label="Work Hours Per Day"
                  hint="Standard work hours expected per day (used in team dashboard)"
                >
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    step={0.5}
                    value={String(form.workHoursPerDay)}
                    onChange={(_, d) =>
                      setForm((f) => ({
                        ...f,
                        workHoursPerDay: parseFloat(d.value) || 8,
                      }))
                    }
                  />
                </Field>
              </div>
            </div>

            <div>
              <Button
                appearance="primary"
                icon={<Save24Regular />}
                onClick={handleSaveSettings}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            {updateSettings.isSuccess && (
              <MessageBar intent="success">
                <MessageBarBody>
                  <MessageBarTitle>Success</MessageBarTitle>
                  Settings saved successfully.
                </MessageBarBody>
              </MessageBar>
            )}
          </div>
        );

      case "reservations":
        if (loadingSettings) {
          return (
            <div
              style={{ display: "flex", justifyContent: "center", padding: 40 }}
            >
              <Spinner size="medium" label="Loading..." />
            </div>
          );
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <p style={{ margin: 0, color: tokens.colorNeutralForeground2 }}>
              Configure resource reservation settings.
            </p>

            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Approval Process
              </h3>
              <Card style={{ padding: 16, maxWidth: 500 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Require Approval
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.colorNeutralForeground3,
                      }}
                    >
                      {form.reservationRequiresApproval
                        ? "Reservations require manager approval before being confirmed"
                        : "Reservations are automatically approved when submitted"}
                    </div>
                  </div>
                  <Switch
                    checked={form.reservationRequiresApproval}
                    onChange={(_, d) =>
                      setForm((f) => ({
                        ...f,
                        reservationRequiresApproval: d.checked,
                      }))
                    }
                  />
                </div>
              </Card>
            </div>

            <div>
              <Button
                appearance="primary"
                icon={<Save24Regular />}
                onClick={handleSaveSettings}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            {updateSettings.isSuccess && (
              <MessageBar intent="success">
                <MessageBarBody>
                  <MessageBarTitle>Success</MessageBarTitle>
                  Settings saved successfully.
                </MessageBarBody>
              </MessageBar>
            )}
          </div>
        );

      case "complaints":
        if (loadingSettings) {
          return (
            <div
              style={{ display: "flex", justifyContent: "center", padding: 40 }}
            >
              <Spinner size="medium" label="Loading..." />
            </div>
          );
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <p style={{ margin: 0, color: tokens.colorNeutralForeground2 }}>
              Configure complaint system settings.
            </p>

            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontWeight: 600,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                Communication
              </h3>
              <Card style={{ padding: 16, maxWidth: 500 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Enable Chat
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.colorNeutralForeground3,
                      }}
                    >
                      {form.complaintChatEnabled
                        ? "Employees can chat with HR about their complaints"
                        : "HR will respond via the response box only"}
                    </div>
                  </div>
                  <Switch
                    checked={form.complaintChatEnabled}
                    onChange={(_, d) =>
                      setForm((f) => ({
                        ...f,
                        complaintChatEnabled: d.checked,
                      }))
                    }
                  />
                </div>
              </Card>
            </div>

            <div>
              <Button
                appearance="primary"
                icon={<Save24Regular />}
                onClick={handleSaveSettings}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            {updateSettings.isSuccess && (
              <MessageBar intent="success">
                <MessageBarBody>
                  <MessageBarTitle>Success</MessageBarTitle>
                  Settings saved successfully.
                </MessageBarBody>
              </MessageBar>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 220,
          borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
          background: tokens.colorNeutralBackground2,
          padding: "12px 0",
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        {visibleMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              border: "none",
              background:
                activeSection === item.id
                  ? tokens.colorNeutralBackground1Pressed
                  : "transparent",
              color: tokens.colorNeutralForeground1,
              cursor: "pointer",
              fontSize: 14,
              textAlign: "left",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              if (activeSection !== item.id) {
                e.currentTarget.style.background =
                  tokens.colorNeutralBackground1Hover;
              }
            }}
            onMouseLeave={(e) => {
              if (activeSection !== item.id) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <span
              style={{ display: "flex", color: tokens.colorNeutralForeground2 }}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: 24,
          overflowY: "auto",
          background: tokens.colorNeutralBackground1,
        }}
      >
        <h2
          style={{
            margin: "0 0 24px",
            fontWeight: 600,
            fontSize: 20,
            color: tokens.colorNeutralForeground1,
          }}
        >
          {visibleMenuItems.find((item) => item.id === activeSection)?.label}
        </h2>
        {renderContent()}
      </div>
    </div>
  );
}
