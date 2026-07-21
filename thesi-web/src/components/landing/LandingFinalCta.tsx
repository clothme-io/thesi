import Link from "next/link";

export function LandingFinalCta() {
  return (
    <section className="thesi-landing-section thesi-landing-final">
      <div className="thesi-landing-inner">
        <h2>Let&apos;s build something amazing together</h2>
        <p>
          Thank you for believing in ClothME this early. Join the Founding
          Creator Community and grow with Thesi.
        </p>
        <Link href="/creators" className="creator-btn-primary">
          I&apos;m a Creator
        </Link>
      </div>
    </section>
  );
}
