'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {useAuth} from './AuthProvider';
import {selectedWorkspace} from '@/lib/brand-workspace-storage';
import {usePathname} from 'next/navigation';
type Permissions={ready:boolean;canEdit:boolean;canManageFunds:boolean;merchantManaged:boolean};
const legacy:Permissions={ready:true,canEdit:true,canManageFunds:true,merchantManaged:false};
const Context=createContext<Permissions>(legacy);
export const useWorkspacePermissions=()=>useContext(Context);
export function WorkspaceRouteAccess({children}:{children:React.ReactNode}){
 const {ready,canEdit,canManageFunds}=useWorkspacePermissions();
 const pathname=usePathname();
 const financial=['/app/settings/billing','/app/settings/payment-methods','/app/settings/payment-history','/app/settings/integrations'].some(p=>pathname===p||pathname.startsWith(p+'/'));
 if(!ready)return <p className="app-content" role="status">Checking brand access…</p>;
 if((financial&&!canManageFunds)||(pathname==='/app/campaigns/new'&&!canEdit))return <p className="app-content">Your Merchant role does not allow this action. Ask your Merchant account owner to manage access.</p>;
 return <>{children}</>;
}
export function WorkspacePermissionsProvider({children}:{children:React.ReactNode}){
 const {session,authenticatedRequest}=useAuth();
 const enabled=session?.user.role==='brand'&&(process.env.NEXT_PUBLIC_BRAND_WORKSPACES_ENABLED==='true'||session.refreshToken.startsWith('mh.'));
 const [access,setAccess]=useState<Permissions|null>(null);
 useEffect(()=>{
  if(!enabled)return;
  let active=true;setAccess(null);
  authenticatedRequest<{id:string;role:string;isDefault:boolean}[]>('/api/brand-workspaces').then(rows=>{
   const selected=selectedWorkspace(session!.user.id);
   const row=rows.find(r=>selected?r.id===selected:r.isDefault)||(!selected&&rows.length===1?rows[0]:undefined);
   if(active)setAccess({ready:true,canEdit:row?.role==='owner'||row?.role==='member',canManageFunds:row?.role==='owner',merchantManaged:session!.refreshToken.startsWith('mh.')});
  }).catch(()=>{if(active)setAccess({ready:true,canEdit:false,canManageFunds:false,merchantManaged:session!.refreshToken.startsWith('mh.')});});
  return()=>{active=false;};
 },[enabled,session?.user.id,session?.refreshToken,authenticatedRequest]);
 const value=enabled?(access??{ready:false,canEdit:false,canManageFunds:false,merchantManaged:!!session?.refreshToken.startsWith('mh.')}):legacy;
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
