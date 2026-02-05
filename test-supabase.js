import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase environment variables!');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
	console.log('--- Supabase Connection Test ---');
	console.log('URL:', supabaseUrl);

	try {
		// Test Auth API
		const { data: authData, error: authError } = await supabase.auth.getSession();
		if (authError) {
			console.error('❌ Auth API Error:', authError.message);
		} else {
			console.log('✅ Auth API: OK');
		}

		// Test PostgREST API (Database)
		const { data: dbData, error: dbError } = await supabase.from('profiles').select('id').limit(1);

		if (dbError) {
			// 42P01 means relation "profiles" does not exist (migration not yet applied)
			// PGRST116 is usually returned when Single() is used and nothing is found,
			// but here we use select().limit(1) so it should just be empty.
			if (
				dbError.code === '42P01' ||
				dbError.message.includes('relation "profiles" does not exist')
			) {
				console.log(
					'⚠️ Database API reached, but table "profiles" not found (expected if migration not run yet)'
				);
				console.log('✅ Connection to Supabase: OK');
			} else {
				console.error('❌ Database API Error:', dbError.message, 'Code:', dbError.code);
			}
		} else {
			console.log('✅ Database API: OK (Table exists)');
		}
	} catch (err) {
		console.error('❌ Unexpected Error:', err);
	}
}

testSupabaseConnection();
