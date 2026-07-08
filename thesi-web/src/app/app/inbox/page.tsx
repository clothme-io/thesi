import { Suspense } from "react";
import { InboxPageContent } from "@/components/inbox/InboxPageContent";

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageContent />
    </Suspense>
  );
}
