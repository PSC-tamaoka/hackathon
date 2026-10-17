import type { EventSummary, TodoItem } from "@/src/types/event";
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

/** 全イベント共通の当日TODOリスト(登録・追加は不要) */
export const commonTodos: TodoItem[] = [
  { id: "t1", text: "受付にてチェックイン（名札と思い出シールの受け取り）" },
  { id: "t2", text: "渋川海岸へ移動・当時の櫂（かい）とカッターボートの見学" },
  { id: "t3", text: "「語らいのタネ」カードを引いて、初対面の同窓生・OBOGと会話する" },
  { id: "t4", text: "砂浜でみんなで夕陽を眺めながら思い出トーク（自由歓談）" },
  { id: "t5", text: "記念写真の撮影＆アンケート回答" },
];

export function findEvent(id: string | undefined): EventSummary | undefined {
  return mockEvents.find((e) => e.id === id);
}
