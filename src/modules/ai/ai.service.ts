// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import {
    CreateCollectionCommand,
    IndexFacesCommand,
    RekognitionClient,
    SearchFacesByImageCommand,
    type FaceRecord,
} from '@aws-sdk/client-rekognition';
import sharp from 'sharp';
import { config } from '../../config/env.js';
import { execute, json, query, queryOne } from '../../db/pool.js';
import { blurScore, dHash, hamming } from '../../lib/images.js';
import { badRequest } from '../../utils/errors.js';
import { getSetting } from '../settings/settings.service.js';

export type PhotoCategory = 'SINGLE' | 'COUPLE' | 'FAMILY' | 'GROUP' | 'OTHER';

export const categoryForFaces = (n: number): PhotoCategory => (n <= 0 ? 'OTHER' : n === 1 ? 'SINGLE' : n === 2 ? 'COUPLE' : n <= 6 ? 'FAMILY' : 'GROUP');

/* ---------------- Culling (always available, runs locally) ---------------- */

export async function analyseForCulling(photoId: number, eventId: number, image: Buffer): Promise<void> {
    const ai = await getSetting('ai');
    if (!config.AI_CULLING_ENABLED || !ai.culling) return;
    const [hash, sharpness] = await Promise.all([dHash(image), blurScore(image)]);
    const candidates = await query<{ photo_id: number; dhash: string }>(
        `SELECT m.photo_id, m.dhash FROM tblPhotoMetadata m JOIN tblPhoto p ON p.id = m.photo_id
          WHERE p.event_id = ? AND p.id <> ? AND p.deleted_at IS NULL AND m.dhash IS NOT NULL ORDER BY p.id DESC LIMIT 2000`,
        [eventId, photoId],
    );
    const dup = candidates.find((c) => hamming(c.dhash, hash) <= 5);
    await execute('UPDATE tblPhotoMetadata SET dhash = ?, blur_score = ?, is_blurry = ?, duplicate_of = ? WHERE photo_id = ?', [hash, sharpness, sharpness < ai.blurThreshold ? 1 : 0, dup?.photo_id ?? null, photoId]);
}

/* ---------------- Face recognition (optional, AWS Rekognition) ---------------- */

let rekognition: RekognitionClient | null = null;
const client = () =>
    (rekognition ??= new RekognitionClient({
        region: config.AWS_REGION,
        credentials: config.AWS_ACCESS_KEY ? { accessKeyId: config.AWS_ACCESS_KEY, secretAccessKey: config.AWS_SECRET_KEY } : undefined,
    }));

const collectionId = (eventId: number) => `photolab-event-${eventId}`;

export async function faceSearchEnabled(): Promise<boolean> {
    return config.AI_FACE_PROVIDER === 'rekognition' && (await getSetting('ai')).faceSearch;
}

/** Rekognition accepts images up to 5 MB; send a downscaled JPEG. */
const forRekognition = (image: Buffer) => sharp(image).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

async function ensureCollection(eventId: number) {
    try {
        await client().send(new CreateCollectionCommand({ CollectionId: collectionId(eventId) }));
    } catch (err) {
        if ((err as { name?: string }).name !== 'ResourceAlreadyExistsException') throw err;
    }
}

/** Index faces of a processed photo; fills faces_count, eyes_closed and an automatic category. */
export async function indexFaces(photoId: number, eventId: number, image: Buffer): Promise<void> {
    if (!(await faceSearchEnabled())) return;
    await ensureCollection(eventId);
    const out = await client().send(
        new IndexFacesCommand({
            CollectionId: collectionId(eventId),
            Image: { Bytes: await forRekognition(image) },
            ExternalImageId: `photo-${photoId}`,
            DetectionAttributes: ['ALL'],
            MaxFaces: 20,
            QualityFilter: 'AUTO',
        }),
    );
    const faces: FaceRecord[] = out.FaceRecords ?? [];
    for (const f of faces) {
        if (f.Face?.FaceId) await execute('INSERT INTO tblPhotoFace (photo_id, event_id, provider_face_id, confidence) VALUES (?, ?, ?, ?)', [photoId, eventId, f.Face.FaceId, f.Face.Confidence ?? null]);
    }
    const eyesClosed = faces.some((f) => f.FaceDetail?.EyesOpen && f.FaceDetail.EyesOpen.Value === false && (f.FaceDetail.EyesOpen.Confidence ?? 0) > 80);
    await execute('UPDATE tblPhotoMetadata SET faces_count = ?, eyes_closed = ?, category = COALESCE(category, ?) WHERE photo_id = ?', [faces.length, eyesClosed ? 1 : 0, categoryForFaces(faces.length), photoId]);
}

/** Find photos in an event that contain the person in the selfie. */
export async function searchBySelfie(eventId: number, selfie: Buffer): Promise<number[]> {
    if (!(await faceSearchEnabled())) throw badRequest('Face search is not enabled for this studio.');
    try {
        const out = await client().send(
            new SearchFacesByImageCommand({ CollectionId: collectionId(eventId), Image: { Bytes: await forRekognition(selfie) }, FaceMatchThreshold: 85, MaxFaces: 1000 }),
        );
        const faceIds = (out.FaceMatches ?? []).map((m) => m.Face?.FaceId).filter((id): id is string => !!id);
        if (!faceIds.length) return [];
        const rows = await query<{ photo_id: number }>('SELECT DISTINCT photo_id FROM tblPhotoFace WHERE event_id = ? AND provider_face_id IN (?)', [eventId, faceIds]);
        return rows.map((r) => r.photo_id);
    } catch (err) {
        const name = (err as { name?: string }).name;
        if (name === 'InvalidParameterException') throw badRequest('No face was found in the selfie. Try a clear, front-facing photo.');
        if (name === 'ResourceNotFoundException') return [];
        throw err;
    }
}

/* ---------------- Tags & categories (manual, always available) ---------------- */

export async function setTags(photoIds: number[], tags: string[], category: PhotoCategory | null | undefined) {
    const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
    for (const id of photoIds) {
        await execute(
            `INSERT INTO tblPhotoMetadata (photo_id, tags, category) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE tags = VALUES(tags), category = ${category === undefined ? 'category' : 'VALUES(category)'}`,
            [id, json(clean), category ?? null],
        );
    }
}

/** Culling summary for the admin photo screen. */
export async function cullingSummary(eventId: number) {
    return queryOne(
        `SELECT COUNT(*) AS analysed, SUM(m.is_blurry = 1) AS blurry, SUM(m.duplicate_of IS NOT NULL) AS duplicates, SUM(m.eyes_closed = 1) AS eyes_closed,
                SUM(m.category = 'COUPLE') AS couple, SUM(m.category = 'FAMILY') AS family, SUM(m.category = 'GROUP') AS \`group\`, SUM(m.category = 'SINGLE') AS single
           FROM tblPhotoMetadata m JOIN tblPhoto p ON p.id = m.photo_id WHERE p.event_id = ? AND p.deleted_at IS NULL`,
        [eventId],
    );
}
