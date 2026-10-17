-- =====================================================================
-- 渋川つながり：デモ用データ
--   ・アプリの仮データ（mobile/src/constants/mockEvents.ts）と同じ3件を「今月の5・12・19日」に
--   ・TODOチェックを見せるための「今日」のイベントを1件
--   主催者が空（organizer_id = null）のイベントは「運営のイベント」として扱う
--   カバー画像は空にしてあり、アプリ側でタグに合う画像を表示する
--
-- 使い方: Supabase の SQL Editor に貼って実行する（ローカルなら supabase db reset で自動実行）
-- 何度実行しても同じ結果になるよう、先に同じタイトルの運営イベントを消してから入れる
-- =====================================================================

delete from public.events
where organizer_id is null
  and title in (
    '親子で楽しむ地引網＆獲れたて浜焼き会',
    '夕暮れのカッター訓練＆メモリアル語り合いの夕べ',
    '渋川OB・OGビーチ座談会「未来へ紡ぐ航跡」',
    '渋川海岸 夕陽の再会ミーティング'
  );

with base as (
  select date_trunc('month', now() at time zone 'Asia/Tokyo')::date as month_start,
         (now() at time zone 'Asia/Tokyo')::date as today
)
insert into public.events
  (organizer_id, title, description, event_date, start_time, end_time, reception_note,
   place, place_detail, address, capacity, scope, rain_policy, tags, status, deadline)
select null, v.title, v.description, v.event_date, v.start_time, v.end_time, v.reception_note,
       v.place, v.place_detail, v.address, v.capacity, v.scope, v.rain_policy, v.tags, 'published', v.deadline
from base, lateral (values
  ('親子で楽しむ地引網＆獲れたて浜焼き会',
   '家族みんなで地引網を引いて、獲れたての魚を浜焼きでいただきます。',
   base.month_start + 4, time '09:30', time '13:00', null::text,
   '渋川海岸東浜', null::text, '玉野市渋川', 40, 'open', 'showers_ok',
   array['ファミリー歓迎', '地引網'], null::timestamptz),
  ('夕暮れのカッター訓練＆メモリアル語り合いの夕べ',
   '渋川名物のカッター船に乗り込み、夕凪の瀬戸内海へ。息を合わせた漕航の後は焚火を囲み、学生時代の思い出や今の歩みを気兼ねなく語り合う集いです。',
   base.month_start + 11, time '15:30', time '19:30', '受付開始 15:00',
   '岡山県渋川青年の家', '前庭', '玉野市渋川二丁目7番1号', 35, 'open', 'showers_ok',
   array['全員参加OK', 'カッター体験', '砂浜座談会'], null::timestamptz),
  ('渋川OB・OGビーチ座談会「未来へ紡ぐ航跡」',
   'OB・OGが集まり、これからの渋川について語り合う座談会です。',
   base.month_start + 18, time '14:00', time '17:00', null::text,
   '渋川マリン水族館横テラス', null::text, '玉野市渋川', 30, 'closed', 'indoor_shift',
   array['招待＆OB/OG', '砂浜座談会'], null::timestamptz),
  -- 当日のTODOチェックを見せるためのイベント（締切を今日の終わりにして、一日中申し込めるようにする）
  ('渋川海岸 夕陽の再会ミーティング',
   '海の学校の仲間と、夕陽の渋川海岸で再会しましょう。参加登録すると、当日のTODOリストにチェックできます。',
   base.today, time '15:00', time '19:00', '受付開始 14:30',
   '岡山県渋川青年の家', 'カッター艇庫前', '玉野市渋川二丁目7番1号', 50, 'open', 'showers_ok',
   array['全員参加OK', 'カッター体験'], ((base.today + 1)::timestamp at time zone 'Asia/Tokyo'))
) as v(title, description, event_date, start_time, end_time, reception_note,
       place, place_detail, address, capacity, scope, rain_policy, tags, deadline);

-- 招待制のデモイベントに、決まったトークンの招待リンクを付けておく（招待ページの確認用）
--   アプリで /invite/demo-beach-talk を開くと招待ページが出る
insert into public.invite_links (event_id, token)
select id, 'demo-beach-talk' from public.events
where title = '渋川OB・OGビーチ座談会「未来へ紡ぐ航跡」' and organizer_id is null
on conflict do nothing;
