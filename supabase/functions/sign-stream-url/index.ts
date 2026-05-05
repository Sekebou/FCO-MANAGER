import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePem(raw: string): string {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (typeof parsed?.jwk === "string") return parsed.jwk;
    if (typeof parsed?.pem === "string") return parsed.pem;
    if (typeof parsed?.privateKey === "string") return parsed.privateKey;
    if (typeof parsed?.private_key === "string") return parsed.private_key;
  } catch (_) {
    // Not JSON; keep parsing as a PEM string.
  }
  return trimmed.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
}

function pemToBinary(rawPem: string): Uint8Array {
  const pem = normalizePem(rawPem);
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function importSigningKey(rawKey: string): Promise<CryptoKey> {
  const trimmed = rawKey.trim().replace(/^['"]|['"]$/g, "");
  try {
    const parsed = JSON.parse(trimmed);
    const jwk = parsed?.jwk && typeof parsed.jwk === "object" ? parsed.jwk : parsed?.kty === "RSA" ? parsed : null;
    if (jwk) {
      return await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
      );
    }
  } catch (_) {
    // Not JSON/JWK; import as PKCS8 PEM below.
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(rawKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
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

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      pemToBinary(pem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );

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
