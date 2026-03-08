import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // This function is a placeholder — the APK is a static file in public/dl/
  // The actual cleanup will be done by removing the cron job after execution
  // For now, just log that it was called
  console.log('cleanup-apk called at', new Date().toISOString());

  return new Response(
    JSON.stringify({ message: 'APK cleanup triggered. Remove the file manually or via next deploy.' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
