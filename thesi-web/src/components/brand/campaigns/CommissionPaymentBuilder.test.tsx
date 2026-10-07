import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CommissionPaymentBuilder } from './CommissionPaymentBuilder';
import { defaultHybridPaymentForm } from '@/lib/brand-campaigns/payment-form';
afterEach(cleanup);
it('hides sale basis options on install campaigns',()=>{
 const value={...defaultHybridPaymentForm(),affiliateType:'percentage_of_sale' as const};
 render(<CommissionPaymentBuilder variant="install" value={value} onChange={vi.fn()}/>);
 expect(screen.queryByRole('combobox',{name:'Creator earns when'})).toBeNull();
 expect(screen.getByText(/Opening the creator link only attributes the new user/i)).toBeTruthy();
 expect(screen.getByRole('checkbox',{name:'Verified account'})).toBeTruthy();
});
it('does not promise a prepaid install pool',()=>{
 const value={...defaultHybridPaymentForm(),affiliateType:'fixed_amount_per_install' as const,installEventAmounts:{verified_account:'1.00'}};
 render(<CommissionPaymentBuilder value={value} onChange={vi.fn()}/>);
 expect(screen.queryByRole('textbox',{name:'Payout per qualified install (USD)'})).toBeNull();
 expect(screen.getByRole('textbox',{name:'Earning (USD, optional)'})).toBeTruthy();
 expect(screen.queryByText(/funded campaign balance/i)).toBeNull();
 expect(screen.getByText(/does not collect a prepaid install pool/i)).toBeTruthy();
});
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
