export function clothmeStoreLinks(env:Record<string,string|undefined>) {
  function validate(value:string|undefined,platform:'ios'|'android') {
    if(!value)return undefined;
    try {
      const url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return undefined;
      if(platform==='ios'&&url.hostname==='apps.apple.com'&&/^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id\d+$/.test(url.pathname))return url.href;
      if(platform==='android'&&url.hostname==='play.google.com'&&url.pathname==='/store/apps/details'&&url.searchParams.get('id')==='io.patheos.clothme')return url.href;
    } catch { /* Hide unconfigured or invalid destinations. */ }
  }
  return {ios:validate(env.CLOTHME_IOS_STORE_URL,'ios'),android:validate(env.CLOTHME_ANDROID_STORE_URL,'android')};
}
