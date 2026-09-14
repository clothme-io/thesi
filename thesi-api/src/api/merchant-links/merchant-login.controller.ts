import { Body, CanActivate, Controller, ExecutionContext, Injectable, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IsBoolean, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import { type Request } from 'express';
import { MerchantAccessService } from 'src/shared/auth/merchant-access.service';
import { JwtAuthGuard, type AuthJwtPayload } from 'src/shared/auth/jwt-auth.guard';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import { MerchantLoginService } from './merchant-login.service';
class BeginDto {
 @Matches(/^[A-Za-z0-9_-]{43}$/) state!:string;
 @Matches(/^[A-Za-z0-9_-]{43}$/) challenge!:string;
}
class CodeDto {
 @Matches(/^[A-Za-z0-9_-]{43}$/) code!:string;
 @Matches(/^[A-Za-z0-9_-]{43}$/) verifier!:string;
}
class FinishDto extends CodeDto {
 @IsBoolean() consent!:boolean;
 @IsOptional() @IsUUID() workspaceId?:string;
 @IsOptional() @IsBoolean() replaceLocalAccess?:boolean;
}
class RevokeActorDto {
 @IsUUID() vendorId!:string;
 @IsUUID() actorId!:string;
 @IsIn(['owner','staff']) actorType!:string;
}
class AuthorizeDto {
 @IsUUID() requestId!:string;
 @IsUUID() vendorId!:string;
 @IsUUID() brandId!:string;
 @IsUUID() actorId!:string;
 @IsIn(['owner','staff']) actorType!:'owner'|'staff';
}
const ok=(data:unknown)=>({status:200,error:null,data});
@Injectable()
export class MerchantIdentityGuard implements CanActivate {
 constructor(private readonly config:ConfigService,private readonly access:MerchantAccessService){}
 canActivate(ctx:ExecutionContext){
  this.access.enabled();
  const expected=this.config.get<string>('MERCHANT_IDENTITY_SERVICE_KEY');
  const supplied=ctx.switchToHttp().getRequest().headers['x-thesi-identity-key'];
  if(typeof supplied!=='string'||!expected||expected.length<32||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))throw new UnauthorizedException('Invalid identity service credentials');
  return true;
 }
}
@Controller('internal/merchant-login')
@UseGuards(MerchantIdentityGuard)
export class MerchantLoginInternalController {
 constructor(private readonly login:MerchantLoginService){}
 @Post('revoke-actor') async revokeActor(@Body() input:RevokeActorDto){return ok(await this.login.revokeActor(input));}
 @Post('entry') entry(){return ok(this.login.entry());}
 @Post('authorize') async authorize(@Body() input:AuthorizeDto){return ok(await this.login.authorize(input.requestId,input));}
}
@Controller('merchant-login')
export class MerchantLoginController {
 constructor(private readonly login:MerchantLoginService,private readonly jwt:JwtService,private readonly access:MerchantAccessService){}
 @Post('begin') async begin(@Body() input:BeginDto){return ok(await this.login.begin(input.state,input.challenge));}
 @Post('inspect') async inspect(@Body() input:CodeDto){return ok(await this.login.inspect(input.code,input.verifier));}
 @Post('finish') async finish(@Body() input:FinishDto,@Req() req:Request){
  let userId:string|undefined;
  if(req.headers.authorization){
   const token=/^Bearer\s+(.+)$/i.exec(req.headers.authorization)?.[1];
   if(!token)throw new UnauthorizedException('Invalid account proof');
   let user:AuthJwtPayload;
   try{user=this.jwt.verify<AuthJwtPayload>(token);}catch{throw new UnauthorizedException('Sign in again to prove your Thesi account');}
   if(user.merchantSessionId)await this.access.session(user.sub,user.merchantSessionId);
   userId=user.sub;
  }
  return ok(await this.login.finish(input,userId));
 }
 @Post('logout') @UseGuards(JwtAuthGuard)
 async logout(@CurrentUser() user:AuthJwtPayload){if(user.merchantSessionId)await this.access.revoke(user.sub,user.merchantSessionId);return ok({revoked:true});}
}
