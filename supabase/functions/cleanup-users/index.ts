import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('Starting cleanup process...');

    // 1. Delete all user investments
    const { error: investmentsError } = await supabaseAdmin
      .from('user_investments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (investmentsError) {
      console.error('Error deleting investments:', investmentsError);
    } else {
      console.log('Investments deleted successfully');
    }

    // 2. Delete all verification codes
    const { error: codesError } = await supabaseAdmin
      .from('verification_codes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (codesError) {
      console.error('Error deleting verification codes:', codesError);
    } else {
      console.log('Verification codes deleted successfully');
    }

    // 3. Get all users from auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    console.log(`Found ${users?.length || 0} users to delete`);

    // 4. Delete all profiles first
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (profilesError) {
      console.error('Error deleting profiles:', profilesError);
    } else {
      console.log('Profiles deleted successfully');
    }

    // 5. Delete all auth users
    let deletedCount = 0;
    if (users) {
      for (const user of users) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`Error deleting user ${user.id}:`, deleteError);
        } else {
          deletedCount++;
          console.log(`Deleted user ${user.id} (${user.email})`);
        }
      }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} users from auth.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleanup complete. Deleted ${deletedCount} users and all related data.`,
        deletedUsers: deletedCount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in cleanup-users function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})