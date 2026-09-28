import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3030;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
