import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { Text, Button, Field, Symbol } from "../../components/ui";
import { colors, spacing, screen } from "../../constants/theme";

export default function Login() {
  const { signInWithPhone, verifyOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"intro" | "phone" | "code">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true); setError(null);
    const normalized = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    const { error } = await signInWithPhone(normalized);
    setBusy(false);
    if (error) setError(error);
    else { setPhone(normalized); setStage("code"); }
  }

  async function confirm() {
    setBusy(true); setError(null);
    const { error } = await verifyOtp(phone, code);
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {stage === "intro" ? (
          <View style={styles.intro}>
            <View style={styles.mark}>
              <Symbol name="flame.fill" size={40} color={colors.text} weight="semibold" />
            </View>
            <Text variant="largeTitle" center style={{ marginTop: spacing.xl }}>Stakes</Text>
            <Text variant="title3" tone="secondary" center style={{ marginTop: spacing.sm, maxWidth: 300 }}>
              Put money on your word. Keep it, or your friend does.
            </Text>
            <View style={styles.introFooter}>
              <Button label="Get started" onPress={() => setStage("phone")} />
              <Text variant="caption" tone="tertiary" center style={{ marginTop: spacing.md }}>
                For ages 18+. By continuing you agree to the Terms & Privacy Policy.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Text variant="title1">
              {stage === "phone" ? "What's your number?" : "Enter your code"}
            </Text>
            <Text variant="subhead" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}>
              {stage === "phone"
                ? "We'll text you a code to sign in. Your number is how friends find you."
                : `Sent to ${phone}.`}
            </Text>

            {stage === "phone" ? (
              <Field
                label="Phone"
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            ) : (
              <Field
                label="6-digit code"
                placeholder="123456"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                value={code}
                onChangeText={setCode}
                autoFocus
              />
            )}

            {error ? <Text variant="footnote" tone="danger" style={{ marginBottom: spacing.md }}>{error}</Text> : null}

            <Button
              label={stage === "phone" ? "Send code" : "Verify & continue"}
              onPress={stage === "phone" ? sendCode : confirm}
              loading={busy}
            />
            <Pressable onPress={() => { setError(null); setStage(stage === "code" ? "phone" : "intro"); }} style={{ marginTop: spacing.lg }}>
              <Text variant="subhead" tone="accent" center>Back</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  intro: { flex: 1, alignItems: "center", justifyContent: "center", padding: screen.margin },
  mark: {
    width: 88, height: 88, borderRadius: 24, backgroundColor: colors.grouped,
    alignItems: "center", justifyContent: "center",
  },
  introFooter: { position: "absolute", left: screen.margin, right: screen.margin, bottom: spacing.xxl },
  form: { flex: 1, justifyContent: "center", paddingHorizontal: screen.margin, paddingBottom: spacing.huge },
});
