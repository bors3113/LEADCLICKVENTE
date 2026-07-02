import { OutreachPanel } from '@/components/OutreachPanel';

export default function OutreachPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Cold Email Outreach</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Send personalized outreach to your leads from your own connected Gmail or Outlook inbox.
          Pick a result file, draft your message, and send. Each email costs enrichment credits.
        </p>
      </div>

      <OutreachPanel />
    </div>
  );
}
