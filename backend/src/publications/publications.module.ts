import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { PublicationsController } from './publications.controller';
import { PublicationsService } from './publications.service';
import { UPLOAD_TMP_DIR } from './upload-tmp';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const maxMb = parseInt(config.get('PUBLICATION_UPLOAD_MAX_MB', '500'), 10);
        return {
          // a disco: los videos no caben en memoria; el servicio borra el temporal al terminar
          storage: diskStorage({ destination: UPLOAD_TMP_DIR }),
          limits: { fileSize: maxMb * 1024 * 1024, files: 20 },
          fileFilter: (_req: any, _file: any, cb: any) => cb(null, true),
        };
      },
    }),
  ],
  controllers: [PublicationsController],
  providers: [PublicationsService],
})
export class PublicationsModule {}
