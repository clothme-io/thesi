import {ValidationPipe} from '@nestjs/common';
import {UpsertCampaignDto} from './campaign.dto';
describe('Campaign request boundary',()=>{
 const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
 const input={name:'Draft',campaignType:'experience',status:'draft',payment:{model:'flat_rate'},postToMarketplace:false};
 const metadata={type:'body' as const,metatype:UpsertCampaignDto};
 it('accepts ordinary campaign requests without a server-managed product snapshot',async()=>{
  expect(await pipe.transform(input,metadata)).toMatchObject(input);
 });
 it('accepts optional audience and video direction with multiple selections',async()=>{
  const creativeDirection={
   audience:{ageRanges:['18-24','35-44'],genders:['women'],lifeStages:['parent','student'],workRoles:['office'],shopperStyles:['everyday','premium'],note:'Work outfits'},
   video:{styles:['talking_head','green_screen'],face:'on_camera',settings:['at_home'],length:'15_30s',mustInclude:['Show the fit'],avoid:[]},
  };
  const result=await pipe.transform({...input,creativeDirection},metadata);
  expect(result.creativeDirection).toEqual(creativeDirection);
 });
 it('rejects a client-supplied product snapshot',async()=>{
  await expect(pipe.transform({...input,payment:{...input.payment,promotedProduct:{productId:'forged'}}},metadata)).rejects.toThrow();
 });
});
