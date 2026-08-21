import { sendNotification } from "../lib/notifications";
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const userId = '50ecc4a2-c514-4922-8eb7-7e74961c7c4f';
  const supabase = createAdminClient();

  const { data: user } = await supabase.from('users').select('id, full_name, email').eq('id', userId).single();
  console.log('Target User:', user?.full_name, '(', user?.id, ')');

  const { data: tokens } = await supabase.from('fcm_tokens').select('*').eq('user_id', userId);
  console.log('FCM Devices Registered:', tokens?.length || 0);

  console.log('\n--- 1. Testing Job Match Alert Notification ---');
  await sendNotification(userId, {
    title: '🔥 96% Match Found: Enterprise Account Manager @ Paytm',
    body: 'A new high-match role matching your resume was analyzed and ready for referral!',
    url: '/jobs',
    data: { type: 'job_match', matchRate: 96 }
  });
  console.log('✅ Job Match notification sent.');

  console.log('\n--- 2. Testing Referral Message Notification ---');
  await sendNotification(userId, {
    title: '🤝 New Referral Message from Product Manager @ Google',
    body: 'Hey Vaibhav! I reviewed your profile digest and would be glad to submit a referral for you.',
    url: '/qa?tab=network',
    data: { type: 'message' }
  });
  console.log('✅ Referral Message notification sent.');

  const { data: inAppNotifs } = await supabase
    .from('in_app_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(2);

  console.log('\n--- 3. Database Verification (In-App Notifications Table) ---');
  (inAppNotifs || []).forEach(n => {
    console.log(`  - [ID: ${n.id}] Title: "${n.title}" | Created: ${n.created_at}`);
  });
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
