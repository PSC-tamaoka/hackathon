import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { BackHeader } from "@/src/components/AppHeader";
import { AppText } from "@/src/components/AppText";
import { Icon, type IconName } from "@/src/components/Icon";
import { Toast, type ToastState } from "@/src/components/Toast";
import { colors, radius, space } from "@/src/constants/theme";
import { useEvent } from "@/src/hooks/useEvent";
import { errorMessage, getInviteStatus, getInviteUrl } from "@/src/lib/api";
import { formatJaDate } from "@/src/lib/dates";
import type { InviteStatus } from "@/src/types/event";

/**
 * O-03 招待の設定(主催者用)
 *   招待制   : 招待リンクのコピー・共有・QRコードで招待する
 *   オープン : 開催14日前に会員全員へ招待メールが自動で届く。リンク・QRでの共有もできる
 */
export default function OrganizerInviteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading } = useEvent(id);

  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [link, st] = await Promise.all([getInviteUrl(id), getInviteStatus(id)]);
      setUrl(link);
      setStatus(st);
    } catch (e) {
      setToast({ heading: "読み込めませんでした", body: errorMessage(e), icon: "warning" });
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !event) {
    return (
      <View style={{ flex: 1 }}>
        <BackHeader title="招待の設定" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!event || event.isOrganizer === false) {
    return (
      <View style={{ flex: 1 }}>
        <BackHeader title="招待の設定" />
        <View style={styles.center}>
          <AppText variant="bodyLg" color={colors.onSurfaceVariant}>
            この画面はイベントの主催者だけが使えます
          </AppText>
        </View>
      </View>
    );
  }

  const closed = event.scope === "closed";

  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setToast({ heading: "コピーしました", body: "招待リンクをクリップボードにコピーしました。", icon: "content-copy" });
  };
  const share = async () => {
    if (!url) return;
    try {
      await Share.share({ message: `【ご招待】${event.title}\n${formatJaDate(event.date)} ${event.startTime}〜\n${url}` });
    } catch {
      setToast({ heading: "共有できません", body: "もう一度お試しください。", icon: "warning" });
    }
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      setUrl(await getInviteUrl(event.id, true));
      setToast({ heading: "作り直しました", body: "以前の招待リンクは使えなくなりました。", icon: "autorenew" });
    } catch (e) {
      setToast({ heading: "作り直せませんでした", body: errorMessage(e), icon: "warning" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="招待の設定" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 4 }}>
          <AppText variant="headlineLgMobile">{event.title}</AppText>
          <AppText variant="bodyMd" color={colors.onSurfaceVariant}>
            {formatJaDate(event.date)} {event.startTime}〜{event.endTime}
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: closed ? colors.secondaryFixed : colors.tertiaryFixed }]}>
          <View style={styles.rowCenter}>
            <Icon name={closed ? "lock" : "public"} size={20} color={closed ? colors.onSecondaryFixed : colors.onTertiaryFixed} />
            <AppText variant="headlineSm" color={closed ? colors.onSecondaryFixed : colors.onTertiaryFixed}>
              {closed ? "招待制（クローズド）" : "全員参加（オープン）"}
            </AppText>
          </View>
          <AppText variant="bodyMd" color={closed ? colors.onSecondaryFixed : colors.onTertiaryFixed}>
            {closed
              ? "下の招待リンクかQRコードを受け取った人だけが、このイベントを見て参加登録できます。"
              : `開催14日前（${status ? formatJaDate(status.allInviteOn) : "…"}）に、メール受信を許可している会員全員へ招待メールを自動で送ります。`}
          </AppText>
          {!closed && status?.allInviteSentAt && (
            <AppText variant="labelMd" color={colors.onTertiaryFixed}>
              送信済み：{status.emailsSent}通{status.emailsFailed > 0 ? `（失敗 ${status.emailsFailed}通・翌日再送）` : ""}
            </AppText>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.rowCenter}>
            <Icon name="link" size={20} color={colors.primary} />
            <AppText variant="headlineSm">招待リンク</AppText>
          </View>
          <View style={styles.urlBox}>
            {url ? (
              <AppText variant="bodySm" selectable numberOfLines={2}>
                {url}
              </AppText>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ActionButton icon="content-copy" label="コピー" onPress={copy} disabled={!url} />
            <ActionButton icon="share" label="共有" onPress={share} disabled={!url} />
            <ActionButton icon="autorenew" label="作り直す" onPress={regenerate} disabled={!url || busy} />
          </View>
          <View style={styles.qrBox}>{url ? <QRCode value={url} size={200} /> : null}</View>
          <AppText variant="bodySm" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
            QRコードを画面に表示したり印刷したりして配れます
          </AppText>
        </View>

        <View style={[styles.card, { flexDirection: "row", gap: 12 }]}>
          <Stat label="参加登録" value={status ? `${status.registeredCount} / ${event.capacity}名` : "…"} />
          <Stat label="リンクが開かれた回数" value={status ? `${status.linkOpenCount}回` : "…"} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/events/[id]", params: { id: event.id } })}
          style={styles.subBtn}
        >
          <AppText variant="labelLg" color={colors.primary}>
            イベント詳細を見る
          </AppText>
        </Pressable>
      </ScrollView>
      <Toast toast={toast} onHide={hideToast} bottom={24} />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && { opacity: 0.5 }]}
    >
      <Icon name={icon} size={20} color={colors.primary} />
      <AppText variant="labelMd" color={colors.primary}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="labelSm" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
      <AppText variant="headlineSm" color={colors.primary}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  content: { padding: space.margin, gap: space.md, paddingBottom: space.xl },
  card: { padding: 20, gap: 12, borderRadius: radius.card, backgroundColor: colors.surfaceContainerLowest },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  urlBox: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  action: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
  },
  qrBox: { alignSelf: "center", padding: 16, borderRadius: radius.md, backgroundColor: "#ffffff", minHeight: 232 },
  subBtn: {
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
