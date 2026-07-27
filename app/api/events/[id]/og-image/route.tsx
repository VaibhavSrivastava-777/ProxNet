import { ImageResponse } from 'next/og'
import { createAdminClient } from "@/lib/supabase/admin";



export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from("events")
      .select("*, rsvps:event_rsvps(status)")
      .eq("id", id)
      .single();

    if (!event) {
      return new Response('Not Found', { status: 404 })
    }

    const rsvps = event.rsvps || [];
    const going = rsvps.filter((r: any) => r.status === "yes").length;
    
    const startObj = new Date(event.starts_at);
    const dateStr = startObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
    const timeStr = startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

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
            <div style={{ display: 'flex', color: '#E56B42', fontSize: 32, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
              MEETUP • {dateStr}
            </div>
          </div>
          
          <div style={{ 
            fontSize: 72, 
            fontWeight: 900,
            color: '#111827',
            lineHeight: 1.1,
            marginBottom: '30px',
            maxWidth: '900px'
          }}>
            {event.title}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 36, color: '#4B5563', fontWeight: 600 }}>
              <span>📍 {event.venue_name}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 36, color: '#4B5563', fontWeight: 600, marginLeft: '40px' }}>
              <span>⏰ {timeStr}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', marginTop: '60px', alignItems: 'center' }}>
            <div style={{ display: 'flex', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '16px 32px', borderRadius: '100px', fontSize: 32, fontWeight: 700 }}>
              {going} Professionals Going
            </div>
            <div style={{ display: 'flex', marginLeft: '30px', fontSize: 28, color: '#6b7280', fontWeight: 500 }}>
              proxnet.in
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
    console.error(e)
    return new Response(`Failed to generate image`, { status: 500 })
  }
}
