// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { query, queryOne } from '../../db/pool.js';
import { eachDay, localDateSql, resolveRange, type RangeQuery, type ResolvedRange } from '../../utils/dates.js';

const PAID = "('SUCCESS','REFUNDED')";
const num = (v: unknown) => Number(v ?? 0);

/** Zero-fill a per-day series so charts always have one point per day. */
type SeriesPoint = { day: string } & Record<string, number | string>;

function series<T extends { day: string }>(range: ResolvedRange, rows: T[], fields: (keyof T & string)[]): SeriesPoint[] {
    const byDay = new Map(rows.map((r) => [String(r.day).slice(0, 10), r]));
    return eachDay(range.from, range.to).map((day) => {
        const r = byDay.get(day);
        return { day, ...Object.fromEntries(fields.map((f) => [f, num(r?.[f])])) };
    });
}

/* ---------------- Dashboard ---------------- */

export async function dashboard(q: RangeQuery, companyId?: number | null) {
    const range = resolveRange(q);
    const today = resolveRange({ range: 'today' });
    const b = [range.startUtc, range.endUtc];

    const cFilter = companyId ? 'AND company_id = ?' : '';
    const cParams = companyId ? [companyId] : [];

    const [money, todayMoney, pending, counts, photoSales, downloads, pendingOrders] = await Promise.all([
        queryOne(`SELECT COALESCE(SUM(amount - refunded_amount), 0) AS total, COALESCE(SUM(CASE WHEN paid_at >= ? AND paid_at < ? THEN amount - refunded_amount END), 0) AS in_range FROM tblPayment WHERE status IN ${PAID} ${cFilter}`, companyId ? [...b, companyId] : b),
        queryOne(`SELECT COALESCE(SUM(amount - refunded_amount), 0) AS total, COUNT(*) AS n FROM tblPayment WHERE status IN ${PAID} AND paid_at >= ? AND paid_at < ? ${cFilter}`, companyId ? [today.startUtc, today.endUtc, companyId] : [today.startUtc, today.endUtc]),
        queryOne(
            `SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS bookings_due, COUNT(*) AS n FROM tblBooking
              WHERE deleted_at IS NULL AND status IN ('ADVANCE_PENDING','CONFIRMED','IN_PROGRESS','DELIVERED') AND total_amount > paid_amount ${cFilter}`,
            cParams,
        ),
        queryOne(
            `SELECT (SELECT COUNT(*) FROM tblBooking WHERE deleted_at IS NULL ${cFilter}) AS total_bookings,
                    (SELECT COUNT(*) FROM tblBooking WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${cFilter}) AS bookings_in_range,
                    (SELECT COUNT(*) FROM tblBooking WHERE deleted_at IS NULL AND status = 'ENQUIRY' ${cFilter}) AS new_enquiries,
                    (SELECT COUNT(*) FROM tblEvent WHERE deleted_at IS NULL AND status = 'UPCOMING' AND event_date >= ? ${cFilter}) AS upcoming_events,
                    (SELECT COUNT(*) FROM tblEvent WHERE deleted_at IS NULL AND status IN ('LIVE','UPLOADING','PROCESSING') ${cFilter}) AS active_events,
                    (SELECT COUNT(*) FROM tblCustomer WHERE deleted_at IS NULL ${cFilter}) AS total_customers,
                    (SELECT COUNT(*) FROM tblCustomer WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${cFilter}) AS new_customers`,
            [...cParams, ...b, ...cParams, ...cParams, today.from, ...cParams, ...cParams, ...cParams, ...b, ...cParams],
        ),
        queryOne(
            `SELECT COUNT(oi.id) AS photos, COALESCE(SUM(oi.total), 0) AS amount FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id
              WHERE oi.item_type = 'PHOTO_DOWNLOAD' AND o.status IN ('PAID','PROCESSING','READY','DELIVERED','COMPLETED') AND o.paid_at >= ? AND o.paid_at < ? ${companyId ? 'AND o.company_id = ?' : ''}`,
            companyId ? [...b, companyId] : b,
        ),
        queryOne(`SELECT COUNT(*) AS n, COUNT(DISTINCT photo_id) AS photos FROM tblDownload WHERE created_at >= ? AND created_at < ? ${cFilter}`, companyId ? [...b, companyId] : b),
        queryOne(`SELECT COUNT(*) AS n, COALESCE(SUM(status = 'CREATED'), 0) AS unpaid FROM tblOrder WHERE deleted_at IS NULL AND status IN ('CREATED','PAID','PROCESSING','READY') ${cFilter}`, cParams),
    ]);

    const [revenueRows, bookingRows, paymentStatus, viewRows, downloadRows, eventPerf, recentBookings, recentPayments, upcoming] = await Promise.all([
        query<{ day: string; revenue: number; payments: number }>(
            `SELECT ${localDateSql('paid_at')} AS day, SUM(amount - refunded_amount) AS revenue, COUNT(*) AS payments FROM tblPayment WHERE status IN ${PAID} AND paid_at >= ? AND paid_at < ? ${cFilter} GROUP BY day`,
            companyId ? [...b, companyId] : b,
        ),
        query<{ day: string; bookings: number }>(`SELECT ${localDateSql('created_at')} AS day, COUNT(*) AS bookings FROM tblBooking WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${cFilter} GROUP BY day`, companyId ? [...b, companyId] : b),
        query(`SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM tblPayment WHERE created_at >= ? AND created_at < ? ${cFilter} GROUP BY status`, companyId ? [...b, companyId] : b),
        query<{ day: string; views: number }>(`SELECT ${localDateSql('v.created_at')} AS day, COUNT(*) AS views FROM tblPhotoView v JOIN tblEvent e ON e.id = v.event_id WHERE v.created_at >= ? AND v.created_at < ? ${companyId ? 'AND e.company_id = ?' : ''} GROUP BY day`, companyId ? [...b, companyId] : b),
        query<{ day: string; downloads: number }>(`SELECT ${localDateSql('created_at')} AS day, COUNT(*) AS downloads FROM tblDownload WHERE created_at >= ? AND created_at < ? ${cFilter} GROUP BY day`, companyId ? [...b, companyId] : b),
        eventPerformanceRows(range, 8, companyId),
        query(
            `SELECT b.id, b.booking_no, b.event_type, b.event_date, b.status, b.total_amount, c.name AS customer_name, b.created_at
               FROM tblBooking b JOIN tblCustomer c ON c.id = b.customer_id WHERE b.deleted_at IS NULL ${companyId ? 'AND b.company_id = ?' : ''} ORDER BY b.id DESC LIMIT 6`,
            cParams,
        ),
        query(
            `SELECT p.id, p.payment_no, p.purpose, p.amount, p.status, p.paid_at, p.created_at, c.name AS customer_name
               FROM tblPayment p JOIN tblCustomer c ON c.id = p.customer_id ${companyId ? 'WHERE p.company_id = ?' : ''} ORDER BY p.id DESC LIMIT 6`,
            cParams,
        ),
        query(
            `SELECT e.id, e.event_code, e.title, e.event_type, e.event_date, e.start_time, e.venue, e.status, c.name AS customer_name,
                    (SELECT COUNT(*) FROM tblEventStaff es WHERE es.event_id = e.id) AS staff_count
               FROM tblEvent e JOIN tblCustomer c ON c.id = e.customer_id WHERE e.deleted_at IS NULL AND e.event_date >= ? AND e.status IN ('UPCOMING','LIVE') ${companyId ? 'AND e.company_id = ?' : ''}
              ORDER BY e.event_date, e.start_time LIMIT 6`,
            companyId ? [today.from, companyId] : [today.from],
        ),
    ]);

    return {
        range,
        cards: {
            totalRevenue: num(money?.total),
            rangeRevenue: num(money?.in_range),
            todaysRevenue: num(todayMoney?.total),
            todaysPayments: num(todayMoney?.n),
            pendingPayments: num(pending?.bookings_due),
            pendingPaymentBookings: num(pending?.n),
            totalBookings: num(counts?.total_bookings),
            rangeBookings: num(counts?.bookings_in_range),
            newEnquiries: num(counts?.new_enquiries),
            upcomingEvents: num(counts?.upcoming_events),
            activeEvents: num(counts?.active_events),
            totalCustomers: num(counts?.total_customers),
            newCustomers: num(counts?.new_customers),
            photoSales: num(photoSales?.photos),
            photoSalesAmount: num(photoSales?.amount),
            paidDownloads: num(downloads?.n),
            pendingOrders: num(pendingOrders?.n),
            unpaidOrders: num(pendingOrders?.unpaid),
        },
        charts: {
            revenue: series(range, revenueRows, ['revenue', 'payments']),
            bookings: series(range, bookingRows, ['bookings']),
            payments: paymentStatus,
            photoViews: series(range, viewRows, ['views']),
            photoDownloads: series(range, downloadRows, ['downloads']),
            eventPerformance: eventPerf,
        },
        recent: { bookings: recentBookings, payments: recentPayments, upcomingEvents: upcoming },
    };
}

