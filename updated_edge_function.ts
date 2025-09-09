// ============================================================================
// UPDATED EDGE FUNCTION - Replace your current edge function with this
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

Deno.serve(async (req) => {
  try {
    console.log('🔄 Starting comprehensive penalty and recurring task processing...')
    
    // 1. Generate ALL recurring tasks (daily, weekly, monthly) using SQL function
    console.log('📅 Generating all recurring tasks...')
    const { data: generateResult, error: generateError } = await supabase
      .rpc('generate_all_recurring_tasks')
    
    if (generateError) {
      console.error('❌ Generation Error:', generateError)
      throw generateError
    }
    
    console.log('✅ Task generation result:', generateResult)
    
    // 2. Process penalties for overdue tasks using SQL function
    console.log('⚡ Processing penalties...')
    const { data: penaltyCount, error: penaltyError } = await supabase
      .rpc('process_overdue_penalties')
    
    if (penaltyError) {
      console.error('❌ Penalty Error:', penaltyError)
      throw penaltyError
    }
    
    console.log(`✅ Applied penalties to ${penaltyCount || 0} overdue tasks`)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'All recurring tasks and penalties processed successfully',
        tasks_generated: generateResult,
        penalties_applied: penaltyCount || 0,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    )
    
  } catch (error) {
    console.error('💥 Error in penalty and recurring task processing:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// ============================================================================
// DEPLOYMENT INSTRUCTIONS:
// ============================================================================
// 1. Replace your current edge function code with this
// 2. Deploy the edge function to Supabase
// 3. Set up cron job to call this function every 10-30 minutes:
//    - Go to Supabase Dashboard > Edge Functions
//    - Set up a cron trigger for your function
//    - Recommended: */15 * * * * (every 15 minutes)
// ============================================================================