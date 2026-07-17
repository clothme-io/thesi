import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { PasswordService } from 'src/shared/auth/password.service';
import { generateRefreshToken, hashToken } from 'src/shared/auth/token.util';
import {
  AuthSessionDto,
  AuthUserDto,
  ChangePasswordDto,
  RefreshTokenDto,
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
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    return this.createSession(user);
  }

  async signIn(dto: SignInDto): Promise<AuthSessionDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);
    if (!user) {
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

    await this.db
      .update(schema.thesiRefreshToken)
      .set({ revokedAt: new Date() })
      .where(eq(schema.thesiRefreshToken.id, stored.id));

    return this.createSession(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
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
        onboardingStep: 'welcome',
        updatedAt: new Date(),
      })
      .where(eq(schema.thesiUser.id, userId))
      .returning();

    return this.createSession(updated);
  }

  async completeWelcome(userId: string): Promise<AuthSessionDto> {
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

    return this.createSession(updated);
  }

  async submitOnboarding(
    userId: string,
    dto: OnboardingAnswersDto,
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

    return this.createSession(updated);
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
    const [user] = await db
      .insert(schema.thesiUser)
      .values({
        id: uuidv4(),
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        role: 'creator',
        mustChangePassword: true,
        onboardingCompleted: false,
        onboardingStep: 'change-password',
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
    const [user] = await this.db
      .update(schema.thesiUser)
      .set({
        passwordHash,
        mustChangePassword: true,
        onboardingCompleted: false,
        onboardingStep: 'change-password',
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

  private async createSession(user: UserRow): Promise<AuthSessionDto> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const refreshExpiration =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    const expiresAt = this.addDuration(new Date(), refreshExpiration);

    await this.db.insert(schema.thesiRefreshToken).values({
      id: uuidv4(),
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: this.mapUser(user),
    };
  }

  private mapUser(user: UserRow): AuthUserDto {
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
