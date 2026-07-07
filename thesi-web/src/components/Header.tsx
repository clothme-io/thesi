import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Thesi home">
        <img className="brand-logo" src="/clothme-logo.png" alt="" aria-hidden="true" />
        <span className="brand-word">Thesi</span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/creators">Creators</Link>
        <Link href="/brands">Brands</Link>
        <Link href="/sign-in">Sign in</Link>
      </nav>
    </header>
  );
}
