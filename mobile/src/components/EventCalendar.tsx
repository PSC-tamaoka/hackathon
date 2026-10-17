import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/src/constants/theme";
import { toDateKey } from "@/src/lib/dates";
import { AppText } from "./AppText";

const DAY_HEADERS = ["日", "月", "火", "水", "木", "金", "土"];

type Cell = { key: string; day: number; inMonth: boolean; weekday: number };

function buildCells(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: toDateKey(d), day: d.getDate(), inMonth: d.getMonth() === month, weekday: d.getDay() };
  });
}

type Props = {
  year: number;
  /** 0始まり */
  month: number;
  selectedKey: string;
  /** イベントのある日(YYYY-MM-DD) */
  eventDates: ReadonlySet<string>;
  onSelect: (dateKey: string) => void;
};

export function EventCalendar({ year, month, selectedKey, eventDates, onSelect }: Props) {
  const cells = buildCells(year, month);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {DAY_HEADERS.map((label, i) => (
          <AppText
            key={label}
            variant="labelMd"
            color={i === 0 ? colors.error : i === 6 ? colors.primary : colors.outline}
            style={styles.headerCell}
          >
            {label}
          </AppText>
        ))}
      </View>

      <View style={{ gap: 6 }}>
        {rows.map((row) => (
          <View key={row[0].key} style={styles.row}>
            {row.map((cell) => {
              if (!cell.inMonth) {
                return (
                  <View key={cell.key} style={styles.cell}>
                    <AppText variant="labelLg" color={colors.outlineVariant}>
                      {cell.day}
                    </AppText>
                  </View>
                );
              }
              const selected = cell.key === selectedKey;
              const hasEvent = eventDates.has(cell.key);
              const textColor = selected
                ? colors.onPrimary
                : cell.weekday === 0
                  ? colors.error
                  : cell.weekday === 6
                    ? colors.primary
                    : colors.onSurface;
              return (
                <View key={cell.key} style={styles.cell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${month + 1}月${cell.day}日${hasEvent ? " イベントあり" : ""}`}
                    onPress={() => onSelect(cell.key)}
                    style={[styles.day, selected && styles.daySelected]}
                  >
                    <AppText variant="labelLg" color={textColor}>
                      {cell.day}
                    </AppText>
                    <View
                      style={[
                        styles.dot,
                        hasEvent
                          ? { backgroundColor: selected ? colors.secondaryFixed : colors.primary }
                          : { backgroundColor: "transparent" },
                      ]}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <AppText variant="bodySm" color={colors.onSurfaceVariant}>
            同窓・交流イベント
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.secondaryContainer }]} />
          <AppText variant="bodySm" color={colors.onSurfaceVariant}>
            選択中の日
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  row: { flexDirection: "row" },
  headerCell: { flex: 1, textAlign: "center" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48 },
  day: {
    width: 44,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: { backgroundColor: colors.primary, transform: [{ scale: 1.05 }] },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceContainerHigh,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