function eventPerformanceRows(range: ResolvedRange, limit: number, companyId?: number | null) {
    const where = ['e.deleted_at IS NULL', 'e.event_date BETWEEN ? AND ?'];
    const params: unknown[] = [range.from, range.to];
    if (companyId) {
        where.push('e.company_id = ?');
        params.push(companyId);
    }
    params.push(limit);
    return query(
        `SELECT e.id, e.event_code, e.title, e.event_date, e.status, c.name AS customer_name,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.event_id = e.id AND p.deleted_at IS NULL) AS photos,
                (SELECT COUNT(*) FROM tblPhotoView v WHERE v.event_id = e.id) AS views,
                (SELECT COUNT(DISTINCT COALESCE(v.session_id, v.user_id)) FROM tblPhotoView v WHERE v.event_id = e.id) AS visitors,
                (SELECT COUNT(*) FROM tblDownload d WHERE d.event_id = e.id) AS downloads,
                (SELECT COALESCE(SUM(oi.total), 0) FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id JOIN tblPhoto p ON p.id = oi.photo_id
                  WHERE p.event_id = e.id AND oi.item_type = 'PHOTO_DOWNLOAD' AND o.status IN ('PAID','PROCESSING','READY','DELIVERED','COMPLETED')) AS photo_revenue,
                (SELECT COALESCE(SUM(py.amount - py.refunded_amount), 0) FROM tblPayment py JOIN tblOrder o ON o.id = py.order_id WHERE o.event_id = e.id AND py.status IN ${PAID}) +
                (SELECT COALESCE(SUM(py.amount - py.refunded_amount), 0) FROM tblPayment py WHERE py.booking_id = e.booking_id AND e.booking_id IS NOT NULL AND py.status IN ${PAID}) AS revenue
           FROM tblEvent e JOIN tblCustomer c ON c.id = e.customer_id
          WHERE ${where.join(' AND ')}
          ORDER BY revenue DESC, views DESC LIMIT ?`,
        params,
    );
}

