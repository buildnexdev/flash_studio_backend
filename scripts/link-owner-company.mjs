import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/photolab';
const conn = await mysql.createConnection(url);

const [companies] = await conn.query(
  'SELECT companyID, name, slug, owner_email, email, logo_url FROM tblCompany LIMIT 20',
);
console.log('companies', companies);

const [owners] = await conn.query(
  "SELECT userID, name, email, phone, company_id FROM tblUser WHERE email IN ('owner@photolab.test','admin@photolab.test') OR phone IN ('9000000002','9000000001')",
);
console.log('users', owners);

const primary = companies.find((c) => c.is_primary) || companies[0];
if (primary) {
  const owner = owners.find((u) => u.email === 'owner@photolab.test' || u.phone === '9000000002');
  if (owner) {
    await conn.query('UPDATE tblUser SET company_id = ? WHERE userID = ?', [primary.companyID, owner.userID]);
    await conn.query(
      'UPDATE tblUserRole SET company_id = ? WHERE user_id = ? AND (company_id IS NULL OR company_id = 0)',
      [primary.companyID, owner.userID],
    );
    if (!primary.owner_email && owner.email) {
      await conn.query('UPDATE tblCompany SET owner_email = ?, email = COALESCE(email, ?) WHERE companyID = ?', [
        owner.email,
        owner.email,
        primary.companyID,
      ]);
    }
    console.log('linked owner', owner.userID, '-> company', primary.companyID, primary.name);
  }
}

await conn.end();
