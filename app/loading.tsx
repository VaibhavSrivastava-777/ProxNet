"use client";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--color-bg)]/80 backdrop-blur-md transition-all duration-300">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          {/* Pulsing ring around the logo */}
          <div className="absolute -inset-2 rounded-3xl bg-[var(--color-primary)]/10 animate-pulse" style={{ animationDuration: "1.5s" }} />
          
          {/* Logo container */}
          <div className="relative bg-[var(--color-surface)] p-4 rounded-2xl shadow-xl border border-[var(--color-border-light)] flex items-center justify-center animate-bounce" style={{ animationDuration: "2.5s" }}>
            <img 
              src="/logo.png" 
              alt="ProxNet" 
              className="w-16 h-16 object-contain rounded-xl"
            />
          </div>
        </div>
        
        {/* Loading Spinner and Text */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs font-bold tracking-widest text-[var(--color-primary)] uppercase opacity-80">
            ProxNet
          </span>
        </div>
      </div>
    </div>
  );
}
