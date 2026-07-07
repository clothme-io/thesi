const CREATOR_TYPES = [
  { emoji: "🎥", label: "UGC Creators" },
  { emoji: "👗", label: "Fashion Creators" },
  { emoji: "✨", label: "Lifestyle Creators" },
  { emoji: "👩‍👧", label: "Moms & Parents" },
  { emoji: "🎓", label: "College Students" },
  { emoji: "📚", label: "University Students" },
  { emoji: "⚡", label: "Gen Z Creators" },
  { emoji: "📱", label: "Nano Influencers" },
  { emoji: "🌟", label: "Micro Influencers" },
  { emoji: "🛍️", label: "Shopping Enthusiasts" },
];

export function CreatorWhoFor() {
  return (
    <section className="creator-who" id="who">
      <div className="creator-section-inner">
        <p className="eyebrow">Who We&apos;re Looking For</p>
        <h2>Built for real creators</h2>
        <div className="creator-who-grid">
          {CREATOR_TYPES.map(({ emoji, label }) => (
            <div key={label} className="creator-who-card">
              <span className="creator-who-emoji" aria-hidden="true">
                {emoji}
              </span>
              <span className="creator-who-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="creator-locations">
          <p className="creator-locations-label">Currently recruiting in</p>
          <div className="creator-location-badges">
            <span className="creator-location-badge">🇺🇸 USA</span>
            <span className="creator-location-badge">🇨🇦 Canada</span>
          </div>
        </div>
      </div>
    </section>
  );
}
