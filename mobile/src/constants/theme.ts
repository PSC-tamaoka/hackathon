// デザイン案(work/画面.txt)の tailwind 設定を移したもの
export const colors = {
  background: "#faf8ff",
  surface: "#faf8ff",
  surfaceBright: "#faf8ff",
  surfaceDim: "#d2d9f4",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f2f3ff",
  surfaceContainer: "#eaedff",
  surfaceContainerHigh: "#e2e7ff",
  surfaceContainerHighest: "#dae2fd",
  onSurface: "#131b2e",
  onSurfaceVariant: "#3f4850",
  inverseSurface: "#283044",
  inverseOnSurface: "#eef0ff",
  outline: "#707881",
  outlineVariant: "#bfc7d2",
  primary: "#006194",
  onPrimary: "#ffffff",
  primaryContainer: "#007bb9",
  onPrimaryContainer: "#fdfcff",
  primaryFixed: "#cce5ff",
  onPrimaryFixed: "#001d31",
  secondary: "#855300",
  onSecondary: "#ffffff",
  secondaryContainer: "#fea619",
  onSecondaryContainer: "#684000",
  secondaryFixed: "#ffddb8",
  onSecondaryFixed: "#2a1700",
  tertiary: "#006948",
  onTertiary: "#ffffff",
  tertiaryContainer: "#00855d",
  onTertiaryContainer: "#f5fff7",
  tertiaryFixed: "#85f8c4",
  onTertiaryFixed: "#002114",
  error: "#ba1a1a",
  onError: "#ffffff",
} as const;

export const radius = { sm: 8, md: 16, lg: 32, xl: 48, card: 24, full: 9999 } as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, margin: 16 } as const;

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
} as const;

// 本文16px以上が仕様(7章)だが、デザイン案の値をそのまま採用している
export const typography = {
  display: { fontSize: 40, lineHeight: 48, fontFamily: fonts.bold },
  displayMobile: { fontSize: 32, lineHeight: 40, fontFamily: fonts.bold },
  headlineLg: { fontSize: 30, lineHeight: 38, fontFamily: fonts.bold },
  headlineLgMobile: { fontSize: 24, lineHeight: 32, fontFamily: fonts.bold },
  headlineMd: { fontSize: 20, lineHeight: 28, fontFamily: fonts.semibold },
  headlineSm: { fontSize: 18, lineHeight: 26, fontFamily: fonts.semibold },
  bodyLg: { fontSize: 16, lineHeight: 26, fontFamily: fonts.regular },
  bodyMd: { fontSize: 14, lineHeight: 22, fontFamily: fonts.regular },
  bodySm: { fontSize: 12, lineHeight: 18, fontFamily: fonts.regular },
  labelLg: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold },
  labelMd: { fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold },
  labelSm: { fontSize: 10, lineHeight: 14, fontFamily: fonts.bold },
} as const;

export type TypographyVariant = keyof typeof typography;
