"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { formatCount } from "@/lib/creators/types";

type ImportedPost = {
  id: string;
  title: string;
  platform: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  source: string;
  mediaId: string;
};

type LookupPreview = {
  provider: string;
  title: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
};

export function CreatorImportedPosts() {
  const { authenticatedRequest, session } = useAuth();
  const [posts, setPosts] = useState<ImportedPost[]>([]);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<LookupPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const next = await authenticatedRequest<{ posts?: ImportedPost[] }>(
      "/api/social/content",
      { method: "GET" },
    );
    setPosts(next?.posts ?? []);
  }, [authenticatedRequest]);

  useEffect(() => {
    if (session?.user.role !== "creator") return;
    void load().catch((requestError) => {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load imported posts",
      );
    });
  }, [load, session?.user.role]);

  if (session?.user.role !== "creator") return null;

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await work();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="workspace-section">
      <h3>Imported posts</h3>
      <p className="workspace-hint" style={{ marginTop: 0 }}>
        Paste a TikTok, Instagram, or YouTube URL from an account you already
        verified. Thesi only reads views, likes, and comments — it never posts.
      </p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="workspace-grid">
        <label className="workspace-field workspace-field--full">
          <span>Post URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
            }}
            placeholder="https://www.tiktok.com/@you/video/…"
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button
          type="button"
          className="crm-btn-secondary"
          disabled={!url.trim() || Boolean(busy)}
          onClick={() =>
            void run("lookup", async () => {
              const next = await authenticatedRequest<LookupPreview>(
                "/api/social/content/lookup",
                { method: "POST", body: { url } },
              );
              setPreview(next);
            })
          }
        >
          {busy === "lookup" ? "Looking up…" : "Look up"}
        </button>
        <button
          type="button"
          className="crm-btn-primary"
          disabled={!url.trim() || Boolean(busy)}
          onClick={() =>
            void run("import", async () => {
              await authenticatedRequest("/api/social/content/import", {
                method: "POST",
                body: { url },
              });
              setUrl("");
              setPreview(null);
              await load();
            })
          }
        >
          {busy === "import" ? "Importing…" : "Import post"}
        </button>
      </div>
      {preview ? (
        <p className="workspace-hint" role="status">
          {preview.title || preview.provider} · {formatCount(preview.views)} views ·{" "}
          {formatCount(preview.likes)} likes · {formatCount(preview.comments)}{" "}
          comments
        </p>
      ) : null}
      {posts.length === 0 ? (
        <p className="workspace-hint">No imported posts yet.</p>
      ) : (
        <div className="brand-ugc-table-wrap" style={{ marginTop: 16 }}>
          <table className="brand-ugc-table">
            <thead>
              <tr>
                <th>Post</th>
                <th>Platform</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id || post.url}>
                  <td>
                    {post.url ? (
                      <a href={post.url} target="_blank" rel="noreferrer">
                        {post.title || post.url}
                      </a>
                    ) : (
                      post.title
                    )}
                  </td>
                  <td>{post.platform}</td>
                  <td>{formatCount(post.views)}</td>
                  <td>{formatCount(post.likes)}</td>
                  <td>{formatCount(post.comments)}</td>
                  <td>
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(`refresh-${post.id}`, async () => {
                          await authenticatedRequest(
                            `/api/social/content/${post.id}/refresh`,
                            { method: "POST" },
                          );
                          await load();
                        })
                      }
                    >
                      {busy === `refresh-${post.id}` ? "Refreshing…" : "Refresh"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
