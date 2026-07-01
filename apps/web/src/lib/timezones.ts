export interface TimezoneOption {
  value: string;
  label: string;
}

/**
 * Detects the user's local IANA timezone string.
 */
export const detectUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) {
    return "UTC";
  }
};

const getUTCOffsetLabel = (tz: string, baseLabel: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(new Date());
    const offset = parts.find(p => p.type === "timeZoneName")?.value.replace("GMT", "UTC") || "UTC+00:00";
    return `(${offset}) ${baseLabel}`;
  } catch (e) {
    return baseLabel;
  }
};

const RAW_TIMEZONES = [
  { value: "UTC", label: "UTC (Universal Coordinated Time)" },
  { value: "America/New_York", label: "Eastern Time (ET) - US & Canada" },
  { value: "America/Chicago", label: "Central Time (CT) - US & Canada" },
  { value: "America/Denver", label: "Mountain Time (MT) - US & Canada" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) - US & Canada" },
  { value: "Europe/London", label: "London / GMT (UK Time)" },
];

export const COMMON_TIMEZONES: TimezoneOption[] = RAW_TIMEZONES.map(tz => ({
  value: tz.value,
  label: tz.value === "UTC" ? `(UTC+00:00) ${tz.label}` : getUTCOffsetLabel(tz.value, tz.label),
}));