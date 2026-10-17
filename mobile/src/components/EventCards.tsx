import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/src/constants/theme";
import { formatJaDate, formatShortDate } from "@/src/lib/dates";
import type { EventSummary } from "@/src/types/event";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

/** カレンダーで選んだ日のイベントを大きく見せるカード */
export function EventCard({ event, onOpen }: { event: EventSummary; onOpen: () => void }) {
  const almostFull = event.remaining <= 12;
  return (
    <View style={styles.card}>
      <View style={{ height: 144 }}>
        <Image source={{ uri: event.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["transparent", "rgba(19,27,46,0.8)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Icon name="groups" size={13} color={colors.onSecondary} />
            <AppText variant="labelSm" color={colors.onSecondary}>
              {event.scope === "open" ? "全員参加OK" : "招待制"}
            </AppText>
          </View>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
            <AppText variant="labelSm" color={colors.primary}>
              定員{event.capacity}名
            </AppText>
          </View>
        </View>
        <View style={styles.coverBottom}>
          <View style={styles.dateRow}>
            <Icon name="calendar-today" size={16} color={colors.secondaryFixed} />
            <AppText variant="labelMd" color="#ffffff">
              {formatJaDate(event.date)}
            </AppText>
          </View>
          {almostFull && (
            <View style={[styles.badge, { backgroundColor: "rgba(0,123,185,0.85)" }]}>
              <AppText variant="labelSm" color={colors.onPrimaryContainer}>
                残席わずか
              </AppText>
            </View>
          )}
        </View>
      </View>

      <View style={{ padding: space.md, gap: 12 }}>
        <View>
          <AppText variant="headlineSm">{event.title}</AppText>
          <AppText variant="bodySm" color={colors.onSurfaceVariant} numberOfLines={2} style={{ marginTop: 4 }}>
            {event.description}
          </AppText>
        </View>

        <View style={styles.meta}>
          <MetaRow icon="schedule" label="開催時間">
            {`${event.startTime} 〜 ${event.endTime}${event.receptionNote ? `（${event.receptionNote}）` : ""}`}
          </MetaRow>
          <MetaRow icon="location-on" label="集合場所">
            {event.placeShort}
          </MetaRow>
        </View>

        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.cta}>
          <AppText variant="labelLg" color={colors.onPrimary}>
            イベント詳細を見る
          </AppText>
          <Icon name="arrow-forward" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function MetaRow({ icon, label, children }: { icon: "schedule" | "location-on"; label: string; children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <View style={{ marginTop: 2 }}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="labelSm" color={colors.outline}>
          {label}
        </AppText>
        <AppText variant="bodyMd" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
          {children}
        </AppText>
      </View>
    </View>
  );
}

/** おすすめ欄の小さなカード */
export function MiniEventCard({ event, onOpen }: { event: EventSummary; onOpen: () => void }) {
  const tagColors =
    event.tag.tone === "tertiary"
      ? { bg: colors.tertiaryFixed, fg: colors.onTertiaryFixed }
      : { bg: colors.secondaryFixed, fg: colors.onSecondaryFixed };
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.mini}>
      <View style={styles.miniThumb}>
        <Image source={{ uri: event.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.miniDate}>
          <AppText variant="labelSm" color={colors.onPrimary}>
            {formatShortDate(event.date)}
          </AppText>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={[styles.tag, { backgroundColor: tagColors.bg }]}>
          <AppText variant="labelSm" color={tagColors.fg}>
            {event.tag.label}
          </AppText>
        </View>
        <AppText variant="labelLg" numberOfLines={1}>
          {event.title}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="schedule" size={14} color={colors.outline} />
          <AppText variant="bodySm" color={colors.outline} numberOfLines={1} style={{ flex: 1 }}>
            {event.startTime}〜{event.endTime} / {event.place}
          </AppText>
        </View>
      </View>
      <View style={styles.chevron}>
        <Icon name="chevron-right" size={18} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  badges: { position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  coverBottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, padding: 12, gap: 8 },
  cta: {
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mini: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  miniThumb: { width: 80, height: 80, borderRadius: 12, overflow: "hidden" },
  miniDate: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
