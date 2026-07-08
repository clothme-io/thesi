"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  isFavorite,
  sortProfilesWithFavoritesFirst,
  toggleFavorite,
  useBrandCreatorFavorites,
} from "@/lib/brand-creators/storage";
import { BRAND_CREATORS_ROUTES } from "@/lib/brand-creators/routes";
import { getAllCreators } from "@/lib/creators/directory";
import { formatCount, formatPercent } from "@/lib/creators/types";

export function BrandCreatorsPageContent() {
  const { data: favData, ready, persist } = useBrandCreatorFavorites();
  const [query, setQuery] = useState("");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const allCreators = getAllCreators();

  const niches = useMemo(() => {
    const set = new Set<string>();
    allCreators.forEach((c) => c.niches.forEach((n) => set.add(n)));
    return ["all", ...Array.from(set).sort()];
  }, [allCreators]);

  const creators = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allCreators.filter((creator) => {
      if (favoritesOnly && !isFavorite(favData, creator.id)) return false;
      if (nicheFilter !== "all" && !creator.niches.includes(nicheFilter)) return false;
      if (!q) return true;
      return (
        creator.name.toLowerCase().includes(q) ||
        creator.email.toLowerCase().includes(q) ||
        creator.niches.some((n) => n.toLowerCase().includes(q)) ||
        creator.platforms.some((p) => p.toLowerCase().includes(q))
      );
    });
    list = sortProfilesWithFavoritesFirst(list, favData.favoriteCreatorIds);
    return list;
  }, [allCreators, query, nicheFilter, favoritesOnly, favData]);

  if (!ready) return null;

  const favoriteCount = favData.favoriteCreatorIds.length;

  const handleToggleFavorite = (creatorId: string) => {
    persist(toggleFavorite(favData, creatorId));
  };

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Creators</h1>
          <span className="workspace-subtitle">
            {creators.length} creators · {favoriteCount} favorites
          </span>
        </div>
      </header>

      <div className="app-content">
        <p className="workspace-hint" style={{ marginTop: 0, marginBottom: 16 }}>
          Browse creator stats and UGC performance before inviting. Favorited creators appear first in invite lists.
        </p>

        <div className="marketplace-toolbar">
          <input
            type="search"
            className="crm-search"
            placeholder="Search creators, niches, platforms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="crm-filter" value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)}>
            {niches.map((niche) => (
              <option key={niche} value={niche}>
                {niche === "all" ? "All niches" : niche}
              </option>
            ))}
          </select>
          <label className="brand-creator-fav-filter">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />
            Favorites only
          </label>
        </div>

        <div className="brand-creator-grid">
          {creators.length === 0 ? (
            <div className="app-panel">
              <p>No creators match your filters.</p>
            </div>
          ) : (
            creators.map((creator) => {
              const fav = isFavorite(favData, creator.id);
              return (
                <article key={creator.id} className={`brand-creator-card ${fav ? "brand-creator-card--fav" : ""}`}>
                  <div className="brand-creator-card-top">
                    {fav && <span className="crm-tag">Favorite</span>}
                    <button
                      type="button"
                      className={`brand-creator-fav-btn ${fav ? "brand-creator-fav-btn--active" : ""}`}
                      onClick={() => handleToggleFavorite(creator.id)}
                      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                      title={fav ? "Remove from favorites" : "Add to favorites"}
                    >
                      {fav ? "★" : "☆"}
                    </button>
                  </div>
                  <Link href={BRAND_CREATORS_ROUTES.creator(creator.id)} className="brand-creator-card-link">
                    <h2>{creator.name}</h2>
                    <p className="brand-creator-card-bio">{creator.bio}</p>
                    <div className="crm-tags">
                      {creator.niches.map((tag) => (
                        <span key={tag} className="crm-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="brand-creator-stats-row">
                      <div>
                        <strong>{formatCount(creator.stats.totalFollowers)}</strong>
                        <span>Followers</span>
                      </div>
                      <div>
                        <strong>{formatCount(creator.stats.avgViews)}</strong>
                        <span>Avg views</span>
                      </div>
                      <div>
                        <strong>{formatPercent(creator.stats.avgEngagementRate)}</strong>
                        <span>Engagement</span>
                      </div>
                    </div>
                    <p className="brand-creator-card-meta">
                      {creator.platforms.join(" · ")} · {creator.location} · {creator.ugcPosts.length} UGC posts
                    </p>
                  </Link>
                </article>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
