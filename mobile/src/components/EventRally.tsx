import { useAudioPlayer } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import { Icon } from "./Icon";
import { RallySongPlayer } from "./RallySongPlayer";
import { rallySong } from "../constants/rallyMedia";
import { colors, radius } from "../constants/theme";
import { useRallyPeriod } from "../hooks/useRallyPeriod";
import { rallyMissions, rallyPeriod, type RallyMission } from "../lib/eventRally";
import type { EventSummary, RallyParticipation } from "../types/event";

type Props = {
  event: EventSummary;
  participation: RallyParticipation;
  saving: boolean;
  loading: boolean;
  loadError: string | null;
  retry: () => void;
  complete: (id: string) => Promise<string[]>;
};

export function EventRally(props: Props) {
  const period = useRallyPeriod(props.event);
  if (props.event.status === "canceled") return (
    <View style={styles.card}>
      <AppText variant="headlineSm">TODO・スタンプラリー</AppText>
      <AppText>中止になったイベントのミッションは利用できません。</AppText>
    </View>
  );
  if (props.loading || props.loadError) return (
    <View style={styles.card}>
      <AppText variant="headlineSm">TODO・スタンプラリー</AppText>
      {props.loading ? <ActivityIndicator color={colors.primary} /> : <>
        <AppText accessibilityRole="alert">進捗を読み込めませんでした。通信環境を確認して再試行してください。</AppText>
        <Pressable accessibilityRole="button" onPress={props.retry} style={styles.secondary}>
          <AppText>再試行</AppText>
        </Pressable>
      </>}
    </View>
  );
  // この子をアンマウントして、期限到達時に確認・演出・動画もまとめて終了する。
  if (period === "active") return <ActiveRally {...props} />;
  return (
    <View style={styles.card}>
      <AppText variant="headlineSm">TODO・スタンプラリー</AppText>
      <AppText color={colors.onSurfaceVariant}>
        {period === "before" ? "イベント開始時刻になるとミッションが公開されます。" : "スタンプラリーの公開期間は終了しました。"}
      </AppText>
    </View>
  );
}

