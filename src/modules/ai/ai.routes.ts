import { Router } from 'express';
import { config } from '../../config/env.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { getSetting } from '../settings/settings.service.js';

const router = Router();
router.use(authenticate, requirePermission('ai.use', 'settings.manage', 'photos.manage'));

/** What the AI module can do in this deployment (used by the admin UI to show/hide features). */
router.get(
    '/status',
    asyncHandler(async (_req, res) => {
        const ai = await getSetting('ai');
        ok(res, {
            faceProvider: config.AI_FACE_PROVIDER,
            faceSearchAvailable: config.AI_FACE_PROVIDER === 'rekognition',
            faceSearchEnabled: config.AI_FACE_PROVIDER === 'rekognition' && ai.faceSearch,
            cullingEnabled: config.AI_CULLING_ENABLED && ai.culling,
            blurThreshold: ai.blurThreshold,
            features: {
                blurDetection: config.AI_CULLING_ENABLED && ai.culling,
                duplicateDetection: config.AI_CULLING_ENABLED && ai.culling,
                closedEyeDetection: config.AI_FACE_PROVIDER === 'rekognition' && ai.faceSearch,
                autoCategories: config.AI_FACE_PROVIDER === 'rekognition' && ai.faceSearch,
                manualTags: true,
            },
        });
    }),
);

export default router;
