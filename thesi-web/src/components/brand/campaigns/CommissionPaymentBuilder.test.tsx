import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CommissionPaymentBuilder } from './CommissionPaymentBuilder';
import { defaultHybridPaymentForm } from '@/lib/brand-campaigns/payment-form';
afterEach(cleanup);
it('allows commission without showing base amount or milestone fields',()=>{
 const onChange=vi.fn(); const value={...defaultHybridPaymentForm(),baseEnabled:false};
 const {rerender}=render(<CommissionPaymentBuilder value={value} onChange={onChange}/>);
 expect(screen.queryByRole('textbox',{name:'Base payment per creator (USD)'})).toBeNull();
 expect(screen.getByRole('textbox',{name:'Commission rate (%)'})).toBeTruthy();
 fireEvent.click(screen.getByRole('checkbox',{name:'Include a fixed base payment (optional)'}));
 expect(onChange.mock.calls[0][0].baseEnabled).toBe(true);
 rerender(<CommissionPaymentBuilder value={{...value,baseEnabled:true}} onChange={onChange}/>);
 expect(screen.getByRole('textbox',{name:'Base payment per creator (USD)'})).toBeTruthy();
});
