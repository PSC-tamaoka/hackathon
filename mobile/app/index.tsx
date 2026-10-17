import { Redirect } from "expo-router";
import { useSession } from "@/src/hooks/useSession";

// ログイン済みなら (tabs) へ、未ログインなら (auth)/login へ振り分ける
export default function Index() {
  const { session, loading } = useSession();

  if (loading) return null;

  return <Redirect href={session ? "/(tabs)" : "/(auth)/login"} />;
}
