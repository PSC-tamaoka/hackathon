import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { AppText } from "@/src/components/AppText";
import { BackHeader } from "@/src/components/AppHeader";
import { BottomSheet } from "@/src/components/BottomSheet";
import { Icon, type IconName } from "@/src/components/Icon";
import { Toast, type ToastState } from "@/src/components/Toast";
import { EventRally } from "@/src/components/EventRally";
import { images } from "@/src/constants/images";
import { colors, radius, space } from "@/src/constants/theme";
import { useEvent } from "@/src/hooks/useEvent";
import { useRallyProgress } from "@/src/hooks/useRallyProgress";
import { useSession } from "@/src/hooks/useSession";
import { applyEvent, cancelRegistration, errorMessage, getInviteUrl } from "@/src/lib/api";
import { formatJaDate, parseDateKey, weekdayLabel } from "@/src/lib/dates";

export default function EventDetailScreen() {
  // invite: 招待リンクから来たときのトークン(招待制のイベントを見る・申し込むのに使う)
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const { ready, session } = useSession();
  if (!ready) return <View style={styles.notFound}><ActivityIndicator color={colors.primary} /></View>;
  // 同じ画面でIDやアカウントが変わっても、前のイベントの進捗・共有URLを引き継がない。
  return <EventDetail key={`${session?.user.id ?? "guest"}:${id}:${invite ?? ""}`} id={id} invite={invite} />;
}

