const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!url || !key || !openaiKey) {
    console.error('Missing URL or key');
    process.exit(1);
  }
  
  const supabase = createClient(url, key);
  
  // Find all active users with missing embeddings
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, company, job_title, about, resume_text')
    .is('embedding', null)
    .eq('is_active', true);
    
  if (error) {
    console.error('Error fetching users:', error);
    process.exit(1);
  }
  
  console.log(`Found ${users.length} users needing embeddings.`);
  
  let successCount = 0;
  
  for (const user of users) {
    const denseContext = user.resume_text ? `Resume: ${user.resume_text}` : `About: ${user.about || "None"}`;
    const textToEmbed = `Company: ${user.company || "None"}\nRole: ${user.job_title || "None"}\n${denseContext}`.slice(0, 8000);
    
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: textToEmbed,
          model: "text-embedding-3-small"
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const embedding = data.data[0].embedding;
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ embedding })
          .eq('id', user.id);
          
        if (!updateError) {
          successCount++;
          console.log(`Updated user ${user.id} (${user.full_name})`);
        } else {
          console.error(`Failed to update DB for ${user.id}:`, updateError);
        }
      } else {
        console.error(`Failed to fetch embedding for ${user.id}:`, await response.text());
      }
    } catch (e) {
      console.error(`Exception for ${user.id}:`, e);
    }
  }
  
  console.log(`Done. Successfully backfilled ${successCount} out of ${users.length} users.`);
}

run();
