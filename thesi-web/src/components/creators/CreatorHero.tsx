import Link from "next/link";

export function CreatorHero() {
  return (
    <section className="creator-hero">
      <div className="creator-hero-circle creator-hero-circle--tl" aria-hidden="true">
        <img src="/family-shopping.jpg" alt="" />
      </div>
      <div className="creator-hero-circle creator-hero-circle--tr" aria-hidden="true">
        <img src="/personal-shopping.jpg" alt="" />
      </div>
      <div className="creator-hero-circle creator-hero-circle--bl" aria-hidden="true">
        <img src="/personal-shopping.jpg" alt="" />
      </div>
      <div className="creator-hero-circle creator-hero-circle--br" aria-hidden="true">
        <img src="/family-shopping.jpg" alt="" />
      </div>

      <div className="creator-hero-inner">
        <p className="eyebrow">Thesi Creator Community</p>
        <h1>
          Run your UGC business
          <br />
          in one place
        </h1>
        <p className="creator-hero-sub">
          CRM, campaigns, invoices, and marketplace — built for UGC creators
        </p>
        <div className="creator-hero-ctas">
          <Link href="/creators/apply" className="creator-btn-primary">
            Apply Now
          </Link>
          <a href="#about" className="creator-btn-ghost">
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
