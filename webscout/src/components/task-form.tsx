"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Globe } from "lucide-react";

interface TaskFormProps {
  onTaskComplete?: () => void;
}

export function TaskForm({ onTaskComplete }: TaskFormProps) {
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, target }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Task failed");
      }

      setUrl("");
      setTarget("");
      onTaskComplete?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400 mb-1 block">URL</label>
          <Input
            type="url"
            placeholder="https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          />
        </div>

        <div>
          <label className="text-sm text-zinc-400 mb-1 block">
            What to extract
          </label>
          <Textarea
            placeholder='e.g., "book title and price"'
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            disabled={loading}
            rows={2}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running scrape... (this may take a moment)
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Run Task
            </>
          )}
        </Button>
      </form>

      <div className="mt-4 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600 mb-2">Quick examples:</p>
        <div className="space-y-1">
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            onClick={() => {
              setUrl("https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html");
              setTarget("book title and price");
            }}
            disabled={loading}
          >
            books.toscrape.com - book title and price
          </button>
          <br />
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            onClick={() => {
              setUrl("https://quotes.toscrape.com/");
              setTarget("first quote text and author");
            }}
            disabled={loading}
          >
            quotes.toscrape.com - first quote and author
          </button>
          <br />
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            onClick={() => {
              setUrl("https://news.ycombinator.com");
              setTarget("top 3 story titles");
            }}
            disabled={loading}
          >
            news.ycombinator.com - top 3 story titles
          </button>
          <br />
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            onClick={() => {
              setUrl("https://github.com/trending");
              setTarget("top trending repository name and description");
            }}
            disabled={loading}
          >
            github.com/trending - top trending repo name and description
          </button>
          <br />
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            onClick={() => {
              setUrl("https://example.com");
              setTarget("main heading text");
            }}
            disabled={loading}
          >
            example.com - main heading text
          </button>
        </div>
      </div>
    </Card>
  );
}
