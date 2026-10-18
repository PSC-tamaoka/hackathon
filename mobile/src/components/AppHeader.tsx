import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "@/src/constants/theme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

function ProfileBadge() {
  return (
    <View style={styles.avatar}>
      <Icon name="person" size={18} color={colors.onPrimary} />
    </View>
  );
}

/** タブ画面共通のヘッダー(ロゴ・通知・プロフィール) */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: 64 + insets.top }]}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name="waves" size={20} color={colors.primary} />
        </View>
        <View>
          <AppText variant="headlineSm" color={colors.primary} style={{ lineHeight: 20 }}>
            Re:海学
          </AppText>
          <AppText variant="labelSm" color={colors.outline} style={styles.sub}>
            SHIBUKAWA ALUMNI
          </AppText>
        </View>
      </View>
      <View style={styles.right}>
        <Pressable accessibilityLabel="通知" style={styles.iconBtn}>
          <Icon name="notifications" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
        <ProfileBadge />
      </View>
    </View>
  );
}

/** 戻るボタン付きヘッダー(イベント詳細など) */
export function BackHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: 64 + insets.top, paddingHorizontal: space.xs }]}>
      <View style={styles.brand}>
        <Pressable
          accessibilityLabel="戻る"
          style={styles.iconBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        >
          <Icon name="arrow-back" size={22} />
        </Pressable>
        <AppText variant="headlineSm" numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <View style={{ paddingRight: space.sm }}>
        <ProfileBadge />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.margin,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,123,185,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  sub: { letterSpacing: 1, marginTop: 4 },
  right: { flexDirection: "row", alignItems: "center", gap: space.xs },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
