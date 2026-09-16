import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { CreatorTrackingLink } from './CreatorTrackingLink';
import { ContinueToClothme } from '@/app/r/[code]/ContinueToClothme';
const request=vi.fn();
vi.mock('@/context/AuthProvider',()=>({useAuth:()=>({authenticatedRequest:request})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();request.mockReset();});
describe('creator links',()=>{
 it('requires a deliberate creator action before issuing a link',async()=>{
  request.mockResolvedValue({url:'https://thesi.test/r/'+ 'a'.repeat(43)});
  render(<CreatorTrackingLink campaignId="campaign"/>);expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Get my creator link'}));
  await screen.findByLabelText('Personal product link');
  expect(request).toHaveBeenCalledWith('/api/creator-tracking/links',{method:'POST',body:{campaignId:'campaign'}});
 });
 it('labels and requests the selected product link',async()=>{
  request.mockResolvedValue({url:'https://thesi.test/r/'+ 'c'.repeat(43)});
  render(<CreatorTrackingLink campaignId="campaign" productId="shirt" productTitle="Linen shirt"/>);
  fireEvent.click(screen.getByRole('button',{name:'Get my creator link'}));
  expect(await screen.findByLabelText('Commission link for Linen shirt')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/api/creator-tracking/links',{method:'POST',body:{campaignId:'campaign',productId:'shirt'}});
 });
 it('does not generate shopper clicks on page load',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({data:{deepLink:'clothme://creator-link/'+ 'b'.repeat(43)}})} as Response);
  render(<ContinueToClothme code={'a'.repeat(43)}/>);expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Prepare my app link'}));
  expect(await screen.findByRole('link',{name:'Open ClothME'})).toHaveAttribute('href','clothme://creator-link/'+ 'b'.repeat(43));
  expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({code:'a'.repeat(43)});
 });
 it('refuses arbitrary deep-link destinations',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({data:{deepLink:'javascript:alert(1)'}})} as Response);
  render(<ContinueToClothme code={'a'.repeat(43)}/>);fireEvent.click(screen.getByRole('button',{name:'Prepare my app link'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Could not open ClothME'));expect(screen.queryByRole('link')).not.toBeInTheDocument();
 });
});
