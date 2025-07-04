import 'dotenv/config';
import postgres from 'postgres';

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL is not defined');
    console.log('Please set the DATABASE_URL environment variable in your .env file');
    process.exit(1);
  }

  const sanitizedUrl = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log(`Testing connection to: ${sanitizedUrl}`);

  // Test with original URL
  try {
    console.log('Attempting connection...');
    const sql = postgres(connectionString, { timeout: 10 });
    const result = await sql`SELECT current_timestamp as time`;
    console.log('✅ Connection successful!');
    console.log(`Current database time: ${result[0].time}`);
    await sql.end();
  } catch (error) {
    console.error('❌ Connection failed:', error);
    
    // If the URL has db. prefix and it's a Supabase URL, try removing it
    if (connectionString.includes('db.') && connectionString.includes('supabase.co')) {
      try {
        console.log('\nTrying alternative URL format...');
        const altConnectionString = connectionString.replace(/db\.([a-z0-9]+\.supabase\.co)/, '$1');
        const altSanitizedUrl = altConnectionString.replace(/:([^:@]+)@/, ':****@');
        console.log(`Testing connection to: ${altSanitizedUrl}`);
        
        const sql = postgres(altConnectionString, { timeout: 10 });
        const result = await sql`SELECT current_timestamp as time`;
        console.log('✅ Alternative connection successful!');
        console.log(`Current database time: ${result[0].time}`);
        console.log('\n⚠️ Please update your DATABASE_URL to the alternative format');
        await sql.end();
      } catch (altError) {
        console.error('❌ Alternative connection also failed:', altError);
        
        console.log('\nFor Supabase, your DATABASE_URL should look like:');
        console.log('postgresql://postgres:password@project-ref.supabase.co:5432/postgres');
        console.log('(Remove any "db." prefix from the hostname)');
      }
    }
  }
}

testConnection().catch(console.error);
