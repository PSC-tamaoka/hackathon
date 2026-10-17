import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "@/src/constants/theme";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

export type ToastState = { heading: string; body: string; icon: IconName } | null;

type Props = { toast: ToastState; onHide: () => void; bottom?: number };

export function Toast({ toast, onHide, bottom = 16 }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: toast ? 1 : 0, duration: 250, useNativeDriver: true }).start();
    if (!toast) return;
    const timer = setTimeout(onHide, 3800);
    return () => clearTimeout(timer);
  }, [toast, anim, onHide]);

  return (
    <Animated.View
      pointerEvents={toast ? "auto" : "none"}
      style={[
        styles.wrap,
        {
          bottom,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
        },
      ]}
    >
      {toast && (
        <View style={styles.inner}>
          <View style={styles.row}>
            <Icon name={toast.icon} size={24} color={colors.secondaryFixed} />
            <View style={{ flex: 1 }}>
              <AppText variant="labelMd" color={colors.inverseOnSurface}>
                {toast.heading}
              </AppText>
              <AppText variant="bodySm" color={colors.inverseOnSurface} style={{ opacity: 0.8 }}>
                {toast.body}
              </AppText>
            </View>
          </View>
          <Pressable onPress={onHide} hitSlop={12} accessibilityLabel="閉じる">
            <Icon name="close" size={18} color={colors.inverseOnSurface} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 50 },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.inverseSurface,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
});
