import { Redirect } from "expo-router";
import { useSession } from "@/src/hooks/useSession";

// 起動時：ログイン済みならホーム、まだならログイン画面へ
// (Supabase 未設定で仮データのときは、これまでどおりログイン画面から)
export default function Index() {
  const { ready, signedIn } = useSession();
  if (!ready) return null;
  return <Redirect href={signedIn ? "/(tabs)" : "/(auth)/login"} />;
}
