// Airbridge long-link format and destination parameters:
// https://help.airbridge.io/en/guides/creating-tracking-links-on-the-editing-tools
export function creatorInstallLink(code:string,env:Record<string,string|undefined>):string|undefined {
  if(env.CLOTHME_DEFERRED_LINKS_ENABLED!=='true'||!/^[A-Za-z0-9_-]{43}$/.test(code))return;
  const app=env.CLOTHME_AIRBRIDGE_APP_NAME;const channel=env.CLOTHME_AIRBRIDGE_CHANNEL;
  if(!app||!channel||!/^[a-z0-9_-]{1,80}$/.test(app)||!/^[A-Za-z0-9_.-]{1,80}$/.test(channel))return;
  const url=new URL(`https://abr.ge/@${app}/${channel}`);
  url.searchParams.set('deeplink_url',`clothme://creator-campaign/${code}`);
  url.searchParams.set('fallback_android','google-play');
  url.searchParams.set('fallback_ios','itunes-appstore');
  url.searchParams.set('fallback_desktop',`https://get-thesi.com/r/${code}`);
  return url.href;
}
