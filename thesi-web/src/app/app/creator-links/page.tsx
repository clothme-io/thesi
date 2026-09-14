"use client";
import { useEffect,useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { CreatorTrackingLink } from '@/components/brand/campaigns/CreatorTrackingLink';
type Campaign = { campaignId:string;name:string;productTitle:string;productId:string };
export default function CreatorLinksPage() {
  const { session,authenticatedRequest } = useAuth(); const [rows,setRows] = useState<Campaign[]>([]);const [message,setMessage] = useState('Loading accepted campaigns…');
  useEffect(() => {
    if (session?.user.role !== 'creator') return;
    let active=true;
    authenticatedRequest<{enabled:boolean;campaigns:Campaign[]}>('/api/creator-tracking/links').then(data => { if(active){setRows(data.campaigns);setMessage(!data.enabled ? 'Creator links are not enabled yet.' : data.campaigns.length ? '' : 'Accept a product commission campaign to get your personal link.');}}).catch(e => {if(active)setMessage(e instanceof Error ? e.message : 'Could not load creator links');});
    return () => {active=false;};
  },[authenticatedRequest,session?.user.role]);
  if(session?.user.role !== 'creator') return <div className="app-content"><p>A creator account is required.</p></div>;
  return <div className="app-content"><h1>Creator links</h1>{message && <p role="status">{message}</p>}{rows.map(row => <article key={`${row.campaignId}:${row.productId}`}><h2>{row.name}</h2><p>{row.productTitle}</p><CreatorTrackingLink campaignId={row.campaignId} productId={row.productId} /></article>)}</div>;
}
