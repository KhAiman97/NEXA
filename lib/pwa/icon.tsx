/** App identity. The icons themselves are image files cut from logo.png (see public/icons, app/icon.png). */
export const BRAND = {
  name: "Nexa",
  shortName: "Nexa",
  /** The logo's black: the square behind the mark in every icon. */
  background: "#010101",
  /** --background in the dark theme: splash screen and dark-mode browser chrome, so launch doesn't flash. */
  night: "#0c0f1c",
  /** Light desk: light-mode browser chrome. */
  desk: "#e7e9f1",
} as const;
