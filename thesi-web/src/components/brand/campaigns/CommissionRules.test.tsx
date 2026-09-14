import {useState} from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {CommissionPaymentBuilder} from './CommissionPaymentBuilder';
import {defaultHybridPaymentForm,buildCampaignPayment,hybridPaymentToForm} from '@/lib/brand-campaigns/payment-form';
import {DEFAULT_COMMISSION_RULES} from '@/lib/brand-campaigns/commission-rules';
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('shows configurable defaults and sends the explicit accepted rules',()=>{
 vi.stubEnv('NEXT_PUBLIC_COMMISSION_RULES_ENABLED','true');
 function Form(){const [value,setValue]=useState({...defaultHybridPaymentForm(),baseEnabled:false,affiliateEnabled:true,affiliatePercent:'10',affiliateTerms:'Qualifying sales'});return <><CommissionPaymentBuilder value={value} onChange={setValue}/><output data-testid="rules">{JSON.stringify(buildCampaignPayment({model:'commission',flatAmount:'',milestoneStructure:'cumulative',notes:'',milestones:[],hybrid:value}).hybrid?.affiliate?.rules)}</output></>;}
 render(<Form/>);
 expect(screen.getByLabelText('Sale review period (days)')).toHaveValue(30);
 fireEvent.change(screen.getByLabelText('Sale review period (days)'),{target:{value:'45'}});
 fireEvent.change(screen.getByLabelText('Payout eligibility schedule'),{target:{value:'weekly'}});
 expect(JSON.parse(screen.getByTestId('rules').textContent!)).toEqual({...DEFAULT_COMMISSION_RULES,reviewDays:45,payoutFrequency:'weekly'});
});
it('hydrates legacy agreements without injecting new rules',()=>{
 vi.stubEnv('NEXT_PUBLIC_COMMISSION_RULES_ENABLED','true');
 expect(hybridPaymentToForm({model:'commission',hybrid:{affiliate:{enabled:true,commissionType:'percentage_of_sale',currency:'USD'}}}).commissionRules).toBeUndefined();
});
