import { ImageResponse } from 'next/og'
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const supabase = createAdminClient();
    const { data: jobPost } = await supabase
      .from("job_posts")
      .select("*, creator:users!job_posts_creator_id_fkey(full_name, company), interests:job_post_interests(status)")
      .eq("id", id)
      .single();

    if (!jobPost) {
      return new Response('Not Found', { status: 404 })
    }

    const interests = jobPost.interests || [];
    const interestedCount = interests.filter((i: any) => i.status === "interested").length;

    const isSeeker = jobPost.type === "seeker";
    const badgeText = isSeeker ? "LOOKING FOR ROLE" : "HIRING / REFERRING";
    const badgeBg = isSeeker ? "#2563EB" : "#16A34A";

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            backgroundColor: '#fff',
            backgroundImage: 'radial-gradient(circle at 25px 25px, lightgray 2%, transparent 0%), radial-gradient(circle at 75px 75px, lightgray 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            padding: '80px',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ 
              display: 'flex', 
              backgroundColor: badgeBg, 
              color: '#fff', 
              fontSize: 22, 
              fontWeight: 'bold', 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              padding: '6px 16px',
              borderRadius: '8px',
            }}>
              {badgeText}
            </div>
          </div>
          
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 900, color: '#111827', lineHeight: 1.1, marginBottom: '20px' }}>
            {jobPost.role}
          </div>

          {jobPost.company && (
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, color: '#4B5563', marginBottom: '30px' }}>
              @ {jobPost.company} {jobPost.experience_years ? `• ${jobPost.experience_years} exp` : ''}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', width: '100%', justifyContent: 'space-between', borderTop: '2px solid #E5E7EB', paddingTop: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
                Posted by {jobPost.creator?.full_name || "a Neighbor"}
              </div>
              <div style={{ display: 'flex', fontSize: 18, color: '#6B7280', marginTop: '4px' }}>
                ProxNet Neighborhood Network
              </div>
            </div>

            <div style={{ display: 'flex', backgroundColor: '#F3F4F6', padding: '12px 24px', borderRadius: '12px', fontSize: 22, fontWeight: 'bold', color: '#1F2937' }}>
              {interestedCount} Interested
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: any) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}
