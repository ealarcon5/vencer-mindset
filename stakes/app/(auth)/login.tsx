import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useAuth } from "../../lib/auth";
import { colors, spacing, radius } from "../../constants/theme";

export default function Login() {
  const { signInWithPhone, verifyOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Text style={styles.brand}>STAKES</Text>
      <Text style={styles.tagline}>Bet on your own accountability.</Text>

      {stage === "phone" ? (
        <>
          <Text style={styles.label}>Your phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 123-4567"
            placeholderTextColor={colors.textDim}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
          <Button label="Send code" onPress={sendCode} busy={busy} />
        </>
      ) : (
        <>
          <Text style={styles.label}>Enter the 6-digit code</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            autoFocus
          />
          <Button label="Verify & continue" onPress={confirm} busy={busy} />
          <Pressable onPress={() => setStage("phone")}>
            <Text style={styles.link}>Use a different number</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

function Button({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return (
    <Pressable style={styles.button} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg },
  brand: { color: colors.gold, fontSize: 40, fontWeight: "800", letterSpacing: 4, textAlign: "center" },
  tagline: { color: colors.textDim, textAlign: "center", marginBottom: spacing.xl, marginTop: spacing.sm },
  label: { color: colors.text, marginBottom: spacing.sm, fontWeight: "600" },
  input: {
    backgroundColor: colors.card, color: colors.text, borderRadius: radius.md,
    padding: spacing.md, fontSize: 18, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md, alignItems: "center",
  },
  buttonText: { color: colors.bg, fontWeight: "800", fontSize: 16 },
  link: { color: colors.gold, textAlign: "center", marginTop: spacing.md },
  error: { color: colors.red, textAlign: "center", marginTop: spacing.md },
});
