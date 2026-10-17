import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { images } from "@/src/constants/images";
import { colors, fonts, radius, space } from "@/src/constants/theme";
import { createEvent, errorMessage } from "@/src/lib/api";
import { parseDateKey, toDateKey, weekdayLabel } from "@/src/lib/dates";
import type { EventScope, RainPolicy } from "@/src/types/event";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { Toast, type ToastState } from "./Toast";

const DEFAULT_PLACE = "岡山県渋川青年の家（玉野市渋川二丁目7番1号）";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TITLE_MAX = 40;
const TITLE_PRESETS = [
  "⛵ カッター漕艇＆浜辺の夕陽座談会",
  "🔥 浜辺の焚き火ナイト",
  "🌊 渋川海岸 朝のクリーンウォーク＆地引網",
];
const RAIN_OPTIONS: { value: RainPolicy; label: string; icon: IconName }[] = [
  { value: "showers_ok", label: "小雨決行", icon: "beach-access" },
  { value: "severe_cancel", label: "荒天時中止", icon: "thunderstorm" },
  { value: "indoor_shift", label: "室内へ変更", icon: "meeting-room" },
];
const SPOT_TAGS = ["カッター艇庫前", "第1研修室", "渋川海岸 東浜ベンチ"];
const EXPERIENCE_TAGS = ["カッター体験", "地引網", "砂浜座談会", "キャンプファイヤー", "夕陽フォトウォーク"];

const SCOPE_INFO: Record<
  EventScope,
  { icon: IconName; title: string; text: string; submitLabel: string; submitIcon: IconName }
> = {
  open: {
    icon: "public",
    title: "全員公開モード",
    text: "公開完了と同時に、メンバー全員のホーム新着およびお知らせフィードに自動配信されます。",
    submitLabel: "イベントを作成して公開する",
    submitIcon: "rocket-launch",
  },
  closed: {
    icon: "lock",
    title: "招待制（クローズド）を選択中",
    text: "招待制の場合、作成完了後に専用の招待URL発行・参加対象者送信画面へ進みます。一般フィードには掲載されません。",
    submitLabel: "作成して招待対象の設定へ進む",
    submitIcon: "forward-to-inbox",
  },
};

function upcomingDays(count: number) {
  const base = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i + 1);
    return { key: toDateKey(d), month: d.getMonth() + 1, day: d.getDate(), weekday: weekdayLabel(d), dow: d.getDay() };
  });
}

