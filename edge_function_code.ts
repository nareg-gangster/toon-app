// Copy this code into your Supabase Edge Function (recurring-checks)

import { createClient } from '@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use service role for admin operations

// Create a supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

Deno.serve(async (req) => {
  try {
    console.log('🔄 Starting recurring task checks...')
    
    // 1. Generate daily recurring tasks
    console.log('📅 Generating daily tasks...')
    const { error: generateError } = await supabase.rpc('generate_daily_recurring_tasks')
    
    if (generateError) {
      console.error('❌ Error generating daily tasks:', generateError)
      throw generateError
    }
    
    console.log('✅ Daily tasks generated successfully')
    
    // 2. Process penalties for overdue tasks
    console.log('⚡ Processing penalties...')
    const { data: penaltyCount, error: penaltyError } = await supabase.rpc('process_overdue_penalties')
    
    if (penaltyError) {
      console.error('❌ Error processing penalties:', penaltyError)
      throw penaltyError
    }
    
    console.log(`✅ Processed penalties for ${penaltyCount || 0} overdue tasks`)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Recurring tasks processed successfully',
        dailyTasksGenerated: true,
        penaltiesProcessed: penaltyCount || 0,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    )
    
  } catch (error) {
    console.error('💥 Error in recurring checks:', error)
    
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