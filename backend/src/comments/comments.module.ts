import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dest = config.get('UPLOAD_DIR', '/app/uploads');
        mkdirSync(dest, { recursive: true });
        const maxMb = parseInt(config.get('UPLOAD_MAX_MB', '10'), 10);
        return {
          storage: diskStorage({
            destination: dest,
            filename: (_req, file, cb) => cb(null, randomUUID() + extname(file.originalname).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '')),
          }),
          limits: { fileSize: maxMb * 1024 * 1024, files: 10 },
          fileFilter: (_req: any, _file: any, cb: any) => cb(null, true),
        };
      },
    }),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