function EventDetail({ id, invite }: { id: string; invite?: string }) {
  const router = useRouter();
  const { event, loading, error, reload } = useEvent(id, invite);
  const rally = useRallyProgress(id);

  const [shareOpen, setShareOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const mutating = useRef(false);

  // 読み込んだ内容(自分の出欠・TODOのチェック)を画面に反映する
  useEffect(() => {
    if (!event) return;
    setRegistered(event.isRegistered ?? false);
  }, [event]);

  if (!event) {
    return (
      <View style={{ flex: 1 }}>
        <BackHeader title="Event Detail" />
        <View style={styles.notFound}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <AppText variant="bodyLg" color={colors.onSurfaceVariant}>
              {error ?? "イベントが見つかりません"}
            </AppText>
          )}
        </View>
      </View>
    );
  }

  const linkToShare = shareUrl ?? Linking.createURL(`/events/${event.id}`);
  const d = parseDateKey(event.date);
  const dateLabel = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdayLabel(d)})`;

  const showError = (e: unknown) => setToast({ heading: "できませんでした", body: errorMessage(e), icon: "warning" });

  // DB保存が成功した後にだけキーワード・演出・歌を解放する。
  const completeMission = async (missionId: string) => {
    if (mutating.current || loading || error || !registered) throw new Error("参加登録が必要です。出欠状況を確認してください。");
    mutating.current = true;
    try {
      return await rally.complete(missionId);
    } finally {
      mutating.current = false;
    }
  };

  // 共有シートを開くときに招待リンクを用意する(招待ページ /invite/<token> へのリンク)
  const openShare = async () => {
    setShareOpen(true);
    if (shareUrl) return;
    try {
      setShareUrl(await getInviteUrl(event.id));
    } catch {
      // 招待リンクを作れないとき(招待制で権限がない等)はイベントのリンクで代用
    }
  };

  const changeRsvp = async (join: boolean) => {
    setRsvpOpen(false);
    if (join === registered || mutating.current) return;
    mutating.current = true;
    setBusy(true);
    try {
      if (join) await applyEvent(event.id, invite);
      else await cancelRegistration(event.id);
      setRegistered(join);
      await reload();
      setToast(
        join
          ? { heading: "参加登録しました", body: "当日お会いできるのを楽しみにしています。", icon: "celebration" }
          : { heading: "参加をとりやめました", body: "またのご参加をお待ちしています。", icon: "event-busy" },
      );
    } catch (e) {
      showError(e);
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(linkToShare);
    setShareOpen(false);
    setToast({ heading: "コピーしました", body: "リンクをクリップボードにコピーしました。", icon: "content-copy" });
  };
  const shareVia = async () => {
    setShareOpen(false);
    try {
      await Share.share({ message: `${event.title}\n${formatJaDate(event.date)}\n${linkToShare}` });
    } catch {
      setToast({ heading: "共有できません", body: "もう一度お試しください。", icon: "warning" });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Event Detail" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: "row", gap: 8, flexShrink: 1, flexWrap: "wrap" }}>
            <View style={[styles.pill, { backgroundColor: "rgba(0,105,72,0.1)" }]}>
              <Icon name={event.scope === "open" ? "public" : "lock"} size={16} color={colors.tertiary} />
              <AppText variant="labelMd" color={colors.tertiary}>
                {event.scope === "open" ? "全員参加可能（オープン）" : "招待制（クローズド）"}
              </AppText>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={openShare} style={styles.shareBtn}>
            <Icon name="share" size={18} color={colors.primary} />
            <AppText variant="labelLg" color={colors.primary}>
              共有
            </AppText>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Image source={{ uri: images.eventHero }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(40,48,68,0.9)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroText}>
            <View style={styles.heroTag}>
              <Icon name="sailing" size={14} color={colors.primary} />
              <AppText variant="labelSm" color={colors.primary} style={{ letterSpacing: 1 }}>
                SHIBUKAWA HERITAGE QUEST
              </AppText>
            </View>
            <AppText variant="headlineLgMobile" color={colors.inverseOnSurface}>
              {event.title}
            </AppText>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow icon="calendar-month" tint={colors.primaryFixed} fg={colors.onPrimaryFixed} label="開催日時">
            <AppText variant="headlineSm" style={{ marginTop: 2 }}>
              {dateLabel}
            </AppText>
            <AppText variant="bodyMd" color={colors.primary} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
              {event.startTime} 〜 {event.endTime}
              {event.receptionNote && (
                <AppText variant="bodySm" color={colors.onSurfaceVariant}>
                  {"  "}（{event.receptionNote}）
                </AppText>
              )}
            </AppText>
          </InfoRow>
          <View style={styles.divider} />
          <InfoRow icon="location-on" tint={colors.secondaryFixed} fg={colors.onSecondaryFixed} label="集合場所">
            <AppText variant="bodyLg" style={{ marginTop: 2, fontFamily: "PlusJakartaSans_600SemiBold" }}>
              {event.place}
            </AppText>
            <AppText variant="bodySm" color={colors.onSurfaceVariant} style={{ marginBottom: 8 }}>
              {event.address}
            </AppText>
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`岡山県${event.address}`)}`)}
              style={styles.mapLink}
            >
              <Icon name="map" size={16} color={colors.primary} />
              <AppText variant="labelMd" color={colors.primary}>
                Google Maps で地図を確認
              </AppText>
              <Icon name="open-in-new" size={14} color={colors.primary} />
            </Pressable>
          </InfoRow>
        </View>

        <View style={styles.mapCard}>
          <Image source={{ uri: images.eventMap }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.mapChip}>
            <Icon name="near-me" size={14} color={colors.tertiary} />
            <AppText variant="labelSm" color={colors.onSurface}>
              渋川海岸・松林エリア隣接
            </AppText>
          </View>
        </View>

        <EventRally
          key={`${event.id}:${event.date}:${event.startTime}:${registered}`}
          event={event}
          participation={{ registered, completed: rally.completed }}
          saving={busy || rally.saving || loading || !!error}
          loading={rally.loading}
          loadError={rally.error}
          retry={() => { void rally.reload(); }}
          complete={completeMission}
        />

        <View style={[styles.card, { gap: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="hotel-class" size={22} color={colors.secondaryContainer} />
            <AppText variant="headlineSm">企画の見どころ</AppText>
          </View>
          <AppText variant="bodyMd" color={colors.onSurfaceVariant} style={{ lineHeight: 24 }}>
            学生時代に汗を流した渋川の海を望みながら、夕暮れの潮風とともに思い出を語り合います。未経験の方やご家族連れの参加も歓迎です。防寒着と歩きやすい靴でお越しください。
          </AppText>
        </View>

        <View style={styles.rsvp}>
          <View style={styles.rsvpTop}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={[styles.statusDot, { backgroundColor: registered ? colors.tertiary : colors.outline }]} />
              <AppText variant="labelLg" style={{ flex: 1 }}>
                あなたの出欠ステータス：
                <AppText variant="labelLg" color={registered ? colors.tertiary : colors.outline} style={{ fontFamily: "PlusJakartaSans_700Bold" }}>
                  {registered ? "参加登録済み" : "未登録"}
                </AppText>
              </AppText>
            </View>
            <AppText variant="labelSm" color={colors.onSurfaceVariant}>
              定員まであと{event.remaining}名
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy || rally.saving}
            onPress={() => setRsvpOpen(true)}
            style={[styles.rsvpBtn, (busy || rally.saving) && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Icon name="how-to-reg" size={20} color={colors.onPrimary} />
            )}
            <AppText variant="headlineSm" color={colors.onPrimary}>
              出欠状況の確認・変更
            </AppText>
          </Pressable>
        </View>

        {event.isOrganizer && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/organizer/[id]/invite", params: { id: event.id } })}
            style={styles.organizerBtn}
          >
            <Icon name="forward-to-inbox" size={20} color={colors.primary} />
            <AppText variant="labelLg" color={colors.primary}>
              主催者メニュー：招待リンク・QRコード
            </AppText>
          </Pressable>
        )}
      </ScrollView>

      <BottomSheet visible={shareOpen} onClose={() => setShareOpen(false)}>
        <View style={styles.sheetHead}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={styles.sheetIcon}>
              <Icon name="share" size={18} color={colors.onPrimaryFixed} />
            </View>
            <AppText variant="headlineSm">イベントを仲間と共有</AppText>
          </View>
          <Pressable accessibilityLabel="閉じる" onPress={() => setShareOpen(false)} style={styles.closeBtn}>
            <Icon name="close" size={20} />
          </Pressable>
        </View>
        <AppText variant="bodySm" color={colors.onSurfaceVariant}>
          同窓生やOB・OGのグループに招待リンクを送って一緒に渋川の海へ集まりましょう。
        </AppText>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ShareAction icon="chat" label="LINEで送る" bg={colors.tertiaryContainer} fg={colors.onTertiaryContainer} onPress={shareVia} />
          <ShareAction icon="tag" label="SNSポスト" bg={colors.inverseSurface} fg={colors.inverseOnSurface} onPress={shareVia} />
          <ShareAction icon="content-copy" label="URLコピー" bg={colors.primaryFixed} fg={colors.onPrimaryFixed} onPress={copyLink} />
          <ShareAction
            icon="qr-code-2"
            label="QRコード"
            bg={colors.secondaryFixed}
            fg={colors.onSecondaryFixed}
            onPress={() => {
              setShareOpen(false);
              setQrOpen(true);
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={qrOpen} onClose={() => setQrOpen(false)}>
        <View style={styles.sheetHead}>
          <AppText variant="headlineSm">招待QRコード</AppText>
          <Pressable accessibilityLabel="閉じる" onPress={() => setQrOpen(false)} style={styles.closeBtn}>
            <Icon name="close" size={20} />
          </Pressable>
        </View>
        <View style={styles.qrBox}>
          <QRCode value={linkToShare} size={200} />
        </View>
        <AppText variant="bodySm" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
          スマホのカメラで読み取ると、このイベントの招待ページが開きます。
        </AppText>
      </BottomSheet>

      <BottomSheet visible={rsvpOpen} onClose={() => setRsvpOpen(false)}>
        <AppText variant="headlineSm">出欠状況の変更</AppText>
        <View style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => changeRsvp(true)}
            style={[styles.choice, registered && styles.choiceActive]}
          >
            <Icon name="how-to-reg" size={20} color={colors.primary} />
            <AppText variant="labelLg">参加する</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => changeRsvp(false)}
            style={[styles.choice, !registered && styles.choiceActive]}
          >
            <Icon name="close" size={20} color={colors.error} />
            <AppText variant="labelLg">参加をとりやめる</AppText>
          </Pressable>
        </View>
      </BottomSheet>

      <Toast toast={toast} onHide={hideToast} bottom={24} />
    </View>
  );
}

