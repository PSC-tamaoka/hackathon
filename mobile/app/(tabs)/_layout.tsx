import { Stack } from "expo-router";
import { AppHeader } from "@/src/components/AppHeader";
import { colors } from "@/src/constants/theme";

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        header: () => <AppHeader />,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="index" options={{ title: "ホーム" }} />
    </Stack>
  );
}
