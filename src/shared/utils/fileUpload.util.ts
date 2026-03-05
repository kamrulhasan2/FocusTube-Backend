import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { StatusCodes } from 'http-status-toolkit';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { configEnv } from '../../config';
import AppError from '../errors/AppError';

interface IUploadOptions {
  folderName: string;
}

interface IUploadBufferToB2Options {
  folderName: string;
  file: Express.Multer.File;
}

interface IReplaceFileOptions {
  oldFileUrl?: string | null;
  newFile: Express.Multer.File;
  folderName: string;
  defaultFileUrls?: string[];
}

const MAX_UPLOAD_SIZE_IN_BYTES = 10 * 1024 * 1024;

const b2Client = new S3Client({
  endpoint: configEnv.b2_endpoint || undefined,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials:
    configEnv.b2_access_key && configEnv.b2_secret_key
      ? {
          accessKeyId: configEnv.b2_access_key,
          secretAccessKey: configEnv.b2_secret_key,
        }
      : undefined,
});

const hasB2Config = () =>
  Boolean(
    configEnv.b2_endpoint &&
    configEnv.b2_access_key &&
    configEnv.b2_secret_key &&
    configEnv.b2_bucket_name,
  );

const assertB2Config = () => {
  if (!hasB2Config()) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'File storage configuration is missing.');
  }
};

const sanitizeFolderName = (folderName: string) => {
  const sanitizedFolder = folderName
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');

  return sanitizedFolder || 'uploads';
};

const sanitizeOriginalFileName = (fileName: string) => {
  const baseName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  return baseName.length ? baseName : `upload${extname(fileName) || ''}`;
};

const createObjectKey = (folderName: string, originalFileName: string) =>
  `${sanitizeFolderName(folderName)}/${Date.now()}-${sanitizeOriginalFileName(originalFileName)}`;

const buildPublicFileUrl = (objectKey: string) => {
  assertB2Config();
  const endpointUrl = new URL(configEnv.b2_endpoint);

  return `${endpointUrl.protocol}//${configEnv.b2_bucket_name}.${endpointUrl.host}/${objectKey}`;
};

const extractObjectKeyFromFileUrl = (fileUrl: string) => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(fileUrl);
  } catch (_error) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid file URL.');
  }

  let objectKey = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, '');
  if (!objectKey) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid file URL.');
  }

  const bucketPrefix = `${configEnv.b2_bucket_name}/`;
  if (configEnv.b2_bucket_name && objectKey.startsWith(bucketPrefix)) {
    objectKey = objectKey.slice(bucketPrefix.length);
  }

  return objectKey;
};

const isDefaultFileUrl = (fileUrl: string, defaultFileUrls: string[] = []) => {
  const normalizedDefaultUrls = defaultFileUrls.map(url => url.trim()).filter(Boolean);
  return normalizedDefaultUrls.includes(fileUrl.trim());
};

const upload = (folderName: IUploadOptions['folderName']) => {
  if (!hasB2Config()) {
    return multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_SIZE_IN_BYTES },
      fileFilter: (_req, _file, callback) => {
        callback(
          new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'File storage configuration is missing.'),
        );
      },
    });
  }

  const storage = multerS3({
    s3: b2Client,
    bucket: configEnv.b2_bucket_name,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, callback) => {
      const safeFolderName = sanitizeFolderName(folderName);
      const key = createObjectKey(safeFolderName, file.originalname);
      callback(null, key);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_SIZE_IN_BYTES },
  });
};

const uploadBufferToB2 = async ({
  folderName,
  file,
}: IUploadBufferToB2Options): Promise<string> => {
  assertB2Config();

  if (!file.buffer) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid file buffer for storage upload.');
  }

  const objectKey = createObjectKey(folderName, file.originalname || randomUUID());

  try {
    await b2Client.send(
      new PutObjectCommand({
        Bucket: configEnv.b2_bucket_name,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
  } catch (_error) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to upload file to storage.');
  }

  return buildPublicFileUrl(objectKey);
};

const deleteFileFromB2 = async (fileUrl: string): Promise<void> => {
  assertB2Config();

  const trimmedFileUrl = fileUrl.trim();
  if (!trimmedFileUrl) {
    return;
  }

  const key = extractObjectKeyFromFileUrl(trimmedFileUrl);

  try {
    await b2Client.send(
      new DeleteObjectCommand({
        Bucket: configEnv.b2_bucket_name,
        Key: key,
      }),
    );
  } catch (_error) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to delete file from storage');
  }
};

const replaceFile = async ({
  oldFileUrl,
  newFile,
  folderName,
  defaultFileUrls = [],
}: IReplaceFileOptions): Promise<string> => {
  if (oldFileUrl && !isDefaultFileUrl(oldFileUrl, defaultFileUrls)) {
    await deleteFileFromB2(oldFileUrl);
  }

  return uploadBufferToB2({ folderName, file: newFile });
};

export { upload, deleteFileFromB2, replaceFile };
export type { IUploadOptions, IReplaceFileOptions };
