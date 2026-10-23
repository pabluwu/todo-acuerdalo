import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const maxMb = parseInt(config.get('UPLOAD_MAX_MB', '10'), 10);
        return {
          storage: memoryStorage(),
          limits: { fileSize: maxMb * 1024 * 1024, files: 10 },
          fileFilter: (_req: any, _file: any, cb: any) => cb(null, true),
        };
      },
    }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
