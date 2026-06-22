import Link from "next/link";

export function CarpoolGatekeeper() {
  return (
    <div className="card p-8 md:p-12 text-center animate-fadeInUp flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      </div>
      
      <h2 className="text-h2 mb-4 text-[var(--color-text)]">Unlock Your Commute</h2>
      <p className="text-body-lg text-[var(--color-text-secondary)] mb-8 max-w-2xl">
        To use ProxNet Carpool, you need to provide both your <strong>Home</strong> and <strong>Office</strong> locations in your profile. 
        Once completed, you'll unlock smart route matching and gain visibility to neighbors heading your way.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 w-full max-w-4xl text-left">
        <div className="bg-[var(--color-bg)] p-6 rounded-2xl border border-[var(--color-border-light)]">
          <h3 className="text-h3 mb-2 flex items-center gap-2">
            <span className="text-2xl">🤝</span> Networking
          </h3>
          <p className="text-body-sm text-[var(--color-text-secondary)]">Connect with verified professionals in your proximity and expand your local network outside your immediate circle.</p>
        </div>
        <div className="bg-[var(--color-bg)] p-6 rounded-2xl border border-[var(--color-border-light)]">
          <h3 className="text-h3 mb-2 flex items-center gap-2">
            <span className="text-2xl">💬</span> Engagement
          </h3>
          <p className="text-body-sm text-[var(--color-text-secondary)]">Turn a boring commute into an engaging conversation. Make the journey as productive as the destination.</p>
        </div>
        <div className="bg-[var(--color-bg)] p-6 rounded-2xl border border-[var(--color-border-light)]">
          <h3 className="text-h3 mb-2 flex items-center gap-2">
            <span className="text-2xl">🧠</span> Learning
          </h3>
          <p className="text-body-sm text-[var(--color-text-secondary)]">Gain fresh perspectives and learn from peers working in different companies or roles on your way to work.</p>
        </div>
      </div>

      <Link href="/profile" className="btn btn-primary btn-lg font-semibold px-10 rounded-full shadow-md hover:shadow-lg transition-all">
        Complete Your Profile
      </Link>
    </div>
  );
}
