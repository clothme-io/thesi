import { notFound } from 'next/navigation';
import { CreatorDemo } from './CreatorDemo';
export default function Page() {
  if(process.env.NODE_ENV==='production'||process.env.THESI_LOCAL_CREATOR_DEMO!=='true')notFound();
  return <CreatorDemo />;
}
