// Apple-style color palette and typography constants
export const colors = {
  bg: "#0a0a0a",
  white: "#f5f5f7",
  gray: "#86868b",
  mid: "#a1a1a6",
  accent: "#00ffaa",
  indigo: "#6366f1",
  amber: "#f59e0b",
  red: "#ef4444",
  green: "#30d158",
  blue: "#3b82f6",
} as const;

export const fonts = {
  heading: "SF Pro Display, -apple-system, system-ui, sans-serif",
  mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
} as const;

// Apple-style spring configs
export const springs = {
  gentle: { mass: 1, damping: 20, stiffness: 50, overshootClamping: true },
  standard: { mass: 0.8, damping: 15, stiffness: 80, overshootClamping: true },
  snappy: { mass: 0.5, damping: 12, stiffness: 120, overshootClamping: true },
  dramatic: { mass: 1.2, damping: 25, stiffness: 30, overshootClamping: true },
} as const;
