import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: canManage } = await adminClient.rpc('can_manage', { _user_id: caller.id })
    if (!canManage) throw new Error('Forbidden')

    const { email, password, name, role, position, licenseExpiry, team } = await req.json()

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true
    })
    if (createError) throw createError

    const { data: result, error: regError } = await adminClient.rpc('register_user', {
      p_user_id: newUser.user.id,
      p_email: email,
      p_name: name,
      p_role: role || 'joueur',
      p_position: position || 'Non défini',
      p_license_expiry: licenseExpiry || null,
    })
    if (regError) throw regError

    if (team) {
      await adminClient.from('profiles').update({ team }).eq('id', newUser.user.id)
      if (result?.player_id) {
        await adminClient.from('players').update({ team }).eq('id', result.player_id)
      }
    }

    return new Response(JSON.stringify({
      uid: newUser.user.id,
      email,
      playerId: result?.player_id
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    const msg = err.message || 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 400
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
