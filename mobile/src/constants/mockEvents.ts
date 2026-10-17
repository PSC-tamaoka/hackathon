import type { EventSummary } from "@/src/types/event";
import { images } from "./images";

// 画面確認用の仮データ(バックエンド接続までの間だけ使う)。
// どの月に開いてもカレンダーに印が付くよう、日付は「今月の5・12・19日」で作る。
function thisMonth(day: number): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export const mockEvents: EventSummary[] = [
  {
    id: "jibiki",
    title: "親子で楽しむ地引網＆獲れたて浜焼き会",
    description: "家族みんなで地引網を引いて、獲れたての魚を浜焼きでいただきます。",
    date: thisMonth(5),
    startTime: "09:30",
    endTime: "13:00",
    place: "渋川海岸東浜",
    placeShort: "渋川海岸東浜",
    address: "玉野市渋川",
    capacity: 40,
    remaining: 18,
    scope: "open",
    tag: { label: "ファミリー歓迎", tone: "tertiary" },
    cover: images.jibikiCover,
  },
  {
    id: "cutter",
    title: "夕暮れのカッター訓練＆メモリアル語り合いの夕べ",
    description:
      "渋川名物のカッター船に乗り込み、夕凪の瀬戸内海へ。息を合わせた漕航の後は焚火を囲み、学生時代の思い出や今の歩みを気兼ねなく語り合う集いです。",
    date: thisMonth(12),
    startTime: "15:30",
    endTime: "19:30",
    receptionNote: "受付開始 15:00",
    place: "岡山県渋川青年の家 前庭",
    placeShort: "岡山県渋川青年の家 前庭（玉野市渋川2-7-1）",
    address: "玉野市渋川二丁目7番1号",
    capacity: 35,
    remaining: 12,
    scope: "open",
    tag: { label: "全員参加OK", tone: "secondary" },
    cover: images.cutterCover,
  },
  {
    id: "beach-talk",
    title: "渋川OB・OGビーチ座談会「未来へ紡ぐ航跡」",
    description: "OB・OGが集まり、これからの渋川について語り合う座談会です。",
    date: thisMonth(19),
    startTime: "14:00",
    endTime: "17:00",
    place: "渋川マリン水族館横テラス",
    placeShort: "渋川マリン水族館横テラス",
    address: "玉野市渋川",
    capacity: 30,
    remaining: 9,
    scope: "closed",
    tag: { label: "招待＆OB/OG", tone: "secondary" },
    cover: images.beachTalkCover,
  },
];

// DB接続までの画面確認用。日本時間の本日開催なので、毎日ラリーを試せる。
mockEvents.push({
  ...mockEvents[1],
  id: "rally-demo",
  title: "【デモ】渋川の思い出スタンプラリー",
  description: "カッターや地引網、仲間との語らい。5つの体験で、渋川の思い出をつなぐデモイベントです。",
  date: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
  startTime: "00:00",
  endTime: "23:59",
  receptionNote: "画面確認用のモックイベント",
});

export function findEvent(id: string | undefined): EventSummary | undefined {
  return mockEvents.find((e) => e.id === id);
}
