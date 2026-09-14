import { Optional } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { MerchantAccessService } from 'src/shared/auth/merchant-access.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { PasswordService } from 'src/shared/auth/password.service';
import { generateRefreshToken, hashToken } from 'src/shared/auth/token.util';
import { NovuService } from 'src/shared/novu/novu.service';
import {
  AuthSessionDto,
  AuthUserDto,
  ChangePasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
} from './dto/auth.dto';
import { OnboardingAnswersDto } from './dto/onboarding.dto';

type UserRow = typeof schema.thesiUser.$inferSelect;
type DbExecutor = Pick<
  NodePgDatabase<typeof schema>,
  'insert' | 'select' | 'update'
>;

export type OnboardingStep =
  'change-password' | 'welcome' | 'questions' | 'complete';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly novu: NovuService,
    @Optional() private readonly merchantAccess?: MerchantAccessService,
  ) {}

  async signUp(dto: SignUpDto): Promise<AuthSessionDto> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const userId = uuidv4();

    const [user] = await this.db
      .insert(schema.thesiUser)
      .values({
        id: userId,
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        companyName: dto.companyName?.trim() || null,
        role: 'brand',
        mustChangePassword: false,
        onboardingCompleted: false,
        onboardingStep: 'welcome',
      })
      .returning();

    await this.novu
      .trigger({
        type: 'brand_welcome',
        toEmail: user.email,
        subscriberId: user.id,
        firstName: this.firstName(user.fullName),
      })
      .catch((err: { message?: string }) =>
        this.logger.warn(`Failed to send brand welcome email: ${err?.message}`),
      );

    return this.createSession(user);
  }

  async signIn(dto: SignInDto): Promise<AuthSessionDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);
    if (!user || user.passwordHash.startsWith('$external$')) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthSessionDto> {
    const tokenHash = hashToken(dto.refreshToken);
    const [stored] = await this.db
      .select()
      .from(schema.thesiRefreshToken)
      .where(eq(schema.thesiRefreshToken.tokenHash, tokenHash))
      .limit(1);

    if (
      !stored ||
      stored.revokedAt ||
      !stored.expiresAt ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const [user] = await this.db
      .select()
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, stored.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let merchantSessionId: string | undefined;
    if (dto.refreshToken.startsWith('mh.')) {
      const row = (await this.db.execute(sql`SELECT session_id FROM thesi.merchant_session_refresh WHERE token_id=${stored.id}`)).rows[0];
      if (!row || !this.merchantAccess) throw new UnauthorizedException('Merchant refresh unavailable');
      merchantSessionId = String(row.session_id);
      await this.merchantAccess.session(user.id, merchantSessionId);
    }
    const claimed = await this.db.update(schema.thesiRefreshToken).set({revokedAt:new Date()})
      .where(and(eq(schema.thesiRefreshToken.id,stored.id),isNull(schema.thesiRefreshToken.revokedAt))).returning({id:schema.thesiRefreshToken.id});
    if (!claimed.length) throw new UnauthorizedException('Refresh token already used');
    return this.createSession(user,merchantSessionId);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    merchantSessionId?: string,
  ): Promise<AuthSessionDto> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const [user] = await this.db
      .select()
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if(user.passwordHash.startsWith('$external$'))throw new ForbiddenException('Manage this account password in Merchant Hub');
    const valid = await this.passwordService.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      throw new ForbiddenException('Current password is incorrect');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);
    const [updated] = await this.db
      .update(schema.thesiUser)
      .set({
        passwordHash,
        mustChangePassword: false,
        onboardingStep: user.onboardingCompleted ? 'complete' : 'welcome',
        updatedAt: new Date(),
      })
      .where(eq(schema.thesiUser.id, userId))
      .returning();

    return this.createSession(updated, merchantSessionId);
  }

  async requestPasswordReset(emailRaw: string): Promise<void> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.findUserByEmail(email);
    if (!user || user.passwordHash.startsWith('$external$')) {
      return;
    }

    const rawToken = generateRefreshToken();
    const expiresAt = this.addDuration(new Date(), '1h');

    await this.db
      .update(schema.thesiPasswordResetToken)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.thesiPasswordResetToken.userId, user.id),
          isNull(schema.thesiPasswordResetToken.usedAt),
        ),
      );

    await this.db.insert(schema.thesiPasswordResetToken).values({
      id: uuidv4(),
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    const webUrl = this.configService
      .getOrThrow<string>('THESI_WEB_URL')
      .replace(/\/+$/, '');
    const resetUrl = `${webUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(`Password reset URL (dev): ${resetUrl}`);
    }

    await this.novu
      .trigger({
        type: 'password_reset',
        toEmail: user.email,
        subscriberId: user.id,
        firstName: this.firstName(user.fullName),
        resetUrl,
      })
      .catch((err: { message?: string }) =>
        this.logger.warn(
          `Failed to send password reset email: ${err?.message}`,
        ),
      );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const tokenHash = hashToken(dto.token.trim());
    const [stored] = await this.db
      .select()
      .from(schema.thesiPasswordResetToken)
      .where(
        and(
          eq(schema.thesiPasswordResetToken.tokenHash, tokenHash),
          isNull(schema.thesiPasswordResetToken.usedAt),
        ),
      )
      .limit(1);

    if (!stored || !stored.expiresAt || stored.expiresAt < new Date()) {
      throw new BadRequestException(
        'This reset link is invalid or has expired',
      );
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.thesiUser)
        .set({
          passwordHash,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.thesiUser.id, stored.userId));

      await tx
        .update(schema.thesiPasswordResetToken)
        .set({ usedAt: new Date() })
        .where(eq(schema.thesiPasswordResetToken.id, stored.id));

      await tx
        .update(schema.thesiRefreshToken)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.thesiRefreshToken.userId, stored.userId),
            isNull(schema.thesiRefreshToken.revokedAt),
          ),
        );
    });
  }

  async completeWelcome(userId: string, merchantSessionId?: string): Promise<AuthSessionDto> {
    const [updated] = await this.db
      .update(schema.thesiUser)
      .set({
        onboardingStep: 'questions',
        updatedAt: new Date(),
      })
      .where(eq(schema.thesiUser.id, userId))
      .returning();

    if (!updated) {
      throw new UnauthorizedException('User not found');
    }

    return this.createSession(updated, merchantSessionId);
  }

  async submitOnboarding(
    userId: string,
    dto: OnboardingAnswersDto,
    merchantSessionId?: string,
  ): Promise<AuthSessionDto> {
    const [user] = await this.db
      .select()
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.db
      .insert(schema.thesiOnboardingAnswers)
      .values({
        userId,
        contentType: dto.contentType ?? null,
        monthlyProjects: dto.monthlyProjects ?? null,
        preferredPayment: dto.preferredPayment ?? null,
        biggestChallenge: dto.biggestChallenge ?? null,
        hearAbout: dto.hearAbout ?? null,
        companySize: dto.companySize ?? null,
        monthlyCampaigns: dto.monthlyCampaigns ?? null,
        primaryGoal: dto.primaryGoal ?? null,
        budgetRange: dto.budgetRange ?? null,
      })
      .onConflictDoUpdate({
        target: schema.thesiOnboardingAnswers.userId,
        set: {
          contentType: dto.contentType ?? null,
          monthlyProjects: dto.monthlyProjects ?? null,
          preferredPayment: dto.preferredPayment ?? null,
          biggestChallenge: dto.biggestChallenge ?? null,
          hearAbout: dto.hearAbout ?? null,
          companySize: dto.companySize ?? null,
          monthlyCampaigns: dto.monthlyCampaigns ?? null,
          primaryGoal: dto.primaryGoal ?? null,
          budgetRange: dto.budgetRange ?? null,
          updatedAt: new Date(),
        },
      });

    const [updated] = await this.db
      .update(schema.thesiUser)
      .set({
        onboardingCompleted: true,
        onboardingStep: 'complete',
        updatedAt: new Date(),
      })
      .where(eq(schema.thesiUser.id, userId))
      .returning();

    return this.createSession(updated, merchantSessionId);
  }

  async createUserFromApplication(
    input: {
      email: string;
      fullName: string;
      creatorApplicationId: string;
      tempPassword: string;
    },
    db: DbExecutor = this.db,
  ): Promise<UserRow> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.findUserByEmail(email, db);
    if (existing) {
      throw new ConflictException(
        'A user account already exists for this email',
      );
    }

    const passwordHash = await this.passwordService.hash(input.tempPassword);
    const forcePasswordChange = this.isForcePasswordChangeEnabled();
    const [user] = await db
      .insert(schema.thesiUser)
      .values({
        id: uuidv4(),
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        role: 'creator',
        mustChangePassword: forcePasswordChange,
        onboardingCompleted: !forcePasswordChange,
        onboardingStep: forcePasswordChange ? 'change-password' : 'complete',
        creatorApplicationId: input.creatorApplicationId,
      })
      .returning();

    return user;
  }

  async resetCreatorTemporaryPassword(
    creatorApplicationId: string,
    tempPassword: string,
  ): Promise<UserRow> {
    const passwordHash = await this.passwordService.hash(tempPassword);
    const forcePasswordChange = this.isForcePasswordChangeEnabled();
    const [user] = await this.db
      .update(schema.thesiUser)
      .set({
        passwordHash,
        mustChangePassword: forcePasswordChange,
        onboardingCompleted: !forcePasswordChange,
        onboardingStep: forcePasswordChange ? 'change-password' : 'complete',
        updatedAt: new Date(),
      })
      .where(eq(schema.thesiUser.creatorApplicationId, creatorApplicationId))
      .returning();

    if (!user) {
      throw new ConflictException(
        'No creator account exists for this application',
      );
    }

    return user;
  }

  async createSession(user: UserRow, merchantSessionId?: string): Promise<AuthSessionDto> {
    if (merchantSessionId) {
      if (!this.merchantAccess) throw new UnauthorizedException('Merchant session verification unavailable');
      await this.merchantAccess.session(user.id,merchantSessionId);
    }
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(merchantSessionId ? {merchantSessionId} : {}),
    });

    const refreshToken = `${merchantSessionId ? 'mh.' : ''}${generateRefreshToken()}`;
    const refreshExpiration =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    const expiresAt = this.addDuration(new Date(), refreshExpiration);

    await this.db.transaction(async tx => {
      const tokenId=uuidv4();
      await tx.insert(schema.thesiRefreshToken).values({id:tokenId,userId:user.id,tokenHash:hashToken(refreshToken),expiresAt});
      if (merchantSessionId) await tx.execute(sql`INSERT INTO thesi.merchant_session_refresh(token_id,session_id) VALUES(${tokenId},${merchantSessionId}::uuid)`);
    });

    return {
      accessToken,
      refreshToken,
      user: this.mapUser(user,!!merchantSessionId),
    };
  }

  private mapUser(user: UserRow, merchantSession = false): AuthUserDto {
    const forcePasswordChange = this.isForcePasswordChangeEnabled();
    if (!forcePasswordChange && !merchantSession) {
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName ?? undefined,
        role: user.role,
        mustChangePassword: false,
        onboardingCompleted: true,
        onboardingStep: 'complete',
      };
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName ?? undefined,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: this.resolveOnboardingStep(user),
    };
  }

  private isForcePasswordChangeEnabled(): boolean {
    const value = this.configService.get<boolean | string>(
      'AUTH_FORCE_PASSWORD_CHANGE',
    );
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
      if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    }
    return true;
  }

  private firstName(fullName: string | null | undefined): string {
    return fullName?.trim().split(/\s+/)[0] || 'there';
  }

  private resolveOnboardingStep(user: UserRow): OnboardingStep {
    if (user.mustChangePassword) {
      return 'change-password';
    }
    if (user.onboardingCompleted) {
      return 'complete';
    }
    const step = user.onboardingStep as OnboardingStep;
    if (step === 'welcome' || step === 'questions') {
      return step;
    }
    return 'welcome';
  }

  private async findUserByEmail(
    email: string,
    db: DbExecutor = this.db,
  ): Promise<UserRow | undefined> {
    const [user] = await db
      .select()
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.email, email))
      .limit(1);
    return user;
  }

  private addDuration(from: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const result = new Date(from);

    switch (unit) {
      case 's':
        result.setSeconds(result.getSeconds() + amount);
        break;
      case 'm':
        result.setMinutes(result.getMinutes() + amount);
        break;
      case 'h':
        result.setHours(result.getHours() + amount);
        break;
      case 'd':
        result.setDate(result.getDate() + amount);
        break;
    }

    return result;
  }
}
