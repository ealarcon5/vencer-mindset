// Dynamic Expo config: merges static app.json and injects secrets from the
// environment (.env is auto-loaded by the Expo CLI into process.env). This is
// how SUPABASE_URL / SUPABASE_ANON_KEY reach the app at runtime via
// Constants.expoConfig.extra — see lib/supabase.ts.
const base = require("./app.json").expo;

module.exports = () => ({
  ...base,
  extra: {
    ...(base.extra ?? {}),
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "" },
  },
});
