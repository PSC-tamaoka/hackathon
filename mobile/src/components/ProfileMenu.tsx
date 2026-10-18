import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/src/constants/theme";
import { useProfile } from "@/src/hooks/useProfile";
import { signOut } from "@/src/lib/api";
import { AppText } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import { Icon } from "./Icon";

/** ヘッダーのユーザーマークと、タップして開く簡易プロフィール。 */
export function ProfileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ユーザー情報を開く"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={styles.iconButton}
      >
        <View style={styles.avatar}>
          <Icon name="person" size={18} color={colors.onPrimary} />
        </View>
      </Pressable>
      {open && <ProfileSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { profile, user, loading } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const metadataName = typeof user?.user_metadata.name === "string" ? user.user_metadata.name : "";
  const name = profile?.nickname?.trim() || profile?.name?.trim() || metadataName.trim() || (user ? "ユーザー" : "ゲスト");
  const email = profile?.email || user?.email;

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signOut();
      onClose();
      router.replace("/(auth)/login");
    } catch {
      setError("ログアウトできませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={styles.heading}>
        <AppText variant="headlineSm">ユーザー情報</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ユーザー情報を閉じる"
          onPress={onClose}
          style={styles.iconButton}
        >
          <Icon name="close" color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator accessibilityLabel="ユーザー情報を読み込み中" color={colors.primary} />
      ) : (
        <View style={styles.profile}>
          <View style={styles.profileAvatar}>
            <Icon name="person" size={28} color={colors.primary} />
          </View>
          <View style={styles.details}>
            <AppText variant="headlineSm">{name}</AppText>
            <AppText variant="bodyMd" color={colors.onSurfaceVariant} selectable>
              {email || "ログインしていません"}
            </AppText>
            {profile?.is_admin && (
              <AppText variant="labelMd" color={colors.primary}>管理者</AppText>
            )}
          </View>
        </View>
      )}

      {error ? (
        <AppText variant="bodyMd" color={colors.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? "ログアウト中" : "ログアウト"}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={logout}
        style={[styles.logout, busy && styles.busy]}
      >
        {busy ? <ActivityIndicator color={colors.error} /> : <Icon name="logout" color={colors.error} />}
        <AppText variant="labelLg" color={colors.error}>
          {busy ? "ログアウト中…" : "ログアウト"}
        </AppText>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  profile: { flexDirection: "row", alignItems: "center", gap: space.md },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  details: { flex: 1, gap: space.xs },
  logout: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.full,
    backgroundColor: "rgba(186,26,26,0.08)",
  },
  busy: { opacity: 0.6 },
});
