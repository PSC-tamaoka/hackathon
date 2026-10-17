import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/src/components/AppHeader";
import { EventForm } from "@/src/components/EventForm";

// O-02 イベント作成(管理者のみ。ホーム右下のFABから開く)
export default function NewEventScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }}>
      <BackHeader title="イベント作成" />
      <EventForm />
    </View>
  );
}
