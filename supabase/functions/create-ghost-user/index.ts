import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const email = 'review@fco-manager.fr'
    const password = 'Boulanger529*'
    const name = 'Apple Review'

    // Check if already exists
    const { data: existing } = await adminClient.from('profiles').select('id').eq('email', email).maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ message: 'Ghost user already exists', uid: existing.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true
    })
    if (createError) throw createError

    // Register via RPC
    const { data: result, error: regError } = await adminClient.rpc('register_user', {
      p_user_id: newUser.user.id,
      p_email: email,
      p_name: name,
      p_role: 'admin',
      p_position: 'Attaquant',
    })
    if (regError) throw regError

    // Mark as ghost (trigger should handle this, but ensure it)
    await adminClient.from('profiles').update({ is_ghost: true, display_role: 'joueur' }).eq('id', newUser.user.id)

    return new Response(JSON.stringify({
      success: true,
      uid: newUser.user.id,
      email,
      playerId: result?.player_id
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
