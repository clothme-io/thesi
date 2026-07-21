import Link from "next/link";

export function LandingHero() {
  return (
    <section className="thesi-landing-hero thesi-landing-hero--rich">
      <div className="thesi-landing-hero-copy">
        <p className="eyebrow">Thesi for ClothME UGC Creators</p>
        <h1>Grow as a creator — not just post and get paid</h1>
        <p className="thesi-landing-sub">
          A long-term creator community where authentic content, meaningful
          partnerships, and real tools help you build your creative business
          alongside ClothME.
        </p>
        <div className="creator-hero-ctas">
          <Link href="/creators" className="creator-btn-primary">
            I&apos;m a Creator
          </Link>
          <a href="#what-creators-get" className="creator-btn-ghost">
            See what you get
          </a>
        </div>
      </div>
      <div className="thesi-landing-hero-visual" aria-hidden="true">
        <div className="thesi-landing-hero-orb thesi-landing-hero-orb--a" />
        <div className="thesi-landing-hero-orb thesi-landing-hero-orb--b" />
        <img
          className="thesi-landing-hero-photo"
          src="/family-shopping.jpg"
          alt=""
        />
      </div>
    </section>
  );
}
