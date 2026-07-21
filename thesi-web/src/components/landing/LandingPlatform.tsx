export function LandingPlatform() {
  const features = [
    {
      title: "Campaigns & marketplace",
      body: "Browse open opportunities, apply with a pitch, and work campaigns with clear briefs and deliverables.",
    },
    {
      title: "Creator CRM",
      body: "Keep brands, deals, jobs, tasks, and contracts organized as your UGC business scales.",
    },
    {
      title: "Money tools",
      body: "Send invoices, track payment history, and receive payouts through Stripe Connect.",
    },
    {
      title: "Inbox",
      body: "Campaign invitations and messages in one place so you never miss the next opportunity.",
    },
  ];

  return (
    <section className="thesi-landing-section thesi-landing-section--surface" id="platform">
      <div className="thesi-landing-inner">
        <p className="eyebrow">Thesi platform</p>
        <h2>Everything you need to run your UGC business</h2>
        <p className="thesi-landing-lead">
          Thesi is the workspace for ClothME UGC creators — campaigns,
          collaborations, and cash flow without juggling spreadsheets and DMs.
        </p>
        <div className="thesi-landing-platform-grid">
          {features.map((item) => (
            <article key={item.title} className="thesi-landing-platform-item">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
