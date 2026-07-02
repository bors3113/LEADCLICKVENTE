import { EnrichmentPanel } from '@/components/EnrichmentPanel';

export default function EnrichPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">LinkedIn Data Enrichment</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Enhance your scraped Google Maps leads with official LinkedIn metadata. Extract deep company details,
          employee directories, and detailed professional profiles.
        </p>
      </div>

      <EnrichmentPanel />
    </div>
  );
}

