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

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get profile to find player_id
    const { data: profile } = await adminClient.from('profiles').select('player_id, role').eq('id', user.id).single()
    
    // Prevent admin+ self-deletion
    if (profile?.role === 'admin+') {
      throw new Error('Le compte Admin+ ne peut pas être supprimé')
    }

    const playerId = profile?.player_id

    // Clean up related data
    if (playerId) {
      await adminClient.from('cards').delete().eq('player_id', playerId)
      await adminClient.from('attendance_records').delete().eq('player_id', playerId)
    }

    // Delete user-specific data
    await adminClient.from('user_roles').delete().eq('user_id', user.id)
    await adminClient.from('bets').delete().eq('user_id', user.id)
    await adminClient.from('user_points').delete().eq('user_id', user.id)
    await adminClient.from('points_transactions').delete().eq('user_id', user.id)
    await adminClient.from('fcm_tokens').delete().eq('user_id', user.id)
    await adminClient.from('user_sessions').delete().eq('user_id', user.id)
    await adminClient.from('profiles').delete().eq('id', user.id)

    // Delete player record last
    if (playerId) {
      await adminClient.from('players').delete().eq('id', playerId)
    }

    // Delete auth user
    const { error } = await adminClient.auth.admin.deleteUser(user.id)
    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
