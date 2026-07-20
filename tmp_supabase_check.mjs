import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.existsSync('.env') ? Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).map(line => {
  const idx = line.indexOf('=');
  return [line.slice(0, idx), line.slice(idx+1)];
})) : process.env;
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET;
if (!url || !key) {
  console.error('Missing env', url, key);
  process.exit(1);
}
const supabase = createClient(url, key);
console.log('supabase client created');
const [{ data: drivers, error: driversError }, { data: applications, error: applicationsError }] = await Promise.all([
  supabase.from('drivers').select('id,user_id,name,phone,status,branch_id,bank_name,bank_account_number,bank_account_holder,profile_photo_url,created_at,updated_at').order('created_at', { ascending: false }),
  supabase.from('driver_applications').select('id,user_id,name,phone,branch_id,bank_name,bank_account_number,bank_account_holder,status,created_at,admin_notes').order('created_at', { ascending: false }),
]);
console.log('driversError', driversError);
console.log('driversCount', drivers?.length);
console.log(JSON.stringify(drivers, null, 2));
console.log('applicationsError', applicationsError);
console.log('applicationsCount', applications?.length);
console.log(JSON.stringify(applications, null, 2));