function ActiveRally({ event, participation, saving, complete }: Props) {
  const [selected, setSelected] = useState<RallyMission | null>(null);
  const [achievement, setAchievement] = useState<RallyMission | null>(null);
  const [songOpen, setSongOpen] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const stamp = useRef(new Animated.Value(0)).current;
  const keywords = useRef(rallyMissions.map(() => new Animated.Value(0))).current;
  const submitting = useRef(false);
  const mounted = useRef(true);
  const successSound = useAudioPlayer(require("../../assets/audio/mission.wav"));
  const completeSound = useAudioPlayer(require("../../assets/audio/complete.wav"));
  const done = new Set(participation.completed.filter((id) => rallyMissions.some((mission) => mission.id === id)));
  const allDone = rallyMissions.every((mission) => done.has(mission.id));
  const percent = Math.round((done.size / rallyMissions.length) * 100);
  const allowed = participation.registered && !saving;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!achievement) return;
    stamp.setValue(0);
    keywords.forEach((value) => value.setValue(0));
    const animation = Animated.sequence([
      Animated.spring(stamp, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.stagger(110, keywords.map((value) => Animated.timing(value, { toValue: 1, duration: 400, useNativeDriver: true }))),
    ]);
    animation.start();
    return () => animation.stop();
  }, [achievement, keywords, stamp]);

  const confirm = async () => {
    if (!selected || submitting.current || !allowed) return;
    submitting.current = true;
    setError("");
    try {
      const result = await complete(selected.id);
      if (!mounted.current) return;
      setSelected(null);
      if (rallyPeriod(event) !== "active") return;
      setAchievement(selected);
      // 保存は既に成功。効果音の不調を保存失敗として扱わない。
      if (!muted) {
        const player = rallyMissions.every((mission) => result.includes(mission.id)) ? completeSound : successSound;
        try { await player.seekTo(0); if (mounted.current) player.play(); } catch { /* 消音環境でも達成は保持 */ }
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && /利用時間外|参加登録/.test(cause.message)
        ? cause.message : "保存できませんでした。未達成のままです。「達成する」で再試行できます。");
    } finally {
      submitting.current = false;
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.row, { flex: 1 }]}>
          <Icon name="task-alt" size={24} color={colors.primary} />
          <AppText variant="headlineSm" style={{ flexShrink: 1 }}>当日のTODOリスト</AppText>
        </View>
        <View style={styles.count}><AppText variant="labelLg">{done.size}/5 完了</AppText></View>
      </View>
      <AppText variant="bodySm" color={colors.onSurfaceVariant}>
        5つの体験でキーワードを集めよう。すべて達成すると「海事研修の歌」が解放されます。利用は開催日の翌日いっぱいまで。
      </AppText>
      {!participation.registered && <AppText color={colors.error}>達成操作には参加登録が必要です。</AppText>}
      <View style={styles.row}>
        <AppText variant="labelSm">達成度 {percent}%</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? "効果音をオンにする" : "効果音をオフにする"} onPress={() => setMuted(!muted)} style={{ padding: 10 }}>
          <Icon name={muted ? "volume-off" : "volume-up"} color={colors.primary} />
        </Pressable>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 5, now: done.size }} style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      {rallyMissions.map((mission) => {
        const checked = done.has(mission.id);
        const disabled = checked || !allowed;
        return (
          <Pressable key={mission.id} accessibilityRole="button" accessibilityLabel={`${mission.text}${checked ? " 達成済み" : ""}`}
            accessibilityState={{ disabled }} disabled={disabled}
            onPress={() => { if (rallyPeriod(event) === "active") { setSelected(mission); setError(""); } }}
            style={[styles.todo, !participation.registered && { opacity: 0.6 }]}>
            <View style={[styles.box, checked && { backgroundColor: colors.primary }]}>
              <Icon name={checked ? "check" : "flag"} size={18} color={checked ? colors.onPrimary : colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyMd">{mission.text}</AppText>
              <AppText variant="bodySm" color={colors.onSurfaceVariant}>{mission.description}</AppText>
              {checked && <AppText variant="labelMd" color={colors.primary}>達成済み · キーワード「{mission.keyword}」</AppText>}
            </View>
          </Pressable>
        );
      })}
      {allDone && (
        <View style={{ gap: 12 }}>
          <AppText variant="headlineSm" color={colors.primary}>5つの思い出がそろいました！</AppText>
          <Pressable accessibilityRole="button" disabled={!participation.registered} style={styles.primary}
            onPress={() => { if (rallyPeriod(event) === "active") setSongOpen(true); }}>
            <AppText color={colors.onPrimary}>海事研修の歌を聴く</AppText>
          </Pressable>
        </View>
      )}

      <BottomSheet visible={(!!selected || !!achievement || songOpen) && participation.registered} onClose={() => {
        if (!saving) { setSelected(null); setAchievement(null); setSongOpen(false); }
      }}>
        {!!selected && <>
        <AppText variant="headlineSm">ミッション達成の確認</AppText>
        <AppText>{selected?.text}</AppText>
        <AppText>このミッションを達成しましたか？ 一度達成すると取り消せません。</AppText>
        {!!error && <AppText accessibilityRole="alert" color={colors.error}>{error}</AppText>}
        <View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={saving} style={styles.secondary} onPress={() => setSelected(null)}><AppText>キャンセル</AppText></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} style={styles.primary} onPress={confirm}>
            <AppText color={colors.onPrimary}>{saving ? "保存中…" : "達成する"}</AppText>
          </Pressable>
        </View>
        </>}
        {!!achievement &&
        <ScrollView contentContainerStyle={{ gap: 20 }} style={{ maxHeight: 460 }}>
          <Animated.View style={{ alignItems: "center", gap: 8, transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) }], opacity: stamp }}>
            <Icon name={allDone ? "emoji-events" : "verified"} size={64} color={colors.primary} />
            <AppText variant="headlineSm">{allDone ? "全ミッション達成！" : "ミッション達成！"}</AppText>
            <AppText>{achievement?.text}</AppText>
          </Animated.View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {rallyMissions.filter((mission) => allDone || mission.id === achievement?.id).map((mission) => {
              const value = keywords[rallyMissions.indexOf(mission)];
              return <Animated.View key={mission.id} style={[styles.keyword, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }] }]}>
                <AppText color={colors.primary}>{mission.keyword}</AppText>
              </Animated.View>;
            })}
          </View>
          <AppText>{allDone ? "あの日の海と、今日の仲間。渋川でつながった思い出を、これからも大切に。懐かしい歌とともに振り返りましょう。" : "新しいキーワードが解放されました。次の体験も楽しもう！"}</AppText>
          <Pressable accessibilityRole="button" style={styles.primary} onPress={() => { setAchievement(null); if (allDone) setSongOpen(true); }}>
            <AppText color={colors.onPrimary}>{allDone ? "海事研修の歌を聴く" : "ミッションに戻る"}</AppText>
          </Pressable>
        </ScrollView>}
        {songOpen && allDone && <>
        <AppText variant="headlineSm">海事研修の歌を聴く</AppText>
        {songOpen && allDone && participation.registered && <RallySongPlayer />}
        <AppText variant="bodySm" color={colors.onSurfaceVariant}>歌唱・公開：{rallySong.credit}（YouTube）</AppText>
        <AppText variant="bodySm">再生ボタンを押してお聴きください。利用は開催日の翌日23:59:59までです。</AppText>
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setSongOpen(false)}><AppText>閉じる</AppText></Pressable>
        </>}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: radius.card, backgroundColor: colors.surfaceContainerLow, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  count: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.primaryFixed },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceContainer, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  todo: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surfaceContainerLowest },
  box: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primaryFixed, alignItems: "center", justifyContent: "center" },
  primary: { minHeight: 48, padding: 14, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.primary },
  secondary: { minHeight: 48, padding: 14, alignItems: "center", borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  keyword: { padding: 12, borderRadius: radius.full, backgroundColor: colors.primaryFixed },
});
