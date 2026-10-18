import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/src/components/AppText";
import { CreateEventFab } from "@/src/components/CreateEventFab";
import { EventCalendar } from "@/src/components/EventCalendar";
import { EventCard, MiniEventCard } from "@/src/components/EventCards";
import { Icon } from "@/src/components/Icon";
import { colors, radius, space } from "@/src/constants/theme";
import { useEvents } from "@/src/hooks/useEvents";
import { toDateKey } from "@/src/lib/dates";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(today));
  const { events, loading, error } = useEvents(cursor.year, cursor.month);

  // 最初の読み込み後に、今日以降で一番近いイベントの日を選ぶ。なければ今日のまま
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || loading) return;
    autoSelected.current = true;
    const upcoming = events.map((e) => e.date).filter((d) => d >= toDateKey(today)).sort();
    if (upcoming[0]) setSelectedKey(upcoming[0]);
  }, [events, loading]);

  const eventDates = useMemo(() => new Set(events.map((e) => e.date)), [events]);
  const selectedEvents = events.filter((e) => e.date === selectedKey);
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const recommended = events.filter((e) => e.date.startsWith(monthPrefix));

  const moveMonth = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedKey(toDateKey(today));
  };
  const openEvent = (id: string) => router.push({ pathname: "/events/[id]", params: { id } });

  return (
    <>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 80 + insets.bottom }]}>
      <View style={styles.toolbar}>
        <View style={styles.viewToggle}>
          <View style={[styles.toggleBtn, styles.toggleActive]}>
            <Icon name="calendar-month" size={18} color={colors.primary} />
            <AppText variant="labelMd" color={colors.primary}>
              カレンダー
            </AppText>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={goToday} style={styles.todayBtn}>
          <Icon name="today" size={16} color={colors.primary} />
          <AppText variant="labelMd" color={colors.primary}>
            今日
          </AppText>
        </Pressable>
      </View>

      <View style={styles.monthRow}>
        <AppText variant="headlineLgMobile">
          {cursor.year}年 {cursor.month + 1}月
        </AppText>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable accessibilityLabel="前月" onPress={() => moveMonth(-1)} style={styles.arrow}>
            <Icon name="chevron-left" size={20} color={colors.onSurfaceVariant} />
          </Pressable>
          <Pressable accessibilityLabel="翌月" onPress={() => moveMonth(1)} style={styles.arrow}>
            <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      <EventCalendar
        year={cursor.year}
        month={cursor.month}
        selectedKey={selectedKey}
        eventDates={eventDates}
        onSelect={setSelectedKey}
      />

      <View style={{ gap: space.sm, paddingTop: 4 }}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitle}>
            <Icon name="event-available" size={20} color={colors.primary} />
            <AppText variant="headlineSm">選択した日程のイベント</AppText>
          </View>
          <AppText variant="labelMd" color={colors.primary}>
            {selectedEvents.length}件
          </AppText>
        </View>
        {error ? (
          <View style={styles.empty}>
            <AppText variant="bodyMd" color={colors.error}>
              {error}
            </AppText>
          </View>
        ) : loading && events.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : selectedEvents.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="bodyMd" color={colors.onSurfaceVariant}>
              この日のイベントはありません
            </AppText>
          </View>
        ) : (
          selectedEvents.map((e) => <EventCard key={e.id} event={e} onOpen={() => openEvent(e.id)} />)
        )}
      </View>

      {recommended.length > 0 && (
        <View style={{ gap: space.sm, paddingTop: 8 }}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitle}>
              <Icon name="auto-awesome" size={20} color={colors.secondary} />
              <AppText variant="headlineSm">あなたにおすすめの再会イベント</AppText>
            </View>
          </View>
          {recommended.map((e) => (
            <MiniEventCard key={e.id} event={e} onOpen={() => openEvent(e.id)} />
          ))}
        </View>
      )}

      </ScrollView>
      <CreateEventFab />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.margin, gap: space.md },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerHigh,
    padding: 4,
    borderRadius: radius.full,
  },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  toggleActive: { backgroundColor: colors.surfaceContainerLowest },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: "rgba(204,229,255,0.4)",
  },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  empty: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: "center",
  },
});