/** イベント作成フォーム(O-02)。保存すると作った人が主催者になる */
export function EventForm() {
  const router = useRouter();
  const days = upcomingDays(3);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [dateKey, setDateKey] = useState(days[0].key);
  const [customDate, setCustomDate] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [startTime, setStartTime] = useState("15:30");
  const [endTime, setEndTime] = useState("19:30");
  const [rain, setRain] = useState<RainPolicy>("showers_ok");
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [placeDetail, setPlaceDetail] = useState("");
  const [scope, setScope] = useState<EventScope>("open");
  const [capacity, setCapacity] = useState(30);
  const [tags, setTags] = useState<Set<string>>(() => new Set(["カッター体験", "砂浜座談会"]));
  const [toast, setToast] = useState<ToastState>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const info = SCOPE_INFO[scope];

  const applyCustomDate = (text: string) => {
    setCustomDate(text);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(parseDateKey(text).getTime())) {
      setDateKey(text);
      const d = parseDateKey(text);
      setToast({ heading: "日程変更", body: `${d.getMonth() + 1}月${d.getDate()}日 に設定しました`, icon: "event" });
    }
  };

  const toggleTag = (tag: string) =>
    setTags((prev) => {
      const next = new Set(prev);
      if (!next.delete(tag)) next.add(tag);
      return next;
    });

  const appendDetail = (text: string) => {
    if (placeDetail.includes(text)) return;
    setPlaceDetail(placeDetail ? `${placeDetail} / ${text}` : text);
  };

  const save = async (draft: boolean) => {
    const name = title.trim();
    if (!name) {
      setToast({ heading: "入力が必要です", body: "イベント名を入力してください。", icon: "warning" });
      return;
    }
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
      setToast({ heading: "時刻を確認してください", body: "開始・終了時刻は 15:30 のように入力してください。", icon: "warning" });
      return;
    }
    if (endTime <= startTime) {
      setToast({ heading: "時刻を確認してください", body: "終了時刻は開始時刻より後にしてください。", icon: "warning" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const id = await createEvent({
        title: name,
        date: dateKey,
        startTime,
        endTime,
        place: place.trim() || DEFAULT_PLACE,
        placeDetail: placeDetail.trim(),
        capacity,
        scope,
        rainPolicy: rain,
        tags: [...tags],
        draft,
      });
      if (draft) {
        setToast({ heading: "下書き保存", body: "下書きとして保存しました（カレンダーには自分にだけ表示されます）。", icon: "bookmark" });
      } else if (scope === "closed") {
        setToast({ heading: "イベント保存完了", body: "招待リンクを発行します。招待設定画面へ移動します。", icon: "send" });
        router.push({ pathname: "/organizer/[id]/invite", params: { id } });
      } else {
        setToast({ heading: "公開完了！", body: `「${name}」が全員のカレンダーに公開されました。`, icon: "celebration" });
        router.push({ pathname: "/events/[id]", params: { id } });
      }
    } catch (e) {
      setToast({ heading: "保存できませんでした", body: errorMessage(e), icon: "warning" });
    } finally {
      setBusy(false);
    }
  };
  const submit = () => save(false);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={styles.adminPill}>
            <Icon name="shield" size={16} color={colors.onSecondaryFixed} />
            <AppText variant="labelSm" color={colors.onSecondaryFixed}>
              管理者 / 主催者専用
            </AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={styles.liveDot} />
            <AppText variant="bodySm" color={colors.onSurfaceVariant}>
              渋川ステーション編集中
            </AppText>
          </View>
        </View>

        <View>
          <AppText variant="headlineLgMobile">新しい同窓イベントを企画</AppText>
          <AppText variant="bodySm" color={colors.onSurfaceVariant} style={{ marginTop: 4 }}>
            瀬戸内の風を感じる思い出のひとときを仲間へ届けましょう。
          </AppText>
        </View>

        {/* 1. イベント名 */}
        <Section>
          <SectionHead icon="sailing" label="イベント名" required right={`${title.length}/${TITLE_MAX}`} />
          <TextInput
            value={title}
            onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
            placeholder="例：カッター漕艇＆浜辺の夕陽座談会"
            placeholderTextColor={colors.outline}
            style={styles.input}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TITLE_PRESETS.map((p) => (
              <Pressable key={p} onPress={() => setTitle(p.replace(/^\S+\s/, "").slice(0, TITLE_MAX))} style={styles.presetChip}>
                <AppText variant="labelSm" color={colors.primary}>
                  {p}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        {/* 2. 日時・天候 */}
        <Section>
          <SectionHead icon="calendar-today" label="日時・天候設定" required />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {days.map((d) => {
              const active = d.key === dateKey && !showCustom;
              return (
                <Pressable
                  key={d.key}
                  accessibilityRole="button"
                  onPress={() => {
                    setDateKey(d.key);
                    setShowCustom(false);
                  }}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                >
                  <AppText variant="labelSm" color={active ? colors.primaryFixed : colors.outline}>
                    {d.month}月
                  </AppText>
                  <AppText variant="headlineSm" color={active ? colors.onPrimary : colors.onSurface}>
                    {d.day}
                  </AppText>
                  <AppText
                    variant="labelSm"
                    color={active ? colors.primaryFixed : d.dow === 0 ? colors.error : colors.primary}
                  >
                    {d.weekday}
                  </AppText>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCustom((v) => !v)}
              style={[styles.dateChip, showCustom && styles.dateChipActive]}
            >
              <Icon name="calendar-month" size={20} color={showCustom ? colors.onPrimary : colors.primary} />
              <AppText variant="labelSm" color={showCustom ? colors.onPrimary : colors.onSurface} style={{ marginTop: 2 }}>
                他日程
              </AppText>
            </Pressable>
          </View>
          {showCustom && (
            <TextInput
              value={customDate}
              onChangeText={applyCustomDate}
              placeholder="YYYY-MM-DD（例：2026-11-03）"
              placeholderTextColor={colors.outline}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={styles.input}
            />
          )}

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TimeField label="開始時刻" value={startTime} onChange={setStartTime} />
            <TimeField label="終了時刻" value={endTime} onChange={setEndTime} />
          </View>

          <View style={{ gap: 8 }}>
            <AppText variant="labelSm" color={colors.onSurfaceVariant}>
              雨天・波浪時の対応
            </AppText>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {RAIN_OPTIONS.map((o) => {
                const active = rain === o.value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setRain(o.value)}
                    style={[styles.rainChip, active && { backgroundColor: colors.primaryContainer }]}
                  >
                    <Icon name={o.icon} size={18} color={active ? colors.onPrimaryContainer : colors.onSurface} />
                    <AppText variant="labelSm" color={active ? colors.onPrimaryContainer : colors.onSurface}>
                      {o.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        {/* 3. 集合場所 */}
        <Section>
          <SectionHead icon="location-on" label="集合場所設定" required right="玉野市渋川" />
          <View style={styles.mapThumb}>
            <Image source={{ uri: images.createMap }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["transparent", "rgba(40,48,68,0.8)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.mapLabel}>
              <Icon name="pin-drop" size={16} color={colors.secondaryContainer} />
              <AppText variant="labelSm" color={colors.onPrimary} numberOfLines={1} style={{ flex: 1 }}>
                岡山県渋川青年の家（海岸隣接ピロティ）
              </AppText>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <AppText variant="labelSm" color={colors.onSurfaceVariant}>
              施設・基準地点
            </AppText>
            <View style={{ justifyContent: "center" }}>
              <TextInput value={place} onChangeText={setPlace} style={[styles.inputSm, { paddingRight: 44 }]} />
              <Pressable
                accessibilityLabel="リセット"
                onPress={() => setPlace(DEFAULT_PLACE)}
                style={styles.resetBtn}
              >
                <Icon name="replay" size={18} color={colors.outline} />
              </Pressable>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <AppText variant="labelSm" color={colors.onSurfaceVariant}>
              集合詳細・目印（敷地内）
            </AppText>
            <TextInput
              value={placeDetail}
              onChangeText={setPlaceDetail}
              placeholder="例：前庭ピロティ・カッター艇庫前"
              placeholderTextColor={colors.outline}
              style={styles.inputSm}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {SPOT_TAGS.map((s) => (
              <Pressable key={s} onPress={() => appendDetail(s)} style={styles.spotChip}>
                <AppText variant="labelSm" color={colors.onSurfaceVariant}>
                  + {s}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* 4. 公開形式 */}
        <Section>
          <SectionHead icon="hub" label="共有設定・公開形式" required />
          <ScopeOption
            active={scope === "open"}
            onPress={() => setScope("open")}
            title="全員参加（オープン）"
            badge="公開"
            badgeBg={colors.tertiaryFixed}
            badgeFg={colors.onTertiaryFixed}
            text="渋川つながり登録者全員や一般向けに公開されます。全体のカレンダー・タイムラインに自動表示されます。"
          />
          <ScopeOption
            active={scope === "closed"}
            onPress={() => setScope("closed")}
            title="招待制（クローズド）"
            badge="限定"
            badgeBg={colors.secondaryContainer}
            badgeFg={colors.onSecondaryContainer}
            text="専用招待URLやメール・プッシュ招待通知を受け取った人のみが閲覧・参加登録できます。"
          />
          <View style={styles.scopeNotice}>
            <Icon name={info.icon} size={20} color={scope === "closed" ? colors.secondary : colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="labelMd">{info.title}</AppText>
              <AppText variant="bodySm" color={colors.onSurfaceVariant}>
                {info.text}
              </AppText>
            </View>
          </View>
        </Section>

        {/* 5. 追加オプション */}
        <Section gap={16}>
          <SectionHead icon="tune" label="追加オプション（任意）" right="詳細カスタマイズ" />
          <View style={styles.capacity}>
            <View style={{ flex: 1 }}>
              <AppText variant="labelMd">定員設定</AppText>
              <AppText variant="bodySm" color={colors.outline}>
                5〜200名で設定できます
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable
                accessibilityLabel="定員を減らす"
                onPress={() => setCapacity((c) => Math.max(5, c - 5))}
                style={styles.stepBtn}
              >
                <Icon name="remove" size={18} />
              </Pressable>
              <AppText variant="headlineSm" color={colors.primary} style={{ width: 52, textAlign: "center" }}>
                {capacity}名
              </AppText>
              <Pressable
                accessibilityLabel="定員を増やす"
                onPress={() => setCapacity((c) => Math.min(200, c + 5))}
                style={styles.stepBtn}
              >
                <Icon name="add" size={18} />
              </Pressable>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <AppText variant="labelSm" color={colors.onSurfaceVariant}>
              体験メニュー・特色タグの付与
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {EXPERIENCE_TAGS.map((t) => {
                const active = tags.has(t);
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => toggleTag(t)}
                    style={[styles.tagChip, active && { backgroundColor: colors.primary }]}
                  >
                    {active && <Icon name="check" size={16} color={colors.onPrimary} />}
                    <AppText variant="labelMd" color={active ? colors.onPrimary : colors.onSurfaceVariant}>
                      {t}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <View style={{ gap: 12, paddingTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={submit}
            style={[styles.submit, busy && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Icon name={info.submitIcon} size={22} color={colors.onPrimary} />
            )}
            <AppText variant="labelLg" color={colors.onPrimary} style={{ fontFamily: fonts.bold }}>
              {info.submitLabel}
            </AppText>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => save(true)}
              style={styles.draft}
            >
              <Icon name="bookmark-border" size={18} />
              <AppText variant="labelMd">下書きとして保存</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setToast({ heading: "プレビュー", body: "渋川同窓カレンダー表示のプレビューを生成中...", icon: "preview" })
              }
              style={styles.preview}
            >
              <Icon name="visibility" size={20} color={colors.primary} />
              <AppText variant="labelMd" color={colors.primary}>
                プレビュー
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Toast toast={toast} onHide={hideToast} />
    </View>
  );
}

function Section({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return <View style={[styles.section, { gap }]}>{children}</View>;
}

function SectionHead({
  icon,
  label,
  required,
  right,
}: {
  icon: IconName;
  label: string;
  required?: boolean;
  right?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
        <Icon name={icon} size={20} color={colors.primary} />
        <AppText variant="labelLg">
          {label}
          {required && <AppText variant="bodySm" color={colors.error}> *</AppText>}
        </AppText>
      </View>
      {right && (
        <AppText variant="labelSm" color={colors.outline}>
          {right}
        </AppText>
      )}
    </View>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <AppText variant="labelSm" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={colors.outline}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={[styles.inputSm, { textAlign: "center", fontFamily: fonts.semibold, fontSize: 18 }]}
      />
    </View>
  );
}

function ScopeOption({
  active,
  onPress,
  title,
  badge,
  badgeBg,
  badgeFg,
  text,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  badge: string;
  badgeBg: string;
  badgeFg: string;
  text: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.scope, active && { backgroundColor: "rgba(204,229,255,0.4)" }]}
    >
      <View style={[styles.radio, active && { borderColor: colors.primary }]}>
        {active && <View style={styles.radioDot} />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <AppText variant="headlineSm">{title}</AppText>
          <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full }}>
            <AppText variant="labelSm" color={badgeFg}>
              {badge}
            </AppText>
          </View>
        </View>
        <AppText variant="bodySm" color={colors.onSurfaceVariant} style={{ lineHeight: 18 }}>
          {text}
        </AppText>
      </View>
    </Pressable>
  );
}

const inputBase = {
  borderRadius: radius.md,
  backgroundColor: colors.surfaceContainerLow,
  color: colors.onSurface,
  fontFamily: fonts.regular,
  fontSize: 14,
} as const;

const styles = StyleSheet.create({
  content: { padding: space.margin, gap: 20, paddingBottom: space.xl },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  adminPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryFixed,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tertiary },
  section: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surfaceContainerLowest },
  input: { ...inputBase, minHeight: 48, paddingHorizontal: 16 },
  inputSm: { ...inputBase, minHeight: 44, paddingHorizontal: 16 },
  presetChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
  },
  dateChip: {
    flex: 1,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    elevation: 3,
  },
  rainChip: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  mapThumb: { height: 112, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  mapLabel: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
  resetBtn: { position: "absolute", right: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  spotChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
  },
  scope: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  radio: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  scopeNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  capacity: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  tagChip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
  },
  submit: {
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  draft: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  preview: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
