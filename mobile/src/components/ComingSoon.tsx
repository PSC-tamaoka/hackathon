import { StyleSheet, View } from "react-native";
import { colors, space } from "@/src/constants/theme";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

/** デザイン案がまだない画面の仮表示 */
export function ComingSoon({ icon, title }: { icon: IconName; title: string }) {
  return (
    <View style={styles.wrap}>
      <Icon name={icon} size={48} color={colors.outlineVariant} />
      <AppText variant="headlineSm">{title}</AppText>
      <AppText variant="bodyMd" color={colors.onSurfaceVariant}>
        この画面は準備中です
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.lg },
});
