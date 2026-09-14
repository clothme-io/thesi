import {ValidationPipe} from '@nestjs/common';
import {UpsertCampaignDto} from './campaign.dto';
describe('Campaign request boundary',()=>{
 const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
 const input={name:'Draft',campaignType:'experience',status:'draft',payment:{model:'flat_rate'},postToMarketplace:false};
 const metadata={type:'body' as const,metatype:UpsertCampaignDto};
 it('accepts ordinary campaign requests without a server-managed product snapshot',async()=>{
  expect(await pipe.transform(input,metadata)).toMatchObject(input);
 });
 it('rejects a client-supplied product snapshot',async()=>{
  await expect(pipe.transform({...input,payment:{...input.payment,promotedProduct:{productId:'forged'}}},metadata)).rejects.toThrow();
 });
});
