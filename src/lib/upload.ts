import multer from 'multer';
import { config } from '../config/env.js';
import { ACCEPTED_MIME } from './images.js';
import { badRequest } from '../utils/errors.js';

const imageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    // First line of defence only; the bytes are decoded and validated again by sharp.
    const ok = ACCEPTED_MIME.includes(file.mimetype) || /\.(jpe?g|png|webp|heic|heif|tiff?)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(badRequest(`"${file.originalname}" is not a supported image (JPEG, PNG, WebP, HEIC, TIFF).`) as unknown as Error);
};

/** In-memory upload (files are validated, processed and streamed to private storage). */
export const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 50 },
    fileFilter: imageFilter,
});

export const proofUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 80 },
    fileFilter: imageFilter,
});
