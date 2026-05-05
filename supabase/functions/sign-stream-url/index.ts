import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function tryBase64Decode(s: string): string | null {
  try {
    const cleaned = s.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=_-]+$/.test(cleaned)) return null;
    const std = cleaned.replace(/-/g, "+").replace(/_/g, "/");
    return atob(std);
  } catch {
    return null;
  }
}

async function importSigningKey(rawKey: string): Promise<CryptoKey> {
  let trimmed = rawKey.trim().replace(/^['"]|['"]$/g, "");
  // Handle pasted `"jwk": "eyJ..."` format → extract the base64 value
  const m = trimmed.match(/"(?:jwk|pem)"\s*:\s*"([^"]+)"/);
  if (m) trimmed = m[1];
  trimmed = trimmed.replace(/,\s*$/, "").replace(/^['"]|['"]$/g, "");

  // 1) Try as base64-encoded JSON JWK (Cloudflare's `jwk` field)
  const decoded = tryBase64Decode(trimmed);
  const jwkCandidates: string[] = [];
  if (decoded) jwkCandidates.push(decoded);
  jwkCandidates.push(trimmed);

  for (const candidate of jwkCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const jwk = parsed?.kty === "RSA" ? parsed
        : typeof parsed?.jwk === "string" ? JSON.parse(atob(parsed.jwk))
        : parsed?.jwk?.kty === "RSA" ? parsed.jwk
        : typeof parsed?.result?.jwk === "string" ? JSON.parse(atob(parsed.result.jwk))
        : null;
      if (jwk?.kty === "RSA") {
        return await crypto.subtle.importKey(
          "jwk",
          { ...jwk, alg: "RS256", key_ops: ["sign"] },
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["sign"],
        );
      }
    } catch {
      // not JSON, continue
    }
  }

  const preview = trimmed.slice(0, 40) + "..." + trimmed.slice(-20);
  throw new Error(`Secret invalide. Reçu (len=${trimmed.length}): "${preview}". Attendu: la valeur "jwk" base64 (commence par eyJ...)`);
}

// Extract video UID from any Cloudflare Stream URL or accept raw UID
function extractVideoId(input: string): string | null {
  const v = input.trim();
  const cust = v.match(/customer-[^/]+\.cloudflarestream\.com\/([a-f0-9]{20,})/i);
  if (cust) return cust[1];
  const generic = v.match(/(?:iframe|videodelivery\.net|watch)[^/]*\/([a-f0-9]{20,})/i);
  if (generic) return generic[1];
  if (/^[a-f0-9]{20,}$/i.test(v)) return v;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth required
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(JSON.stringify({ error: "Invalid Cloudflare Stream URL/ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyId = Deno.env.get("CLOUDFLARE_STREAM_KEY_ID");
    const pem = Deno.env.get("CLOUDFLARE_STREAM_KEY_PEM");
    if (!keyId || !pem) {
      return new Response(JSON.stringify({ error: "Missing signing key config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cryptoKey = await importSigningKey(pem);

    // Token valid for 4 hours
    const exp = getNumericDate(60 * 60 * 4);
    const jwt = await create(
      { alg: "RS256", kid: keyId },
      { sub: videoId, kid: keyId, exp },
      cryptoKey,
    );

    return new Response(JSON.stringify({ token: jwt, videoId, exp }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sign-stream-url error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
