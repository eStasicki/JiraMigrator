import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase environment variables!');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfile() {
	console.log('--- Checking Profile for Estasicki ---');

	// 1. Get User ID by email (we can't list users with anon key efficiently without filtering if RLS is strict,
	// but usually we can't search auth.users with anon key at all).
	// Actually, we can't query auth.users directly with anon key usually.
	// But we can check if a profile exists in public.profiles if we had the ID.
	// Since we don't have the ID easily without logging in, let's just try to log in with the credentials provided (if I had password).
	// User said they registered. I don't have their password.

	// So I will just assume it works or ask them to run a test in browser context where they are logged in.
	// However, I can try to simply select * from profiles. RLS says "Public profiles are viewable by everyone."
	// create policy "Public profiles are viewable by everyone." on profiles for select using (true);

	const { data: profiles, error } = await supabase.from('profiles').select('*');

	if (error) {
		console.error('❌ Error fetching profiles:', error);
	} else {
		console.log(`✅ Found ${profiles.length} profiles.`);
		if (profiles.length > 0) {
			console.log('Sample profile:', profiles[0]);
		} else {
			console.log('⚠️ No profiles found. Trigger might have failed or RLS blocks listing?');
		}
	}
}

checkProfile();
