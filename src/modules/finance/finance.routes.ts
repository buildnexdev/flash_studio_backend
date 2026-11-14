// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 13-11-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { idParam, optionalText, ymd } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import {
    DEFAULT_FINANCE_CATEGORIES,
    deleteFinanceTransaction,
    getFinanceSummary,
    listFinanceTransactions,
    saveFinanceTransaction,
} from '../system/finance.service.js';

const router = Router();

router.use(authenticate);

// Get list of preset income and expense categories
router.get(
    '/categories',
    asyncHandler(async (_req, res) => {
        ok(res, DEFAULT_FINANCE_CATEGORIES);
    }),
);

// Get finance summary (Totals, Today's spend, Category & Payment method breakdowns)
router.get(
    '/summary',
    requirePermission('payments.view'),
    validate(
        z.object({
            startDate: ymd.optional(),
            endDate: ymd.optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
        const summary = await getFinanceSummary(startDate, endDate);
        ok(res, summary);
    }),
);

// List transactions with filters
router.get(
    '/transactions',
    requirePermission('payments.view'),
    validate(
        z.object({
            startDate: ymd.optional(),
            endDate: ymd.optional(),
            type: z.enum(['INCOME', 'EXPENSE']).optional(),
            category: optionalText,
            paymentMethod: optionalText,
            search: optionalText,
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        const items = await listFinanceTransactions(req.query as any);
        ok(res, items);
    }),
);

// Create or update a transaction
router.post(
    '/transactions',
    requirePermission('payments.manage'),
    validate(
        z.object({
            id: z.coerce.number().int().positive().optional(),
            type: z.enum(['INCOME', 'EXPENSE']),
            category: z.string().trim().min(1, 'Category is required').max(60),
            amount: z.coerce.number().int().positive('Amount must be greater than zero'),
            paymentMethod: z.string().trim().max(40).optional().default('CASH'),
            referenceNo: optionalText,
            description: z.string().trim().min(1, 'Description / note is required').max(1000),
            transactionDate: ymd,
            orderId: z.coerce.number().int().positive().optional().nullable(),
            eventId: z.coerce.number().int().positive().optional().nullable(),
            staffId: z.coerce.number().int().positive().optional().nullable(),
            assetId: z.coerce.number().int().positive().optional().nullable(),
        }),
    ),
    asyncHandler(async (req, res) => {
        const { id, ...data } = req.body;
        const result = await saveFinanceTransaction(id ?? null, data, auditCtx(req));
        if (id) {
            ok(res, result, 'Transaction updated');
        } else {
            created(res, result, 'Transaction logged');
        }
    }),
);

// Delete transaction
router.delete(
    '/transactions/:id',
    requirePermission('payments.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const result = await deleteFinanceTransaction(id, auditCtx(req));
        ok(res, result, 'Transaction deleted');
    }),
);

export const financeRouter = router;

