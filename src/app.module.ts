import { Module } from '@nestjs/common';
import { IngestionModule } from './domain/ingestion/ingestion.module';
import { ChatModule } from './domain/chat/chat.module';

@Module({
  imports: [IngestionModule, ChatModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
