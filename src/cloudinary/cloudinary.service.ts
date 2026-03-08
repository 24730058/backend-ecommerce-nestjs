import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'uploads' }, (error, result) => {
          if (error) {
            return reject(
              new Error(error.message || 'Cloudinary upload failed'),
            );
          }
          if (!result)
            return reject(new Error('Cloudinary did not return upload result'));

          resolve(result);
        })
        .end(file.buffer);
    });
  }
}
