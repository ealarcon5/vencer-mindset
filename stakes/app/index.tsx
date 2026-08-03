import { Redirect } from "expo-router";

// Entry point simply hands off to the tabs; the root layout redirects to the
// login screen if there's no session.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
