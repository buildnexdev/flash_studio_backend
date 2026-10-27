import mysql from 'mysql2/promise';

async function main() {
    const conn = await mysql.createConnection('mysql://root:root@localhost:3306/photolab');
    const [cust] = await conn.query('SELECT customerID, name, phone, email, city FROM tblCustomer');
    console.log('Customers in DB:', cust);

    const [events] = await conn.query('SELECT eventID, customer_id, title, event_type, event_date FROM tblEvent');
    console.log('Events in DB:', events);

    const [galleries] = await conn.query('SELECT galleryID, event_id, title, status FROM tblGallery');
    console.log('Galleries in DB:', galleries);

    await conn.end();
}

main();
