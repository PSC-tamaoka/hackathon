import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/src/components/AppText";
import { BottomSheet } from "@/src/components/BottomSheet";
import { Icon, type IconName } from "@/src/components/Icon";
import { images } from "@/src/constants/images";
import { errorMessage, signIn, signUp } from "@/src/lib/api";
import { colors, fonts, radius, space } from "@/src/constants/theme";

type Mode = "register" | "login";

const AGE_GROUPS = ["10代以下", "20代", "30代", "40代", "50代", "60代以上"];
const RESIDENCES: { group: string; items: { value: string; label: string }[] }[] = [
  {
    group: "岡山県内",
    items: [
      { value: "okayama", label: "岡山市" },
      { value: "kurashiki", label: "倉敷市" },
      { value: "tamano", label: "玉野市（渋川地元）" },
      { value: "soja", label: "総社市" },
      { value: "tsuyama", label: "津山市" },
      { value: "other-okayama", label: "その他 岡山県内市町村" },
    ],
  },
  {
    group: "県外・その他",
    items: [
      { value: "kagawa", label: "香川県（瀬戸内対岸）" },
      { value: "kansai", label: "関西エリア" },
      { value: "kanto", label: "関東・首都圏エリア" },
      { value: "other-japan", label: "その他 国内" },
      { value: "overseas", label: "海外" },
    ],
  },
];
const residenceLabel = (value: string) =>
  RESIDENCES.flatMap((g) => g.items).find((i) => i.value === value)?.label ?? "";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // redirect: 招待ページなどから来たとき、ログイン後に戻る先
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [googleSynced, setGoogleSynced] = useState(false);
  const [age, setAge] = useState("30代");
  const [residence, setResidence] = useState("tamano");
  const [residenceOpen, setResidenceOpen] = useState(false);
  const [memories, setMemories] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isRegister = mode === "register";
  const nameError = showErrors && isRegister && !name.trim();
  const emailError = showErrors && !/^\S+@\S+\.\S+$/.test(email);
  const passwordError = showErrors && password.length < 6;
  const termsError = showErrors && isRegister && !agreed;

  // 認証は未接続。Googleボタンは入力を埋めるだけの仮動作
  const fillFromGoogle = () => {
    setEmail("setouchi.runner@gmail.com");
    if (!name) setName("Seto_Alumni");
    setGoogleSynced(true);
  };

  // 新規登録：メール＋パスワードで作成し、表示名・年代・居住地・思い出メモを保存する
  // ログイン：メール＋パスワードだけ
  const submit = async () => {
    setShowErrors(true);
    setAuthError(null);
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) return;
    if (isRegister && (!name.trim() || !agreed)) return;
    setBusy(true);
    try {
      if (isRegister) {
        await signUp({
          email: email.trim(),
          password,
          name: name.trim(),
          ageGroup: age,
          residence,
          memories: memories.trim(),
        });
      } else {
        await signIn(email.trim(), password);
      }
      router.replace(redirect ? (redirect as Href) : "/(tabs)");
    } catch (e) {
      setAuthError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
        <View style={[styles.hero, { paddingTop: insets.top + 80 }]}>
          <Image source={{ uri: images.loginHeader }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["transparent", "rgba(40,48,68,0.3)", "rgba(40,48,68,0.8)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroKicker}>
            <Icon name="waves" size={18} color={colors.secondaryFixed} />
            <AppText variant="labelSm" color={colors.secondaryFixed} style={{ letterSpacing: 2 }}>
              SETOUCHI ALUMNI QUEST
            </AppText>
          </View>
          <AppText variant="headlineLgMobile" color={colors.onPrimary} style={{ marginTop: 4 }}>
            渋川海岸で、世代を超えて{"\n"}あの夏を語り合おう
          </AppText>
        </View>

        <View style={styles.body}>
          <View style={styles.segment}>
            {(["register", "login"] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => setMode(m)}
                style={[styles.segmentBtn, mode === m && styles.segmentActive]}
              >
                <AppText variant="labelLg" color={mode === m ? colors.onPrimary : colors.onSurfaceVariant}>
                  {m === "register" ? "新規登録" : "ログイン"}
                </AppText>
              </Pressable>
            ))}
          </View>

          <View style={[styles.card, { alignItems: "center", gap: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="verified-user" size={16} color={colors.primary} />
              <AppText variant="labelMd" color={colors.primary}>
                ワンタップでスピード連携
              </AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={fillFromGoogle} style={styles.googleBtn}>
              <GoogleMark />
              <AppText variant="headlineSm">{isRegister ? "Googleで新規登録" : "Googleでサインイン"}</AppText>
            </Pressable>
            <AppText variant="bodySm" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
              管理者アカウントも共通のGoogle認証から安全にサインインできます
            </AppText>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <AppText variant="labelSm" color={colors.onSurfaceVariant} style={{ letterSpacing: 1 }}>
              またはプロフィールを入力
            </AppText>
            <View style={styles.dividerLine} />
          </View>

          {isRegister && (
            <Field icon="badge" label="表示名 / ニックネーム" required hint="海の学校クエストや想い出広場で公開されます" error={nameError ? "表示名を入力してください" : undefined}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="例：渋川カモメ、玉野のユウキ"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </Field>
          )}

          <Field icon="mail" label="メールアドレス" required error={emailError ? "正しいメールアドレスを入力してください" : undefined}>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setGoogleSynced(false);
              }}
              placeholder="shibukawa-alumni@example.jp"
              placeholderTextColor={colors.outline}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />
            {googleSynced && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="check-circle" size={14} color={colors.tertiary} />
                <AppText variant="labelSm" color={colors.tertiary}>
                  Googleアカウントから自動入力されました
                </AppText>
              </View>
            )}
          </Field>

          <Field
            icon="lock"
            label="パスワード"
            required
            hint={isRegister ? "6文字以上で設定してください" : undefined}
            error={passwordError ? "パスワードは6文字以上で入力してください" : undefined}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="6文字以上"
              placeholderTextColor={colors.outline}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={isRegister ? "new-password" : "current-password"}
              style={styles.input}
            />
          </Field>

          {isRegister && (
            <>
              <Field icon="history-edu" label="年代" required hint="同世代の卒業生・参加者とのマッチングに役立ちます">
                <View style={styles.ageGrid}>
                  {AGE_GROUPS.map((a) => (
                    <Pressable
                      key={a}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: age === a }}
                      onPress={() => setAge(a)}
                      style={[styles.ageBtn, age === a && styles.ageActive]}
                    >
                      <AppText variant="labelMd" color={age === a ? colors.onPrimary : colors.onSurface}>
                        {a}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </Field>

              <Field icon="location-on" label="居住地" required>
                <Pressable accessibilityRole="button" onPress={() => setResidenceOpen(true)} style={[styles.input, styles.select]}>
                  <AppText variant="bodyMd" color={residence ? colors.onSurface : colors.outline}>
                    {residenceLabel(residence) || "お住まいの地域を選択してください"}
                  </AppText>
                  <Icon name="expand-more" size={24} color={colors.onSurfaceVariant} />
                </Pressable>
              </Field>

              <Field
                icon="sailing"
                iconColor={colors.secondaryContainer}
                label="海の学校・青年の家の思い出メモ"
                optional
                hint="参加年度、学校名、カッター漕艇訓練、キャンプファイヤーなど自由に記録できます。"
              >
                <TextInput
                  value={memories}
                  onChangeText={setMemories}
                  multiline
                  numberOfLines={4}
                  placeholder="例：平成12年に中学校の海の学校でカッターを漕ぎました！"
                  placeholderTextColor={colors.outline}
                  style={[styles.input, { minHeight: 104, paddingTop: 12, textAlignVertical: "top" }]}
                />
              </Field>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                onPress={() => setAgreed((v) => !v)}
                style={styles.terms}
              >
                <View style={[styles.checkbox, agreed && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  {agreed && <Icon name="check" size={16} color={colors.onPrimary} />}
                </View>
                <AppText variant="bodySm" style={{ flex: 1 }}>
                  <AppText variant="labelMd" color={colors.primary} style={{ textDecorationLine: "underline" }}>
                    利用規約
                  </AppText>
                  および
                  <AppText variant="labelMd" color={colors.primary} style={{ textDecorationLine: "underline" }}>
                    プライバシーポリシー
                  </AppText>
                  に同意して、渋川コミュニティに参加します。
                </AppText>
              </Pressable>
              {termsError && (
                <AppText variant="labelMd" color={colors.error}>
                  利用規約およびプライバシーポリシーへの同意をお願いします。
                </AppText>
              )}
            </>
          )}

          <View style={{ gap: 8, paddingTop: 4 }}>
            {authError && (
              <AppText variant="labelMd" color={colors.error}>
                {authError}
              </AppText>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={[styles.submit, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Icon name="explore" size={22} color={colors.onPrimary} />
              )}
              <AppText variant="headlineSm" color={colors.onPrimary}>
                {isRegister ? "登録してはじめる" : "ログインして再開"}
              </AppText>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Icon name="lock" size={14} color={colors.onSurfaceVariant} />
              <AppText variant="labelSm" color={colors.onSurfaceVariant}>
                SSL通信で個人情報は安全に保護されます
              </AppText>
            </View>
          </View>

          <View style={styles.micro}>
            <Image source={{ uri: images.loginCard }} style={styles.microImg} contentFit="cover" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="nature-people" size={14} color={colors.tertiary} />
                <AppText variant="labelSm" color={colors.tertiary}>
                  渋川の風を感じて
                </AppText>
              </View>
              <AppText variant="bodySm" numberOfLines={1}>
                カッター訓練棟や青松白砂の海岸線。
              </AppText>
              <AppText variant="labelSm" color={colors.onSurfaceVariant}>
                あなたの足跡が次のクエストになります
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={residenceOpen} onClose={() => setResidenceOpen(false)}>
        <AppText variant="headlineSm">お住まいの地域</AppText>
        <ScrollView style={{ maxHeight: 360 }}>
          {RESIDENCES.map((g) => (
            <View key={g.group} style={{ gap: 4, marginBottom: 12 }}>
              <AppText variant="labelSm" color={colors.outline}>
                {g.group}
              </AppText>
              {g.items.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: residence === item.value }}
                  onPress={() => {
                    setResidence(item.value);
                    setResidenceOpen(false);
                  }}
                  style={[styles.option, residence === item.value && { backgroundColor: colors.primaryFixed }]}
                >
                  <AppText variant="bodyLg">{item.label}</AppText>
                  {residence === item.value && <Icon name="check" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

function GoogleMark() {
  // 本物のロゴ画像は未用意。色付きの "G" で代用
  return (
    <View style={styles.gMark}>
      <AppText variant="labelLg" color="#4285F4" style={{ fontFamily: fonts.bold }}>
        G
      </AppText>
    </View>
  );
}

function Field({
  icon,
  iconColor = colors.primary,
  label,
  required,
  optional,
  hint,
  error,
  children,
}: {
  icon: IconName;
  iconColor?: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { gap: 8 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
          <Icon name={icon} size={20} color={iconColor} />
          <AppText variant="headlineSm" style={{ flexShrink: 1 }}>
            {label}
          </AppText>
        </View>
        {required && (
          <View style={[styles.badge, { backgroundColor: colors.primaryFixed }]}>
            <AppText variant="labelSm" color={colors.onPrimaryFixed}>
              必須
            </AppText>
          </View>
        )}
        {optional && (
          <View style={[styles.badge, { backgroundColor: colors.surfaceContainer }]}>
            <AppText variant="labelSm" color={colors.onSurfaceVariant}>
              任意
            </AppText>
          </View>
        )}
      </View>
      {hint && (
        <AppText variant="bodySm" color={colors.onSurfaceVariant}>
          {hint}
        </AppText>
      )}
      {children}
      {error && (
        <AppText variant="labelMd" color={colors.error}>
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 192,
    paddingHorizontal: space.margin,
    paddingBottom: 32,
    justifyContent: "flex-end",
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceContainerHigh,
  },
  heroKicker: { flexDirection: "row", alignItems: "center", gap: 4 },
  body: { paddingHorizontal: space.margin, marginTop: -16, gap: space.md },
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
    elevation: 1,
  },
  segmentBtn: { flex: 1, minHeight: 44, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: colors.primary },
  card: { padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceContainerLowest, elevation: 1 },
  googleBtn: {
    alignSelf: "stretch",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
  },
  gMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  dividerLine: { height: 2, width: 48, borderRadius: 1, backgroundColor: colors.surfaceContainerHighest },
  input: {
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  ageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ageBtn: {
    width: "31%",
    flexGrow: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLow,
  },
  ageActive: { backgroundColor: colors.primary },
  terms: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  submit: {
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    elevation: 4,
  },
  micro: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
  },
  microImg: { width: 64, height: 64, borderRadius: radius.md },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
});
