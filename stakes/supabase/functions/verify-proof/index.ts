// Edge Function: verify-proof
// -----------------------------------------------------------------------------
// Called after a user uploads a photo/video proof for a check-in. Sends the
// media to Claude vision and asks a strict pass/uncertain/fail question about
// whether the clip plausibly shows the claimed activity.
//
// IMPORTANT (design honesty): vision models are reliable at "is this really
// push-ups?" but NOT at exact rep-counting. So we validate ACTIVITY, not count.
//   - pass       -> provisionally verify the check-in (verified_by = 'ai')
//   - uncertain  -> leave pending; escalate to friend confirm
//   - fail       -> leave pending; escalate to friend confirm / dispute
//
// Env vars required (set in Supabase dashboard -> Edge Functions -> Secrets):
//   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Body = {
  proof_id: string;
  activity: string;      // e.g. "push-ups", "reading a book"
  image_base64?: string; // a still frame (JPEG/PNG) — for video, sample a frame client-side
  media_type?: string;   // e.g. "image/jpeg"
};

Deno.serve(async (req) => {
  try {
    const { proof_id, activity, image_base64, media_type = "image/jpeg" } =
      (await req.json()) as Body;

    if (!proof_id || !activity || !image_base64) {
      return json({ error: "proof_id, activity and image_base64 are required" }, 400);
    }

    const prompt =
      `You are a strict verifier for an accountability app. A user claims this ` +
      `image is proof of the activity: "${activity}". Judge ONLY whether the ` +
      `image plausibly shows a real person performing that activity right now. ` +
      `Do NOT attempt to count repetitions. Reply with a single JSON object: ` +
      `{"verdict":"pass|uncertain|fail","reason":"<one short sentence>"}. ` +
      `Use "pass" only if it clearly depicts the activity, "fail" if it clearly ` +
      `does not, and "uncertain" otherwise.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image",
                source: { type: "base64", media_type, data: image_base64 },
              },
            ],
          },
        ],
      }),
    });

    const data = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const parsed = safeParse(text);
    const verdict = parsed.verdict ?? "uncertain";
    const reason = parsed.reason ?? "Could not parse model response.";

    // Persist the verdict on the proof.
    await admin.from("proofs")
      .update({ ai_result: verdict, ai_reason: reason })
      .eq("id", proof_id);

    // On a clear pass, provisionally verify the linked check-in.
    if (verdict === "pass") {
      const { data: proof } = await admin
        .from("proofs").select("checkin_id").eq("id", proof_id).single();
      if (proof?.checkin_id) {
        await admin.from("checkins")
          .update({ status: "verified", verified_by: "ai" })
          .eq("id", proof.checkin_id);
      }
    }

    return json({ verdict, reason });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function safeParse(s: string): { verdict?: string; reason?: string } {
  try {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end === -1) return {};
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return {};
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
