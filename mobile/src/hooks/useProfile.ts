import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useSession } from "./useSession";

export type Profile = {
  id: string;
  email: string;
  name: string;
  nickname: string;
  city: string | null;
  age_group: string | null;
  is_admin: boolean;
  notify_email: boolean;
  notify_push: boolean;
};

/** 自分の users 行。取得失敗やテーブル未作成のときは isAdmin=false(安全側) */
export function useProfile() {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // セッション判別前に「未ログイン」と決めると、organizer ゲートが管理者でも弾いてしまう
    if (sessionLoading) return;
    let cancelled = false;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    if (!supabase) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("users")
      .select("id, email, name, nickname, city, age_group, is_admin, notify_email, notify_push")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("useProfile: プロフィール取得に失敗しました:", error);
        setProfile((data as Profile | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, sessionLoading]);

  return { profile, user: session?.user ?? null, loading, isAdmin: profile?.is_admin ?? false };
}
