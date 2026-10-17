import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isMock, supabase } from "@/src/lib/supabase";

/** ログイン状態。仮データで動かすときは常に未ログイン扱い(ログイン画面から入る) */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(isMock);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return { ready, session, signedIn: session !== null };
}
