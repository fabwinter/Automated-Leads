"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { fetchLeadsForRun, fetchRun } from "@/lib/supabase";
import { Run, Lead, Outreach } from "@outreach-engine/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OutreachPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<Run | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [outreach, setOutreach] = useState<Record<string, Outreach>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const runData = await fetchRun(runId);
      setRun(runData);

      const leadsData = await fetchLeadsForRun(runId);
      setLeads(leadsData.filter((l) => ["drafted", "approved", "sent"].includes(l.status)));

      // Fetch outreach records
      const outreachMap: Record<string, Outreach> = {};
      for (const lead of leadsData) {
        const res = await fetch(
          `/api/outreach?lead_id=${lead.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data) outreachMap[lead.id] = data;
        }
      }
      setOutreach(outreachMap);
      setLoading(false);
    };

    load();
  }, [runId]);

  const handleDraft = async (leadId: string) => {
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, run_id: runId }),
      });
      if (res.ok) {
        const data = await res.json();
        setOutreach((prev) => ({
          ...prev,
          [leadId]: {
            ...outreach[leadId],
            subject: data.draft_subject,
            body: data.draft_body,
            status: "draft",
          },
        }));
      }
    } catch (e) {
      console.error("Draft failed:", e);
    }
  };

  const handleStartEdit = (leadId: string) => {
    const item = outreach[leadId];
    if (item) {
      setEditingId(leadId);
      setEditSubject(item.subject || "");
      setEditBody(item.body || "");
    }
  };

  const handleSaveEdit = async (leadId: string) => {
    try {
      const res = await fetch("/api/outreach", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          subject: editSubject,
          body: editBody,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOutreach((prev) => ({
          ...prev,
          [leadId]: data,
        }));
        setEditingId(null);
      }
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const handleApprove = async (leadId: string) => {
    try {
      const res = await fetch("/api/outreach", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          status: "approved",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOutreach((prev) => ({
          ...prev,
          [leadId]: data,
        }));
      }
    } catch (e) {
      console.error("Approve failed:", e);
    }
  };

  const handleSend = async (leadId: string) => {
    setSending(leadId);
    try {
      const lead = leads.find((l) => l.id === leadId);
      const item = outreach[leadId];
      if (!lead || !item) return;

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          to: lead.email,
          subject: item.subject,
          body: item.body,
        }),
      });

      if (res.ok) {
        setOutreach((prev) => ({
          ...prev,
          [leadId]: {
            ...prev[leadId],
            status: "sent",
            sent_at: new Date().toISOString(),
          },
        }));
      }
    } catch (e) {
      console.error("Send failed:", e);
    } finally {
      setSending(null);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Outreach Queue</h1>
          <p className="text-muted-foreground mt-1">Run: {run?.niche} → {run?.city}</p>
        </div>
        <Link href={`/runs/${runId}`}>
          <Button variant="outline">Back to Worklist</Button>
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No qualified leads with demos yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Business</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Subject</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const item = outreach[lead.id];
                  const isEditing = editingId === lead.id;

                  return (
                    <tr key={lead.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">{lead.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            item?.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : item?.status === "approved"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {item?.status || "pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                          />
                        ) : (
                          <span className="text-xs truncate">{item?.subject || "No draft"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {!item ? (
                          <Button
                            size="sm"
                            onClick={() => handleDraft(lead.id)}
                            variant="outline"
                          >
                            Draft
                          </Button>
                        ) : isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(lead.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : item.status === "draft" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartEdit(lead.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApprove(lead.id)}
                            >
                              Approve
                            </Button>
                          </>
                        ) : item.status === "approved" ? (
                          <Button
                            size="sm"
                            onClick={() => handleSend(lead.id)}
                            disabled={sending === lead.id}
                          >
                            {sending === lead.id ? "Sending..." : "Send"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingId && outreach[editingId] && (
        <div className="mt-8 p-6 border rounded-lg bg-muted/30">
          <h2 className="text-lg font-semibold mb-4">Edit Draft</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Subject</label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Body</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full px-3 py-2 border rounded min-h-32"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleSaveEdit(editingId)}>Save Changes</Button>
              <Button
                variant="outline"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
