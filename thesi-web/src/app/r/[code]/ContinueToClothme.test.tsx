import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { describe,it,expect,vi,afterEach } from 'vitest';
import { ContinueToClothme } from './ContinueToClothme';
const code='a'.repeat(43);
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('creator installation continuation',()=>{
  it('does not create a grant on render or offer unknown stores',()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    render(<ContinueToClothme code={code} durable />);
    expect(screen.getByRole('link',{name:'Open ClothME'})).toHaveAttribute('href',`clothme://creator-campaign/${code}`);
    expect(screen.getByText(/App download links are not available/)).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('copies the durable public link, never a short-lived grant',async()=>{
    const writeText=vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
    render(<ContinueToClothme code={code} durable />);
    fireEvent.click(screen.getByRole('button',{name:'Copy original creator link'}));
    expect(await screen.findByRole('status')).toHaveTextContent('Reopen it after installation');
    expect(writeText).toHaveBeenCalledWith(`https://get-thesi.com/r/${code}`);
  });
  it('preserves the old explicit handoff when the new mobile route is disabled',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{deepLink:`clothme://creator-link/${code}`}})}));
    render(<ContinueToClothme code={code} />);
    fireEvent.click(screen.getByRole('button',{name:'Prepare my app link'}));
    expect(await screen.findByRole('link',{name:'Open ClothME'})).toHaveAttribute('href',`clothme://creator-link/${code}`);
  });
});
