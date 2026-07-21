const CREATOR_GETS = [
  {
    title: "Exclusive creator campaigns",
    body: "Experience, growth, product, partnership, and community campaigns — with briefs, deliverables, and example videos.",
  },
  {
    title: "Your Creator Dashboard",
    body: "Track campaigns, deadlines, invitations, and your work in one place.",
  },
  {
    title: "Brand collaboration opportunities",
    body: "Discover listings on the marketplace and connect with fashion brands ready to hire.",
  },
  {
    title: "UGC creation opportunities",
    body: "Build your portfolio with authentic content that helps shoppers and brands.",
  },
  {
    title: "Creator CRM & pipeline",
    body: "Manage brands, deals, jobs, tasks, and contracts as you grow your UGC business.",
  },
  {
    title: "Invoices & payouts",
    body: "Create invoices, track payments, and get paid through Stripe Connect payouts.",
  },
  {
    title: "Inbox & invitations",
    body: "Stay close to campaign invites and conversations with the ClothME team and brands.",
  },
  {
    title: "Greater visibility",
    body: "Show up in the creator directory and marketplace so the right opportunities find you.",
  },
  {
    title: "Direct access to the ClothME team",
    body: "A curated community so each creator gets meaningful support and visibility.",
  },
  {
    title: "Recognition as a Founding Creator",
    body: "Be part of the community shaping ClothME from the beginning.",
  },
];

export function LandingWhatCreatorsGet() {
  return (
    <section className="thesi-landing-section" id="what-creators-get">
      <div className="thesi-landing-inner">
        <p className="eyebrow">Built for your business</p>
        <h2>What creators get</h2>
        <p className="thesi-landing-lead">
          Early access to campaigns and community — plus the Thesi tools
          ClothME UGC creators use to run their work end to end.
        </p>
        <div className="thesi-landing-get-grid">
          {CREATOR_GETS.map((item) => (
            <article key={item.title} className="thesi-landing-get-item">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
