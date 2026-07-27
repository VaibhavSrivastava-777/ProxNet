import { ImageResponse } from 'next/og';
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from("events")
      .select("*, creator:users!events_creator_id_fkey(full_name, job_title, company), rsvps:event_rsvps(status)")
      .eq("id", id)
      .single();

    if (!event) {
      return new Response('Not Found', { status: 404 });
    }

    const rsvps = event.rsvps || [];
    const going = rsvps.filter((r: any) => r.status === "yes").length;

    const formatTimeIST = (isoStr: string) => {
      try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (err) {
        const d = new Date(isoStr);
        const ist = new Date(d.getTime() + (5.5 * 3600 * 1000));
        let hours = ist.getUTCHours();
        const minutes = ist.getUTCMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const minStr = minutes < 10 ? `0${minutes}` : minutes;
        return `${hours}:${minStr} ${ampm}`;
      }
    };

    const formatDateIST = (isoStr: string) => {
      try {
        const d = new Date(isoStr);
        return d.toLocaleDateString("en-US", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
          month: "short",
          day: "numeric",
        }).toUpperCase();
      } catch (err) {
        const d = new Date(isoStr);
        const ist = new Date(d.getTime() + (5.5 * 3600 * 1000));
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        return `${days[ist.getUTCDay()]}, ${months[ist.getUTCMonth()]} ${ist.getUTCDate()}`;
      }
    };

    const dateStr = formatDateIST(event.starts_at);
    const startTimeStr = formatTimeIST(event.starts_at);
    const endTimeStr = formatTimeIST(event.ends_at);
    const timeStr = `${startTimeStr} – ${endTimeStr}`;

    const hostName = event.creator?.full_name || "Neighbor";
    const hostTitle = event.creator?.job_title ? `${event.creator.job_title} @ ${event.creator.company || ''}` : '';

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
          {/* Header Badge */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ 
              display: 'flex', 
              backgroundColor: '#FFF0EB', 
              color: '#E56B42', 
              fontSize: 24, 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              letterSpacing: '1.5px',
              padding: '8px 20px',
              borderRadius: '100px',
              border: '1.5px solid #FFD6C9'
            }}>
              MEETUP • {dateStr}
            </div>
            
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: '#4F46E5' }}>
              ProxNet
            </div>
          </div>

          {/* Title & Subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '20px', marginBottom: '20px', width: '100%' }}>
            <div style={{ 
              fontSize: 64, 
              fontWeight: 900,
              color: '#111827',
              lineHeight: 1.15,
              maxWidth: '1040px'
            }}>
              {event.title}
            </div>
            {event.subtitle && (
              <div style={{ fontSize: 28, fontWeight: 600, color: '#4B5563', marginTop: '12px' }}>
                {event.subtitle}
              </div>
            )}
          </div>

          {/* Venue & Time Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px', backgroundColor: '#F9FAFB', padding: '20px 30px', borderRadius: '16px', border: '1px solid #E5E7EB', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, color: '#1F2937', fontWeight: 700 }}>
              <span>📍 {event.venue_name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, color: '#1F2937', fontWeight: 700 }}>
              <span>⏰ {timeStr}</span>
            </div>
          </div>

          {/* Footer Info */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', borderTop: '2px solid #F3F4F6', paddingTop: '24px', marginTop: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#111827' }}>
                Hosted by {hostName}
              </div>
              {hostTitle && (
                <div style={{ display: 'flex', fontSize: 18, color: '#6B7280', marginTop: '2px' }}>
                  {hostTitle}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '12px 24px', borderRadius: '100px', fontSize: 22, fontWeight: 800 }}>
              {going} Going
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
