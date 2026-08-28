"use client";

import {
  emptyUgcPost,
  MAX_UGC_POSTS,
  CREATOR_UGC_PLATFORMS,
  type CreatorUgcPostInput,
} from "@/lib/profile/creator-types";

type Props = {
  posts: CreatorUgcPostInput[];
  onChange: (posts: CreatorUgcPostInput[]) => void;
};

export function CreatorPortfolioBuilder({ posts, onChange }: Props) {
  const updatePost = (index: number, patch: Partial<CreatorUgcPostInput>) => {
    onChange(posts.map((post, i) => (i === index ? { ...post, ...patch } : post)));
  };

  return (
    <div className="workspace-field workspace-field--full">
      <span>Portfolio posts</span>
      <p className="workspace-hint" style={{ margin: 0 }}>
        Add work so brands can see proof. Title and platform are required; views and
        likes are optional.
      </p>
      <div className="portfolio-builder">
        {posts.map((post, index) => (
          <div className="portfolio-row" key={post.id || `post-${index}`}>
            <label className="workspace-field">
              <span>Title</span>
              <input
                type="text"
                placeholder="Summer try-on reel"
                value={post.title}
                onChange={(e) => updatePost(index, { title: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Platform</span>
              <select
                value={post.platform}
                onChange={(e) => updatePost(index, { platform: e.target.value })}
              >
                {CREATOR_UGC_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label className="workspace-field">
              <span>URL</span>
              <input
                type="url"
                placeholder="https://"
                value={post.url}
                onChange={(e) => updatePost(index, { url: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Posted</span>
              <input
                type="date"
                value={post.postedAt}
                onChange={(e) => updatePost(index, { postedAt: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Views</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={post.views ? String(post.views) : ""}
                onChange={(e) =>
                  updatePost(index, {
                    views: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                  })
                }
              />
            </label>
            <label className="workspace-field">
              <span>Likes</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={post.likes ? String(post.likes) : ""}
                onChange={(e) =>
                  updatePost(index, {
                    likes: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                  })
                }
              />
            </label>
            <button
              type="button"
              className="inbox-btn-text portfolio-row-remove"
              onClick={() => onChange(posts.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {posts.length < MAX_UGC_POSTS ? (
        <button
          type="button"
          className="inbox-btn-text"
          style={{ marginTop: 4 }}
          onClick={() => onChange([...posts, emptyUgcPost()])}
        >
          + Add post
        </button>
      ) : null}
    </div>
  );
}
