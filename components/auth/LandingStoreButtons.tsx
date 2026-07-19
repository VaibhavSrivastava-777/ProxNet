"use client";

export function LandingStoreButtons({ className, iconHeightClass = "h-11" }: { className?: string; iconHeightClass?: string }) {
  const openLoginModal = (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new Event("openLoginModal"));
  };

  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      <button 
        type="button"
        onClick={openLoginModal} 
        aria-label="App Store"
        className="store-badge-link"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img src="/icons/badge-app-store.svg" alt="App Store" className={`${iconHeightClass} w-auto hover:opacity-80 transition-opacity`} />
      </button>
      <button 
        type="button"
        onClick={openLoginModal} 
        aria-label="Google Play"
        className="store-badge-link"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img src="/icons/badge-google-play.svg" alt="Google Play" className={`${iconHeightClass} w-auto hover:opacity-80 transition-opacity`} />
      </button>
    </div>
  );
}
