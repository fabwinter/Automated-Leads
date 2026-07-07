"use client";

import { useState, useEffect } from "react";
import { fetchRun, fetchLeadsForRun, fetchAuditsForLeads, supabase } from "@/lib/supabase";
import type { Run, Lead, Audit } from "@outreach-engine/types";

export default function WorklistPage({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const [run, setRun] = useState<Run | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [audits, setAudits] = useState<Map<string, Audit>>(new Map());
  const [demos, setDemos] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDead, setShowDead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [generatingDemoId, setGeneratingDemoId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const runData = await fetchRun(runId);
        if (!runData) {
          setError("Run not found");
          setLoading(false);
          return;
        }
        setRun(runData);

        const leadsData = await fetchLeadsForRun(runId);
        setLeads(leadsData);

        const auditsData = await fetchAuditsForLeads(leadsData.map((l) => l.id));
        setAudits(auditsData);

        // Fetch demos
        const demosMap = new Map();
        const { data: demosData } = await supabase
          .from("demos")
          .select()
          .in(
            "lead_id",
            leadsData.map((l) => l.id)
          );
        if (demosData) {
          for (const demo of demosData) {
            demosMap.set(demo.lead_id, demo);
          }
        }
        setDemos(demosMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [runId]);

  async function generateDemo(leadId: string) {
    setGeneratingDemoId(leadId);
    try {
      const response = await fetch("/api/generate-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, run_id: runId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate demo");
      }

      const result = await response.json();
      if (result.demoUrl) {
        // Reload data to show new demo
        const leadsData = await fetchLeadsForRun(runId);
        setLeads(leadsData);
      }
    } catch (err) {
      alert(
        "Error generating demo: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setGeneratingDemoId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-red-500">{error || "Error loading run"}</div>
      </div>
    );
  }

  const displayLeads = showDead ? leads : leads.filter((l) => l.status !== "dead");
  const qualifiedLeads = leads.filter((l) => l.status === "qualified");
  const deadLeads = leads.filter((l) => l.status === "dead");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {run.niche} → {run.city}
            </h1>
            <p className="text-muted-foreground mt-1">
              Status: {run.status} | Discovered: {run.discovered_count} | Audited:{" "}
              {run.audited_count}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Discovered</div>
            <div className="text-2xl font-bold text-foreground">{leads.length}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Qualified</div>
            <div className="text-2xl font-bold text-primary">{qualifiedLeads.length}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Dead</div>
            <div className="text-2xl font-bold text-muted-foreground">{deadLeads.length}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showDead}
              onChange={(e) => setShowDead(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Show dead leads ({deadLeads.length})
          </label>
        </div>
      </div>

      {displayLeads.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            {showDead ? "No leads found" : "No qualified leads yet. Audits are in progress..."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-foreground">
                  Business
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground">
                  Rating
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground">
                  Issue
                </th>
                <th className="text-right py-3 px-4 font-medium text-foreground">
                  Priority
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {displayLeads.map((lead) => {
                const audit = audits.get(lead.id);
                const statusColor =
                  lead.status === "qualified"
                    ? "bg-green-50 text-green-700"
                    : lead.status === "dead"
                      ? "bg-gray-50 text-gray-700"
                      : "bg-blue-50 text-blue-700";

                return (
                  <tr
                    key={lead.id}
                    className="border-b border-border hover:bg-muted cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-foreground">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.city} · {lead.niche.replace(/_/g, " ")}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-foreground">{lead.rating?.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.review_count} reviews
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-foreground line-clamp-2">
                      {audit?.issue_summary || "Auditing..."}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-primary">
                      {lead.priority.toFixed(0)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColor}`}
                        >
                          {lead.status}
                        </span>
                        {lead.status === "qualified" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateDemo(lead.id);
                            }}
                            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                          >
                            Generate Demo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          audit={audits.get(selectedLead.id)}
          demos={demos}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
}

function LeadModal({
  lead,
  audit,
  demos,
  onClose,
}: {
  lead: Lead;
  audit?: Audit;
  demos?: Map<string, any>;
  onClose: () => void;
}) {
  const demo = demos?.get(lead.id);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">{lead.name}</h2>
              <p className="text-sm text-muted-foreground">
                {lead.city} · {lead.niche.replace(/_/g, " ")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Rating</div>
                <div className="text-lg font-semibold text-foreground">
                  {lead.rating?.toFixed(1)} ({lead.review_count} reviews)
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Priority Score</div>
                <div className="text-lg font-semibold text-primary">
                  {lead.priority.toFixed(0)}
                </div>
              </div>
            </div>

            {lead.website_url && (
              <div>
                <div className="text-sm text-muted-foreground">Website</div>
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {lead.website_url}
                </a>
              </div>
            )}

            {lead.phone && (
              <div>
                <div className="text-sm text-muted-foreground">Phone</div>
                <div className="text-foreground">{lead.phone}</div>
              </div>
            )}

            {demo && (
              <div className="border-t pt-4">
                <div className="text-sm font-semibold text-foreground mb-2">
                  Demo Site
                </div>
                <a
                  href={demo.deploy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  View live demo →
                </a>
                <p className="text-xs text-muted-foreground mt-1">{demo.deploy_url}</p>
              </div>
            )}

            {audit && (
              <>
                <div className="border-t pt-4">
                  <div className="text-sm font-semibold text-foreground mb-2">
                    Audit Results
                  </div>
                  <div className="bg-muted p-3 rounded text-sm">
                    <p className="text-foreground">{audit.issue_summary}</p>
                  </div>
                </div>

                {audit.screenshot_url && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold text-foreground mb-2">
                      Screenshot
                    </div>
                    <img
                      src={audit.screenshot_url}
                      alt="Website screenshot"
                      className="max-w-full rounded border border-border"
                    />
                  </div>
                )}

                {audit.pagespeed_mobile && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold text-foreground mb-2">
                      Performance Scores
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-sm">
                        <div className="text-muted-foreground">Mobile</div>
                        <div className="text-lg font-semibold">{audit.pagespeed_mobile}</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-muted-foreground">Desktop</div>
                        <div className="text-lg font-semibold">
                          {audit.pagespeed_desktop}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
