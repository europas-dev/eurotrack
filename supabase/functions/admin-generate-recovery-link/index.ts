import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('Missing required Edge Function environment configuration.');
      return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
    }

    const token = authorization.slice('Bearer '.length);
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Your session is invalid or expired. Please sign in again.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authorization is checked against the database, never user-editable metadata.
    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('role, archived_at')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (callerError) throw callerError;
    if (!callerProfile || callerProfile.archived_at || !['admin', 'superadmin'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'You are not authorized to generate password reset links.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!userId) return jsonResponse({ error: 'A target user is required.' }, 400);

    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('id, email, role, archived_at')
      .eq('id', userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!targetProfile?.email || targetProfile.archived_at) {
      return jsonResponse({ error: 'The selected account is unavailable for password recovery.' }, 404);
    }

    // Admins cannot issue recovery links for the protected Super Admin account.
    if (targetProfile.role === 'superadmin' && callerProfile.role !== 'superadmin') {
      return jsonResponse({ error: 'Only the Super Admin can generate a recovery link for this account.' }, 403);
    }

    // Use the project's configured Auth Site URL. This avoids accepting an
    // arbitrary redirect URL from the browser and needs no extra secret.
    const { data: generated, error: generateError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: targetProfile.email,
    });

    if (generateError) throw generateError;
    const actionLink = generated?.properties?.action_link;
    if (!actionLink) throw new Error('Supabase did not return a recovery action link.');

    // Never log or persist the recovery link. It is a bearer credential.
    return jsonResponse({ actionLink, email: targetProfile.email });
  } catch (error) {
    console.error('admin-generate-recovery-link failed:', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'The password reset link could not be generated. Please try again.' }, 500);
  }
});
