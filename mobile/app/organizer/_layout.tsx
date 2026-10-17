import { Redirect, Stack } from "expo-router";
import { useProfile } from "@/src/hooks/useProfile";

// organizer 配下は管理者(is_admin=true)のみ。それ以外は (tabs) へ戻す
export default function OrganizerLayout() {
  const { isAdmin, loading } = useProfile();

  if (loading) return null;
  if (!isAdmin) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
