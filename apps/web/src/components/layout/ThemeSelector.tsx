import type { IconType } from "react-icons";
import { HiComputerDesktop, HiMoon, HiSun } from "react-icons/hi2";
import type { ThemePreference } from "../../theme/theme";
import { useTheme } from "../../theme/ThemeProvider";

const options: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const THEME_ICONS: Record<ThemePreference, IconType> = {
  light: HiSun,
  dark: HiMoon,
  system: HiComputerDesktop,
};

export function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  const Icon = THEME_ICONS[preference];

  return (
    <label className="theme-dropdown">
      <span className="theme-dropdown-icon">
        <Icon aria-hidden="true" />
      </span>
      <select
        className="theme-dropdown-select"
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
        aria-label="Interface theme"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
