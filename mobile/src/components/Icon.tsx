import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { colors } from "@/src/constants/theme";

export type IconName = ComponentProps<typeof MaterialIcons>["name"];

type Props = { name: IconName; size?: number; color?: string };

export function Icon({ name, size = 20, color = colors.onSurface }: Props) {
  return <MaterialIcons name={name} size={size} color={color} />;
}
