"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRunAndDiscover } from "@/app/actions";

const NICHES = [
  "thai_restaurant",
  "dentist",
  "plumber",
  "electrician",
  "hair_salon",
  "pizza_restaurant",
  "coffee_shop",
  "laundry",
  "automotive_repair",
  "personal_trainer",
];

const CITIES = [
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Hobart",
  "Canberra",
  "Gold Coast",
  "Newcastle",
  "Wollongong",
];

export default function NewRunPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [visionAudit, setVisionAudit] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await createRunAndDiscover({
        niche,
        city,
        config: { vision_audit: visionAudit },
      });

      if (result.error) {
        setError(result.error);
      } else if (result.runId) {
        router.push(`/runs/${result.runId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">New Discovery Run</h1>
        <p className="text-muted-foreground mt-2">
          Find local businesses ready for a website redesign
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Business Niche *
          </label>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            required
            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a niche...</option>
            {NICHES.map((n) => (
              <option key={n} value={n}>
                {n.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            City *
          </label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a city...</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t pt-6">
          <h2 className="font-semibold text-foreground mb-4">Advanced Options</h2>

          <div className="flex items-start gap-3">
            <input
              id="vision_audit"
              type="checkbox"
              checked={visionAudit}
              onChange={(e) => setVisionAudit(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-input"
            />
            <div className="flex-1">
              <label htmlFor="vision_audit" className="font-medium text-foreground">
                Include visual aesthetic audit
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                Uses one Claude vision call per lead to detect ugly-but-functional sites.
                Adds ~$0.01/lead and a few seconds per audit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading || !niche || !city}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Starting..." : "Start Discovery"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-input rounded-lg hover:bg-muted text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
