// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

const generateCode = () => 'FLASH-' + Math.random().toString(36).substring(2, 8).toUpperCase();

export async function getCustomerReferralCode(customerId: number) {
    let customer = await queryOne<{ referral_code: string | null }>('SELECT referral_code FROM tblCustomer WHERE id = ?', [customerId]);
    if (!customer) throw notFound('Customer');

    if (!customer.referral_code) {
        const code = generateCode();
        await execute('UPDATE tblCustomer SET referral_code = ? WHERE id = ?', [code, customerId]);
        customer.referral_code = code;
    }

    const referrals = await query(
        `SELECT r.*, c.name AS referred_name, c.email AS referred_email 
         FROM tblReferral r 
         JOIN tblCustomer c ON c.id = r.referred_customer_id 
         WHERE r.referrer_customer_id = ? ORDER BY r.id DESC`,
        [customerId]
    );

    const rewards = await query('SELECT * FROM tblReward WHERE customer_id = ? ORDER BY id DESC', [customerId]);
    const totalEarned = rewards.reduce((acc, rw) => acc + (rw.amount_value as number || 0), 0);

    return {
        referralCode: customer.referral_code,
        referrals,
        rewards,
        totalEarned,
    };
}

export async function processReferralCode(codeRaw: string, newCustomerId: number, ctx: AuditContext) {
    const code = codeRaw.trim().toUpperCase();
    const referrer = await queryOne<{ id: number; name: string }>('SELECT id, name FROM tblCustomer WHERE referral_code = ?', [code]);
    if (!referrer) throw badRequest('Invalid referral code.');
    if (referrer.id === newCustomerId) throw badRequest('You cannot use your own referral code.');

    const existing = await queryOne('SELECT id FROM tblReferral WHERE referred_customer_id = ?', [newCustomerId]);
    if (existing) throw badRequest('Referral code has already been applied for this account.');

    const rewardAmount = 50000; // ₹500 in paise
    const referralId = (
        await execute(
            'INSERT INTO tblReferral (referrer_customer_id, referred_customer_id, referral_code, reward_amount, status) VALUES (?, ?, ?, ?, ?)',
            [referrer.id, newCustomerId, code, rewardAmount, 'QUALIFIED']
        )
    ).insertId;

    // Grant bonus reward to referrer
    await execute(
        'INSERT INTO tblReward (customer_id, title, description, points, reward_type, amount_value, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [referrer.id, 'Referral Bonus', `Bonus for referring new client`, 500, 'REFERRAL_BONUS', rewardAmount, 'EARNED']
    );

    await audit(ctx, 'REFERRAL_QUALIFIED', 'customer', referralId, { referrerId: referrer.id, newCustomerId });
    return { success: true, rewardAmount };
}

export async function listAllReferrals() {
    return query(
        `SELECT r.*, ref.name AS referrer_name, ref.email AS referrer_email, 
                refe.name AS referred_name, refe.email AS referred_email 
         FROM tblReferral r 
         JOIN tblCustomer ref ON ref.id = r.referrer_customer_id 
         JOIN tblCustomer refe ON refe.id = r.referred_customer_id 
         ORDER BY r.id DESC`
    );
}
