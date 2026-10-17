import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { ComingSoon } from "@/src/components/ComingSoon";
import { Icon } from "@/src/components/Icon";
import { AppText } from "@/src/components/AppText";
import { colors, radius, space } from "@/src/constants/theme";
import { supabase } from "@/src/lib/supabase";

// P-06 マイページ(デザイン案なし)。暫定でログアウトのみ
export default function MyPageScreen() {
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={{ flex: 1 }}>
      <ComingSoon icon="badge" title="マイページ" />
      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        style={styles.logout}
      >
        <Icon name="logout" size={18} color={colors.error} />
        <AppText variant="labelLg" color={colors.error}>
          ログアウト
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  logout: {
    position: "absolute",
    bottom: 80,
    left: space.margin,
    right: space.margin,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
    elevation: 2,
  },
});
