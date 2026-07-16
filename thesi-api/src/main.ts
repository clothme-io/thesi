import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  FallbackExceptionFilter,
  HttpExceptionFilter,
} from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Api-Key'],
    credentials: true,
  });

  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new FallbackExceptionFilter(), new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Thesi API')
    .setDescription('UGC business platform API for ClothME Creator Community')
    .setVersion('1.0.0')
    .addTag('thesi')
    .build();

  try {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('v1/api', app, document);
  } catch (err) {
    console.warn(
      `Swagger setup skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`Thesi API running on port ${port}`);
}

bootstrap();
