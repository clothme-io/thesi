function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <header className="app-topbar">
        <h1>{title}</h1>
      </header>
      <div className="app-content">
        <div className="app-panel">
          <h2>Coming soon</h2>
          <p>{description}</p>
        </div>
      </div>
    </>
  );
}

export default function InvoicesPage() {
  return (
    <PlaceholderPage
      title="Invoices"
      description="Create and send invoices to your clients."
    />
  );
}
