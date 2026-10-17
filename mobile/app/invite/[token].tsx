import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BackHeader } from "@/src/components/AppHeader";
import { AppText } from "@/src/components/AppText";
import { Icon, type IconName } from "@/src/components/Icon";
import { Toast, type ToastState } from "@/src/components/Toast";
import { colors, radius, space } from "@/src/constants/theme";
import { useSession } from "@/src/hooks/useSession";
import { applyEvent, errorMessage, getInvite, isMock } from "@/src/lib/api";
import { formatJaDate } from "@/src/lib/dates";
import type { EventSummary } from "@/src/types/event";

/** 招待ページ。招待リンク・QRコードを開くとここに来る(ログイン前でも見られる) */
export default function InviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { signedIn } = useSession();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const hideToast = useCallback(() => setToast(null), []);

  // ログインから戻ってきたときも読み直す
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      getInvite(token)
        .then(setEvent)
        .catch(() => setEvent(null))
        .finally(() => setLoading(false));
    }, [token]),
  );

  const openDetail = (id: string) => router.replace({ pathname: "/events/[id]", params: { id, invite: token } });

  const join = async () => {
    if (!event || !token) return;
    if (!signedIn && !isMock) {
      router.push({ pathname: "/(auth)/login", params: { redirect: `/invite/${token}` } });
      return;
    }
    setBusy(true);
    try {
      await applyEvent(event.id, token);
      openDetail(event.id);
    } catch (e) {
      setToast({ heading: "参加登録できませんでした", body: errorMessage(e), icon: "warning" });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !event) {
    return (
      <View style={{ flex: 1 }}>
        <BackHeader title="ご招待" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={{ flex: 1 }}>
        <BackHeader title="ご招待" />
        <View style={[styles.center, { gap: space.md }]}>
          <Icon name="link-off" size={48} color={colors.outlineVariant} />
          <AppText variant="headlineSm">この招待リンクは使えません</AppText>
          <AppText variant="bodyMd" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
            リンクが古いか、イベントが終了した可能性があります。{"\n"}招待してくれた方にご確認ください。
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.subBtn}>
            <AppText variant="labelLg" color={colors.primary}>
              ホームへ
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  const registered = event.isRegistered === true;
  const accepting = event.accepting !== false;

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="ご招待" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.invitePill}>
          <Icon name="mail" size={16} color={colors.onSecondaryFixed} />
          <AppText variant="labelMd" color={colors.onSecondaryFixed}>
            渋川つながりから招待が届いています
          </AppText>
        </View>

        <View style={styles.hero}>
          <Image source={{ uri: event.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(40,48,68,0.9)"]} style={StyleSheet.absoluteFill} />
          <View style={{ padding: 20, gap: 6 }}>
            <AppText variant="labelSm" color={colors.secondaryFixed} style={{ letterSpacing: 1 }}>
              {event.scope === "closed" ? "INVITATION ONLY" : "OPEN EVENT"}
            </AppText>
            <AppText variant="headlineLgMobile" color={colors.inverseOnSurface}>
              {event.title}
            </AppText>
          </View>
        </View>

        <View style={styles.card}>
          <Row icon="calendar-month" label="開催日時">
            {`${formatJaDate(event.date)}  ${event.startTime} 〜 ${event.endTime}`}
          </Row>
          <Row icon="location-on" label="集合場所">
            {`${event.place}（${event.address}）`}
          </Row>
          <Row icon="groups" label="定員">
            {`${event.capacity}名（残り${event.remaining}名）`}
          </Row>
          {event.description ? (
            <AppText variant="bodyMd" color={colors.onSurfaceVariant} style={{ lineHeight: 22 }}>
              {event.description}
            </AppText>
          ) : null}
        </View>

        {registered ? (
          <Pressable accessibilityRole="button" onPress={() => openDetail(event.id)} style={styles.mainBtn}>
            <Icon name="check-circle" size={20} color={colors.onPrimary} />
            <AppText variant="headlineSm" color={colors.onPrimary}>
              参加登録済み・詳細を見る
            </AppText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={!accepting || busy}
            onPress={join}
            style={[styles.mainBtn, (!accepting || busy) && { opacity: 0.5 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Icon name="how-to-reg" size={20} color={colors.onPrimary} />
            )}
            <AppText variant="headlineSm" color={colors.onPrimary}>
              {!accepting ? "受付は終了しました" : signedIn || isMock ? "参加する" : "ログインして参加する"}
            </AppText>
          </Pressable>
        )}
        {!signedIn && !isMock && (
          <AppText variant="bodySm" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
            はじめての方は、新規登録のあと自動でこのページに戻ります。
          </AppText>
        )}
      </ScrollView>
      <Toast toast={toast} onHide={hideToast} bottom={24} />
    </View>
  );
}

function Row({ icon, label, children }: { icon: IconName; label: string; children: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={colors.onPrimaryFixed} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="labelMd" color={colors.onSurfaceVariant}>
          {label}
        </AppText>
        <AppText variant="bodyLg" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
          {children}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  content: { padding: space.margin, gap: space.md, paddingBottom: space.xl },
  invitePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryFixed,
  },
  hero: { height: 200, borderRadius: radius.card, overflow: "hidden", justifyContent: "flex-end" },
  card: { padding: 20, gap: 16, borderRadius: radius.card, backgroundColor: colors.surfaceContainerLowest },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtn: {
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  subBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
