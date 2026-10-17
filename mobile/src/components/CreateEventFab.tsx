import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { useProfile } from "@/src/hooks/useProfile";
import { colors, space } from "@/src/constants/theme";
import { Icon } from "./Icon";

/** 管理者(is_admin=true)のときだけ出るホーム右下の作成ボタン */
export function CreateEventFab() {
  const router = useRouter();
  const { isAdmin, loading } = useProfile();

  if (loading || !isAdmin) return null;

  return (
    <Pressable
      accessibilityLabel="イベントを作成"
      accessibilityRole="button"
      onPress={() => router.push("/organizer/new")}
      style={styles.fab}
    >
      <Icon name="add" size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: space.margin,
    bottom: space.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
