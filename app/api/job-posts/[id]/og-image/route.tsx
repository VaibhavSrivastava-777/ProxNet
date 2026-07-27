import { ImageResponse } from 'next/og';
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const supabase = createAdminClient();
    const { data: jobPost } = await supabase
      .from("job_posts")
      .select("*, creator:users!job_posts_user_id_fkey(full_name, job_title, company), interests:job_post_interests(status)")
      .eq("id", id)
      .single();

    if (!jobPost) {
      return new Response('Not Found', { status: 404 });
    }

    const interests = jobPost.interests || [];
    const interestedCount = interests.filter((i: any) => i.status === "interested").length;

    const isSeeker = jobPost.type === "seeker";
    const badgeText = isSeeker ? "LOOKING FOR ROLE" : "HIRING / REFERRING";
    const badgeBg = isSeeker ? "#2563EB" : "#059669";

    const hostName = jobPost.creator?.full_name || "a Neighbor";
    const hostTitle = jobPost.creator?.job_title ? `${jobPost.creator.job_title} @ ${jobPost.creator.company || ''}` : '';

    const skillsList = jobPost.skills 
      ? jobPost.skills.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 4)
      : [];

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #E5E7EB 2%, transparent 0%), radial-gradient(circle at 75px 75px, #E5E7EB 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            padding: '70px 80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ 
              display: 'flex', 
              backgroundColor: badgeBg, 
              color: '#ffffff', 
              fontSize: 22, 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              letterSpacing: '1.5px',
              padding: '8px 20px',
              borderRadius: '100px',
            }}>
              {badgeText}
            </div>

            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: '#2563EB' }}>
              ProxNet
            </div>
          </div>
          
          {/* Role & Company */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '20px', marginBottom: '20px', width: '100%' }}>
            <div style={{ 
              display: 'flex', 
              fontSize: 60, 
              fontWeight: 900, 
              color: '#111827', 
              lineHeight: 1.15, 
              maxWidth: '1040px' 
            }}>
              {jobPost.role}
            </div>

            {jobPost.company && (
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#4B5563', marginTop: '12px' }}>
                🏢 {jobPost.company} {jobPost.experience_years ? `• ⌛ ${jobPost.experience_years}` : ''}
              </div>
            )}
          </div>

          {/* Skills pills */}
          {skillsList.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {skillsList.map((skill: string, index: number) => (
                <div key={index} style={{
                  display: 'flex',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  fontSize: 20,
                  fontWeight: 600,
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB'
                }}>
                  {skill}
                </div>
              ))}
            </div>
          )}

          {/* Footer Info */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', borderTop: '2px solid #F3F4F6', paddingTop: '24px', marginTop: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#111827' }}>
                Posted by {hostName}
              </div>
              {hostTitle && (
                <div style={{ display: 'flex', fontSize: 18, color: '#6B7280', marginTop: '2px' }}>
                  {hostTitle}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', backgroundColor: '#ECFDF5', color: '#047857', padding: '12px 24px', borderRadius: '100px', fontSize: 22, fontWeight: 800, border: '1px solid #A7F3D0' }}>
              {interestedCount} Interested
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
