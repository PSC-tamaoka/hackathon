import { Redirect } from "expo-router";

// 起動時はログイン画面へ(認証は未接続)
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
