import { TopNav } from "@/components/TopNav";
import { NewJobForm } from "@/components/NewJobForm";

// This page must stay a Server Component (no "use client") because TopNav is
// an async server component that calls getServerSession/next-auth's
// headers(). A Client Component tree cannot render an async Server
// Component directly - all the interactive form logic lives in the client
// child component below instead.
export default function NewJobPage() {
  return (
    <div>
      <TopNav />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-bold">Create a vacancy</h1>
        <p className="mb-6 text-sm text-muted">
          Paste the job description, then either let TalentBridge auto-generate requirements from
          it, or add your own below 
        </p>
        <NewJobForm />
      </main>
    </div>
  );
}
