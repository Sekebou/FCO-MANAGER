import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { initializeApp, cert, getApps } from "npm:firebase-admin@12.1.0/app";
import { getMessaging } from "npm:firebase-admin@12.1.0/messaging";
import { getFirestore } from "npm:firebase-admin@12.1.0/firestore";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, body, data } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Firebase Admin if not already done
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT secret not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    const firestore = getFirestore();
    const messaging = getMessaging();

    // Get all FCM tokens from Firestore
    const tokensSnapshot = await firestore.collection('fcm_tokens').get();
    const tokens: string[] = [];
    tokensSnapshot.forEach((doc: any) => {
      const tokenData = doc.data();
      if (tokenData.token) {
        tokens.push(tokenData.token);
      }
    });

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No tokens registered' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send multicast notification
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens,
    };

    const response = await messaging.sendEachForMulticast(message);

    // Clean up invalid tokens
    const invalidTokens: string[] = [];
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[idx]);
      }
    });

    // Remove invalid tokens from Firestore
    if (invalidTokens.length > 0) {
      const batch = firestore.batch();
      const allDocs = await firestore.collection('fcm_tokens').get();
      allDocs.forEach((docSnap: any) => {
        if (invalidTokens.includes(docSnap.data().token)) {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit();
    }

    return new Response(JSON.stringify({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error sending push notifications:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
