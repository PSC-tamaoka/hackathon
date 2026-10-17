import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/src/components/AppHeader";
import { Icon, type IconName } from "@/src/components/Icon";
import { colors, fonts } from "@/src/constants/theme";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "ホーム", icon: "calendar-month" },
  { name: "create", title: "イベント作成", icon: "add-circle" },
  { name: "announcements", title: "お知らせ", icon: "campaign" },
  { name: "mypage", title: "マイページ", icon: "badge" },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        header: () => <AppHeader />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 10 },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
          backgroundColor: colors.surfaceContainerLowest,
          borderTopWidth: 0,
          elevation: 12,
        },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <Icon name={t.icon} size={22} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
