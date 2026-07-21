const OUTCOMES = [
  {
    title: "Creators grow",
    body: "Tools, relationships, insights, and experiences that help you grow your creative business.",
  },
  {
    title: "Fashion brands & boutiques grow",
    body: "Meaningful partnerships that help brands and local fashion businesses thrive.",
  },
  {
    title: "Shoppers discover what fits",
    body: "Authentic content that helps people find clothing that fits their lives.",
  },
  {
    title: "ClothME grows with you",
    body: "The platform grows alongside the community — and creators grow with it.",
  },
];

export function LandingEcosystem() {
  return (
    <section className="thesi-landing-section thesi-landing-section--surface">
      <div className="thesi-landing-inner">
        <p className="eyebrow">Why we&apos;re building this</p>
        <h2>An ecosystem where everyone grows</h2>
        <p className="thesi-landing-lead">
          Our vision goes far beyond another influencer program. We&apos;re
          building a creator community where authentic content, meaningful
          partnerships, and long-term opportunities help creators grow alongside
          the platform.
        </p>
        <div className="thesi-landing-outcomes">
          {OUTCOMES.map((item) => (
            <article key={item.title} className="thesi-landing-outcome">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
