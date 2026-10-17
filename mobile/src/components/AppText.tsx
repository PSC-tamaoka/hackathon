import { Text, type TextProps } from "react-native";
import { colors, typography, type TypographyVariant } from "@/src/constants/theme";

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: string;
};

export function AppText({ variant = "bodyMd", color = colors.onSurface, style, ...rest }: Props) {
  return <Text {...rest} style={[typography[variant], { color }, style]} />;
}
