import Link from "next/link";
import { fetchUserRuns, fetchLeadsForRun, fetchAuditsForLeads } from "@/lib/supabase";

export default async function DashboardPage() {

  let runs: any[] = [];
  let runStats: Record<string, any> = {};

  try {
    runs = await fetchUserRuns();

    // Fetch stats for each run
    for (const run of runs) {
      const leads = await fetchLeadsForRun(run.id);
      const audits = await fetchAuditsForLeads(leads.map((l) => l.id));
      const qualifiedCount = leads.filter((l) => l.status === "qualified").length;

      runStats[run.id] = {
        totalLeads: leads.length,
        qualifiedLeads: qualifiedCount,
        auditedLeads: leads.filter((l) => audits.has(l.id)).length,
      };
    }
  } catch (error) {
    console.error("Failed to fetch runs:", error);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your outreach campaigns
          </p>
        </div>
        <Link
          href="/runs/new"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
        >
          New Run
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No runs yet
          </h2>
          <p className="text-muted-foreground mb-6">
            Create your first discovery run to find local businesses.
          </p>
          <Link
            href="/runs/new"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
          >
            Start a New Run
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {runs.map((run) => {
            const stats = runStats[run.id] || {
              totalLeads: 0,
              qualifiedLeads: 0,
              auditedLeads: 0,
            };
            return (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="block bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">
                      {run.niche} → {run.city}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created {new Date(run.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex gap-6 text-sm">
                      <div>
                        <div className="font-semibold text-foreground">
                          {stats.totalLeads}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Discovered
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {stats.qualifiedLeads}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Qualified
                        </div>
                      </div>
                      <div>
                        <div className="text-xs px-2 py-1 bg-muted rounded">
                          {run.status}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
