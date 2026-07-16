import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  FallbackExceptionFilter,
  HttpExceptionFilter,
} from './../src/shared/filters/http-exception.filter';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new FallbackExceptionFilter(), new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  it('POST /v1/auth/signin rejects unknown user', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/signin')
      .send({ email: 'missing@example.com', password: 'password123' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