function InfoRow({
  icon,
  tint,
  fg,
  label,
  children,
}: {
  icon: IconName;
  tint: string;
  fg: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
      <View style={[styles.infoIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={22} color={fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="labelMd" color={colors.onSurfaceVariant}>
          {label}
        </AppText>
        {children}
      </View>
    </View>
  );
}

function ShareAction({
  icon,
  label,
  bg,
  fg,
  onPress,
}: {
  icon: IconName;
  label: string;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.shareAction}>
      <View style={[styles.shareIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={22} color={fg} />
      </View>
      <AppText variant="labelMd">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.margin, gap: 20, paddingBottom: 40 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  shareBtn: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  hero: { height: 208, borderRadius: radius.card, overflow: "hidden", justifyContent: "flex-end" },
  heroText: { padding: 20, gap: 6 },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: "rgba(250,248,255,0.85)",
  },
  card: { padding: 20, borderRadius: radius.card, backgroundColor: colors.surfaceContainerLowest, gap: 16 },
  infoIcon: { width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceContainerHigh },
  mapLink: {
    alignSelf: "flex-start",
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
  },
  mapCard: { height: 144, borderRadius: radius.card, overflow: "hidden", justifyContent: "flex-end" },
  mapChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    margin: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: "rgba(250,248,255,0.9)",
  },
  rsvp: {
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceContainerHigh,
    gap: 12,
  },
  rsvpTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  rsvpBtn: {
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  shareAction: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
  },
  shareIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  choice: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  choiceActive: { backgroundColor: colors.primaryFixed },
  organizerBtn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  qrBox: {
    alignSelf: "center",
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: "#ffffff",
  },
});