/* ---------------- Reports ---------------- */

export const REPORT_TYPES = ['revenue', 'bookings', 'payments', 'events', 'photo-sales', 'downloads', 'customers', 'staff', 'event-performance'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportResult {
    type: ReportType;
    title: string;
    range: ResolvedRange;
    summary: Record<string, number>;
    series?: Record<string, unknown>[];
    breakdown?: { label: string; rows: Record<string, unknown>[] }[];
    columns: { key: string; label: string; kind?: 'money' | 'date' | 'datetime' | 'number' }[];
    rows: Record<string, unknown>[];
}

export async function report(type: ReportType, q: RangeQuery, companyId?: number | null): Promise<ReportResult> {
    const range = resolveRange(q);
    const b = [range.startUtc, range.endUtc];
    const cFilter = companyId ? 'AND company_id = ?' : '';
    switch (type) {
        case 'revenue': {
            const [daily, byPurpose, byMethod, totals] = await Promise.all([
                query<{ day: string; revenue: number; refunds: number; payments: number }>(
                    `SELECT ${localDateSql('paid_at')} AS day, SUM(amount - refunded_amount) AS revenue, SUM(refunded_amount) AS refunds, COUNT(*) AS payments
                       FROM tblPayment WHERE status IN ${PAID} AND paid_at >= ? AND paid_at < ? ${cFilter} GROUP BY day ORDER BY day`,
                    companyId ? [...b, companyId] : b,
                ),
                query(`SELECT purpose AS label, COUNT(*) AS payments, SUM(amount - refunded_amount) AS amount FROM tblPayment WHERE status IN ${PAID} AND paid_at >= ? AND paid_at < ? ${cFilter} GROUP BY purpose ORDER BY amount DESC`, companyId ? [...b, companyId] : b),
                query(`SELECT COALESCE(method, provider) AS label, COUNT(*) AS payments, SUM(amount - refunded_amount) AS amount FROM tblPayment WHERE status IN ${PAID} AND paid_at >= ? AND paid_at < ? ${cFilter} GROUP BY label ORDER BY amount DESC`, companyId ? [...b, companyId] : b),
                queryOne(`SELECT COALESCE(SUM(amount - refunded_amount), 0) AS revenue, COALESCE(SUM(refunded_amount), 0) AS refunds, COUNT(*) AS payments FROM tblPayment WHERE status IN ${PAID} AND paid_at >= ? AND paid_at < ? ${cFilter}`, companyId ? [...b, companyId] : b),
            ]);
            const s = series(range, daily, ['revenue', 'refunds', 'payments']);
            return {
                type,
                title: 'Revenue report',
                range,
                summary: { revenue: num(totals?.revenue), refunds: num(totals?.refunds), payments: num(totals?.payments), averagePerDay: Math.round(num(totals?.revenue) / Math.max(1, s.length)) },
                series: s,
                breakdown: [
                    { label: 'By purpose', rows: byPurpose },
                    { label: 'By payment method', rows: byMethod },
                ],
                columns: [
                    { key: 'day', label: 'Date', kind: 'date' },
                    { key: 'payments', label: 'Payments', kind: 'number' },
                    { key: 'revenue', label: 'Revenue', kind: 'money' },
                    { key: 'refunds', label: 'Refunds', kind: 'money' },
                ],
                rows: s,
            };
        }
        case 'bookings': {
            const [rows, byStatus, byType, bySource] = await Promise.all([
                query(
                    `SELECT b.booking_no, c.name AS customer_name, c.phone AS customer_phone, b.event_type, b.event_date, b.status, b.source, b.total_amount, b.paid_amount,
                            (b.total_amount - b.paid_amount) AS balance, pk.name AS package_name, b.created_at
                       FROM tblBooking b JOIN tblCustomer c ON c.id = b.customer_id LEFT JOIN tblPackage pk ON pk.id = b.package_id
                      WHERE b.deleted_at IS NULL AND b.created_at >= ? AND b.created_at < ? ${companyId ? 'AND b.company_id = ?' : ''} ORDER BY b.created_at DESC`,
                    companyId ? [...b, companyId] : b,
                ),
                query(`SELECT status AS label, COUNT(*) AS count, SUM(total_amount) AS amount FROM tblBooking WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${companyId ? 'AND company_id = ?' : ''} GROUP BY status`, companyId ? [...b, companyId] : b),
                query(`SELECT event_type AS label, COUNT(*) AS count, SUM(total_amount) AS amount FROM tblBooking WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${companyId ? 'AND company_id = ?' : ''} GROUP BY event_type ORDER BY count DESC`, companyId ? [...b, companyId] : b),
                query(`SELECT source AS label, COUNT(*) AS count FROM tblBooking WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${companyId ? 'AND company_id = ?' : ''} GROUP BY source`, companyId ? [...b, companyId] : b),
            ]);
            const converted = rows.filter((r) => !['ENQUIRY', 'QUOTED', 'CANCELLED'].includes(String(r.status))).length;
            return {
                type,
                title: 'Bookings report',
                range,
                summary: {
                    bookings: rows.length,
                    confirmed: converted,
                    conversionPercent: rows.length ? Math.round((converted / rows.length) * 100) : 0,
                    bookedValue: rows.reduce((s, r) => s + num(r.total_amount), 0),
                    collected: rows.reduce((s, r) => s + num(r.paid_amount), 0),
                },
                breakdown: [
                    { label: 'By status', rows: byStatus },
                    { label: 'By event type', rows: byType },
                    { label: 'By source', rows: bySource },
                ],
                columns: [
                    { key: 'booking_no', label: 'Booking' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'event_type', label: 'Event type' },
                    { key: 'event_date', label: 'Event date', kind: 'date' },
                    { key: 'package_name', label: 'Package' },
                    { key: 'status', label: 'Status' },
                    { key: 'total_amount', label: 'Total', kind: 'money' },
                    { key: 'paid_amount', label: 'Paid', kind: 'money' },
                    { key: 'balance', label: 'Balance', kind: 'money' },
                    { key: 'created_at', label: 'Created', kind: 'datetime' },
                ],
                rows,
            };
        }
        case 'payments': {
            const rows = await query(
                `SELECT p.payment_no, c.name AS customer_name, p.purpose, p.amount, p.refunded_amount, p.status, p.provider, p.method, p.provider_payment_id,
                        COALESCE(b.booking_no, o.order_no) AS reference, p.failure_reason, p.paid_at, p.created_at
                   FROM tblPayment p JOIN tblCustomer c ON c.id = p.customer_id LEFT JOIN tblBooking b ON b.id = p.booking_id LEFT JOIN tblOrder o ON o.id = p.order_id
                  WHERE p.created_at >= ? AND p.created_at < ? ${companyId ? 'AND p.company_id = ?' : ''} ORDER BY p.id DESC`,
                companyId ? [...b, companyId] : b,
            );
            const sum = (st: string[]) => rows.filter((r) => st.includes(String(r.status))).reduce((s, r) => s + num(r.amount) - num(r.refunded_amount), 0);
            const byStatus = await query(`SELECT status AS label, COUNT(*) AS count, SUM(amount) AS amount FROM tblPayment WHERE created_at >= ? AND created_at < ? ${companyId ? 'AND company_id = ?' : ''} GROUP BY status`, companyId ? [...b, companyId] : b);
            return {
                type,
                title: 'Payments report',
                range,
                summary: {
                    payments: rows.length,
                    successful: rows.filter((r) => r.status === 'SUCCESS').length,
                    failed: rows.filter((r) => r.status === 'FAILED').length,
                    collected: sum(['SUCCESS', 'REFUNDED']),
                    pending: rows.filter((r) => ['PENDING', 'PROCESSING'].includes(String(r.status))).reduce((s, r) => s + num(r.amount), 0),
                    refunded: rows.reduce((s, r) => s + num(r.refunded_amount), 0),
                },
                breakdown: [{ label: 'By status', rows: byStatus }],
                columns: [
                    { key: 'payment_no', label: 'Payment' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'reference', label: 'Booking / order' },
                    { key: 'purpose', label: 'Purpose' },
                    { key: 'amount', label: 'Amount', kind: 'money' },
                    { key: 'refunded_amount', label: 'Refunded', kind: 'money' },
                    { key: 'status', label: 'Status' },
                    { key: 'method', label: 'Method' },
                    { key: 'provider_payment_id', label: 'Gateway ref' },
                    { key: 'paid_at', label: 'Paid at', kind: 'datetime' },
                ],
                rows,
            };
        }
        case 'events':
        case 'event-performance': {
            const rows = await eventPerformanceRows(range, 1000, companyId);
            return {
                type,
                title: type === 'events' ? 'Events report' : 'Event performance',
                range,
                summary: {
                    events: rows.length,
                    photos: rows.reduce((s, r) => s + num(r.photos), 0),
                    views: rows.reduce((s, r) => s + num(r.views), 0),
                    downloads: rows.reduce((s, r) => s + num(r.downloads), 0),
                    revenue: rows.reduce((s, r) => s + num(r.revenue), 0),
                },
                columns: [
                    { key: 'event_code', label: 'Event' },
                    { key: 'title', label: 'Title' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'event_date', label: 'Date', kind: 'date' },
                    { key: 'status', label: 'Status' },
                    { key: 'photos', label: 'Photos', kind: 'number' },
                    { key: 'visitors', label: 'Visitors', kind: 'number' },
                    { key: 'views', label: 'Views', kind: 'number' },
                    { key: 'downloads', label: 'Downloads', kind: 'number' },
                    { key: 'photo_revenue', label: 'Photo sales', kind: 'money' },
                    { key: 'revenue', label: 'Total revenue', kind: 'money' },
                ],
                rows,
            };
        }
        case 'photo-sales': {
            const [rows, daily, top] = await Promise.all([
                query(
                    `SELECT e.event_code, e.title AS event_title, COUNT(oi.id) AS photos_sold, COUNT(DISTINCT o.customer_id) AS buyers, SUM(oi.total) AS amount
                       FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id JOIN tblPhoto p ON p.id = oi.photo_id JOIN tblEvent e ON e.id = p.event_id
                      WHERE oi.item_type = 'PHOTO_DOWNLOAD' AND o.status IN ('PAID','PROCESSING','READY','DELIVERED','COMPLETED') AND o.paid_at >= ? AND o.paid_at < ? ${companyId ? 'AND o.company_id = ?' : ''}
                      GROUP BY e.id ORDER BY amount DESC`,
                    companyId ? [...b, companyId] : b,
                ),
                query<{ day: string; photos: number; amount: number }>(
                    `SELECT ${localDateSql('o.paid_at')} AS day, COUNT(oi.id) AS photos, SUM(oi.total) AS amount FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id
                      WHERE oi.item_type = 'PHOTO_DOWNLOAD' AND o.status IN ('PAID','PROCESSING','READY','DELIVERED','COMPLETED') AND o.paid_at >= ? AND o.paid_at < ? ${companyId ? 'AND o.company_id = ?' : ''} GROUP BY day`,
                    companyId ? [...b, companyId] : b,
                ),
                query(
                    `SELECT p.id AS photo_id, p.file_name AS label, e.title AS event_title, COUNT(*) AS sold FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id JOIN tblPhoto p ON p.id = oi.photo_id JOIN tblEvent e ON e.id = p.event_id
                      WHERE oi.item_type = 'PHOTO_DOWNLOAD' AND o.status IN ('PAID','PROCESSING','READY','DELIVERED','COMPLETED') AND o.paid_at >= ? AND o.paid_at < ? ${companyId ? 'AND o.company_id = ?' : ''}
                      GROUP BY p.id ORDER BY sold DESC LIMIT 10`,
                    companyId ? [...b, companyId] : b,
                ),
            ]);
            return {
                type,
                title: 'Photo sales report',
                range,
                summary: { photosSold: rows.reduce((s, r) => s + num(r.photos_sold), 0), amount: rows.reduce((s, r) => s + num(r.amount), 0), events: rows.length },
                series: series(range, daily, ['photos', 'amount']),
                breakdown: [{ label: 'Best-selling photos', rows: top }],
                columns: [
                    { key: 'event_code', label: 'Event' },
                    { key: 'event_title', label: 'Title' },
                    { key: 'photos_sold', label: 'Photos sold', kind: 'number' },
                    { key: 'buyers', label: 'Buyers', kind: 'number' },
                    { key: 'amount', label: 'Amount', kind: 'money' },
                ],
                rows,
            };
        }
        case 'downloads': {
            const [daily, rows] = await Promise.all([
                query<{ day: string; downloads: number }>(`SELECT ${localDateSql('created_at')} AS day, COUNT(*) AS downloads FROM tblDownload WHERE created_at >= ? AND created_at < ? ${companyId ? 'AND company_id = ?' : ''} GROUP BY day`, companyId ? [...b, companyId] : b),
                query(
                    `SELECT e.event_code, e.title AS event_title, COUNT(d.id) AS downloads, COUNT(DISTINCT d.photo_id) AS photos, COUNT(DISTINCT d.user_id) AS users,
                            SUM(d.variant = 'EDITED') AS edited_downloads
                       FROM tblDownload d JOIN tblEvent e ON e.id = d.event_id WHERE d.created_at >= ? AND d.created_at < ? ${companyId ? 'AND d.company_id = ?' : ''} GROUP BY e.id ORDER BY downloads DESC`,
                    companyId ? [...b, companyId] : b,
                ),
            ]);
            return {
                type,
                title: 'Downloads report',
                range,
                summary: { downloads: rows.reduce((s, r) => s + num(r.downloads), 0), photos: rows.reduce((s, r) => s + num(r.photos), 0), events: rows.length },
                series: series(range, daily, ['downloads']),
                columns: [
                    { key: 'event_code', label: 'Event' },
                    { key: 'event_title', label: 'Title' },
                    { key: 'downloads', label: 'Downloads', kind: 'number' },
                    { key: 'photos', label: 'Unique photos', kind: 'number' },
                    { key: 'users', label: 'Users', kind: 'number' },
                    { key: 'edited_downloads', label: 'Edited files', kind: 'number' },
                ],
                rows,
            };
        }
        case 'customers': {
            const [daily, rows, bySource] = await Promise.all([
                query<{ day: string; customers: number }>(`SELECT ${localDateSql('created_at')} AS day, COUNT(*) AS customers FROM tblCustomer WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${companyId ? 'AND company_id = ?' : ''} GROUP BY day`, companyId ? [...b, companyId] : b),
                query(
                    `SELECT c.name, c.phone, c.email, c.city, c.source, c.created_at,
                            (SELECT COUNT(*) FROM tblBooking bk WHERE bk.customer_id = c.id AND bk.deleted_at IS NULL) AS bookings,
                            (SELECT COUNT(*) FROM tblOrder o WHERE o.customer_id = c.id AND o.status NOT IN ('CREATED','CANCELLED')) AS orders,
                            (SELECT COALESCE(SUM(p.amount - p.refunded_amount), 0) FROM tblPayment p WHERE p.customer_id = c.id AND p.status IN ${PAID} AND p.paid_at >= ? AND p.paid_at < ?) AS spend
                       FROM tblCustomer c WHERE c.deleted_at IS NULL ${companyId ? 'AND c.company_id = ?' : ''}
                     HAVING spend > 0 OR (c.created_at >= ? AND c.created_at < ?)
                      ORDER BY spend DESC, c.created_at DESC LIMIT 1000`,
                    companyId ? [...b, companyId, ...b] : [...b, ...b],
                ),
                query(`SELECT source AS label, COUNT(*) AS count FROM tblCustomer WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${companyId ? 'AND company_id = ?' : ''} GROUP BY source`, companyId ? [...b, companyId] : b),
            ]);
            const s = series(range, daily, ['customers']);
            return {
                type,
                title: 'Customers report',
                range,
                summary: { newCustomers: s.reduce((t, r) => t + num(r.customers), 0), payingCustomers: rows.filter((r) => num(r.spend) > 0).length, spend: rows.reduce((t, r) => t + num(r.spend), 0) },
                series: s,
                breakdown: [{ label: 'New customers by source', rows: bySource }],
                columns: [
                    { key: 'name', label: 'Customer' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'email', label: 'Email' },
                    { key: 'city', label: 'City' },
                    { key: 'source', label: 'Source' },
                    { key: 'bookings', label: 'Bookings', kind: 'number' },
                    { key: 'orders', label: 'Orders', kind: 'number' },
                    { key: 'spend', label: 'Spend (range)', kind: 'money' },
                    { key: 'created_at', label: 'Joined', kind: 'datetime' },
                ],
                rows,
            };
        }
        case 'staff': {
            const rows = await query(
                `SELECT u.id, u.name, GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS roles,
                        (SELECT COUNT(DISTINCT es.event_id) FROM tblEventStaff es JOIN tblEvent e ON e.id = es.event_id WHERE es.user_id = u.id AND e.event_date BETWEEN ? AND ?) AS events,
                        (SELECT COUNT(*) FROM tblPhoto p WHERE p.uploaded_by = u.id AND p.created_at >= ? AND p.created_at < ?) AS uploads,
                        (SELECT COUNT(*) FROM tblPhoto p WHERE p.editor_id = u.id AND p.status IN ('EDITED','APPROVED','DELIVERED') AND p.updated_at >= ? AND p.updated_at < ?) AS edits,
                        (SELECT COUNT(*) FROM tblPhoto p WHERE p.editor_id = u.id AND p.status = 'EDITING') AS editing_backlog,
                        (SELECT COUNT(*) FROM tblPrintOrder po WHERE po.assigned_to = u.id AND po.status = 'READY' AND po.completed_at >= ? AND po.completed_at < ?) AS prints,
                        (SELECT COUNT(*) FROM tblDeliveryOrder d WHERE d.assigned_to = u.id AND d.status = 'DELIVERED' AND d.delivered_at >= ? AND d.delivered_at < ?) AS deliveries
                   FROM tblUser u JOIN tblUserRole ur ON ur.user_id = u.id JOIN tblRole r ON r.id = ur.role_id
                  WHERE u.deleted_at IS NULL AND r.code IN ('PHOTOGRAPHER','EDITOR_DESIGNER','PRINTER_DELIVERY_STAFF','MANAGER') ${companyId ? 'AND u.company_id = ?' : ''}
                  GROUP BY u.id ORDER BY u.name`,
                companyId ? [range.from, range.to, ...b, ...b, ...b, ...b, companyId] : [range.from, range.to, ...b, ...b, ...b, ...b],
            );
            return {
                type,
                title: 'Staff performance',
                range,
                summary: {
                    staff: rows.length,
                    uploads: rows.reduce((s, r) => s + num(r.uploads), 0),
                    edits: rows.reduce((s, r) => s + num(r.edits), 0),
                    prints: rows.reduce((s, r) => s + num(r.prints), 0),
                    deliveries: rows.reduce((s, r) => s + num(r.deliveries), 0),
                },
                columns: [
                    { key: 'name', label: 'Staff' },
                    { key: 'roles', label: 'Roles' },
                    { key: 'events', label: 'Events', kind: 'number' },
                    { key: 'uploads', label: 'Photos uploaded', kind: 'number' },
                    { key: 'edits', label: 'Photos edited', kind: 'number' },
                    { key: 'editing_backlog', label: 'Editing backlog', kind: 'number' },
                    { key: 'prints', label: 'Print jobs', kind: 'number' },
                    { key: 'deliveries', label: 'Deliveries', kind: 'number' },
                ],
                rows,
            };
        }
    }
}

const csvCell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    // Neutralise spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(r: ReportResult): string {
    const header = r.columns.map((c) => csvCell(c.kind === 'money' ? `${c.label} (INR)` : c.label)).join(',');
    const lines = r.rows.map((row) => r.columns.map((c) => csvCell(c.kind === 'money' ? (num(row[c.key]) / 100).toFixed(2) : row[c.key])).join(','));
    return [header, ...lines].join('\r\n');
}
