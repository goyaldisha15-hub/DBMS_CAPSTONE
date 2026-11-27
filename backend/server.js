require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// wraps handlers: SIGNAL errors (45000) become 409 messages for the UI
const h = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e.sqlState === '45000') return res.status(409).json({ error: e.sqlMessage });
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This record already exists' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
const q = async (sql, args = []) => (await db.query(sql, args))[0];

app.get('/api/dashboard', h(async (req, res) => {
  const [counts] = await q(`
    SELECT (SELECT COUNT(*) FROM patient) AS patients,
           (SELECT COUNT(*) FROM appointment) AS appointments,
           (SELECT COUNT(*) FROM appointment WHERE appt_date = CURDATE()) AS today,
           (SELECT COALESCE(SUM(total_amount),0) FROM bill)
             - (SELECT COALESCE(SUM(amount),0) FROM payment) AS outstanding`);
  res.json({
    counts,
    apptReport: await q('SELECT * FROM v_dept_appointment_report'),
    revReport: await q('SELECT * FROM v_dept_revenue_monthly'),
    lowStock: await q('SELECT med_name, stock_qty FROM medicine WHERE stock_qty < 50'),
    statusCounts: await q('SELECT status, COUNT(*) AS n FROM appointment GROUP BY status'),
    todayAppts: await q(`SELECT a.appt_time, p.full_name AS patient, d.full_name AS doctor, a.reason, a.status
      FROM appointment a JOIN patient p ON p.patient_id = a.patient_id
      JOIN doctor d ON d.doctor_id = a.doctor_id WHERE a.appt_date = CURDATE() ORDER BY a.appt_time`),
    topDx: await q(`SELECT diagnosis, COUNT(*) AS cases FROM medical_history
      GROUP BY diagnosis ORDER BY cases DESC LIMIT 5`),
    recentPayments: await q(`SELECT p.full_name AS patient, py.amount, py.method, py.paid_on
      FROM payment py JOIN bill b ON b.bill_id = py.bill_id
      JOIN appointment a ON a.appt_id = b.appt_id JOIN patient p ON p.patient_id = a.patient_id
      ORDER BY py.paid_on DESC LIMIT 5`),
  });
}));

app.get('/api/patients', h(async (req, res) => {
  const s = `%${req.query.q || ''}%`;
  res.json(await q(`SELECT patient_id, full_name, dob, gender, blood_group, phone FROM patient
                    WHERE full_name LIKE ? OR phone LIKE ? ORDER BY full_name`, [s, s]));
}));

app.post('/api/patients', h(async (req, res) => {
  const { full_name, dob, gender, blood_group, phone } = req.body;
  if (!full_name || !dob || !gender || !phone)
    return res.status(400).json({ error: 'Name, date of birth, gender and phone are required' });
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Phone must be 10 digits' });
  await q('INSERT INTO patient (full_name, dob, gender, blood_group, phone) VALUES (?,?,?,?,?)',
    [full_name.trim(), dob, gender, blood_group || null, phone]);
  res.status(201).json({ message: 'Patient added' });
}));

app.get('/api/patients/:id/history', h(async (req, res) => {
  res.json(await q(`
    SELECT a.appt_date, d.full_name AS doctor, dep.dept_name, mh.diagnosis
    FROM appointment a
    JOIN doctor d ON d.doctor_id = a.doctor_id
    JOIN department dep ON dep.dept_id = d.dept_id
    LEFT JOIN medical_history mh ON mh.appt_id = a.appt_id
    WHERE a.patient_id = ? ORDER BY a.appt_date DESC`, [req.params.id]));
}));

app.get('/api/doctors', h(async (req, res) => {
  res.json(await q(`SELECT d.doctor_id, d.full_name, dep.dept_name FROM doctor d
                    JOIN department dep ON dep.dept_id = d.dept_id WHERE d.is_active`));
}));

app.get('/api/appointments', h(async (req, res) => {
  res.json(await q(`
    SELECT a.appt_id, a.appt_date, a.appt_time, p.full_name AS patient,
           d.full_name AS doctor, a.reason, a.status
    FROM appointment a
    JOIN patient p ON p.patient_id = a.patient_id
    JOIN doctor d ON d.doctor_id = a.doctor_id
    ORDER BY a.appt_date DESC, a.appt_time DESC`));
}));

// completed visits that have no bill yet
app.get('/api/appointments/unbilled', h(async (req, res) => {
  res.json(await q(`
    SELECT a.appt_id, p.full_name AS patient, a.appt_date
    FROM appointment a JOIN patient p ON p.patient_id = a.patient_id
    LEFT JOIN bill b ON b.appt_id = a.appt_id
    WHERE a.status = 'Completed' AND b.bill_id IS NULL ORDER BY a.appt_date DESC`));
}));

app.post('/api/appointments', h(async (req, res) => {
  const { patient_id, doctor_id, appt_date, appt_time, reason } = req.body;
  if (!patient_id || !doctor_id || !appt_date || !appt_time)
    return res.status(400).json({ error: 'Patient, doctor, date and time are required' });
  await q('CALL book_appointment(?,?,?,?,?)', [patient_id, doctor_id, appt_date, appt_time, reason || null]);
  res.status(201).json({ message: 'Appointment booked' });
}));

app.patch('/api/appointments/:id/status', h(async (req, res) => {
  const { status } = req.body;
  if (!['Scheduled', 'Completed', 'Cancelled', 'No-Show'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  await q('UPDATE appointment SET status = ? WHERE appt_id = ?', [status, req.params.id]);
  res.json({ message: 'Status updated' });
}));

app.get('/api/bills', h(async (req, res) => {
  res.json(await q(`
    SELECT b.bill_id, p.full_name AS patient, b.total_amount,
           COALESCE(SUM(py.amount),0) AS paid,
           b.total_amount - COALESCE(SUM(py.amount),0) AS balance, b.status
    FROM bill b
    JOIN appointment a ON a.appt_id = b.appt_id
    JOIN patient p ON p.patient_id = a.patient_id
    LEFT JOIN payment py ON py.bill_id = b.bill_id
    GROUP BY b.bill_id, p.full_name, b.total_amount, b.status ORDER BY b.bill_id DESC`));
}));

// calls the generate_bill stored procedure (all-or-nothing transaction)
app.post('/api/bills', h(async (req, res) => {
  if (!req.body.appt_id) return res.status(400).json({ error: 'Appointment is required' });
  await q('CALL generate_bill(?)', [req.body.appt_id]);
  res.status(201).json({ message: 'Bill generated' });
}));

// bill status is updated by the trg_payment_status trigger
app.post('/api/payments', h(async (req, res) => {
  const { bill_id, amount, method } = req.body;
  if (!bill_id || !(amount > 0) || !method)
    return res.status(400).json({ error: 'Bill, amount and method are required' });
  const [bill] = await q(`SELECT b.total_amount - COALESCE(SUM(p.amount),0) AS balance
    FROM bill b LEFT JOIN payment p ON p.bill_id = b.bill_id
    WHERE b.bill_id = ? GROUP BY b.bill_id, b.total_amount`, [bill_id]);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  if (amount > Number(bill.balance))
    return res.status(400).json({ error: `Amount is more than the balance (${bill.balance})` });
  await q('INSERT INTO payment (bill_id, amount, method) VALUES (?,?,?)', [bill_id, amount, method]);
  res.status(201).json({ message: 'Payment recorded' });
}));

app.get('/api/medicines', h(async (req, res) => {
  res.json(await q('SELECT med_id, med_name, unit_price, stock_qty FROM medicine ORDER BY med_name'));
}));

app.get('/api/tests', h(async (req, res) => {
  res.json(await q('SELECT test_id, test_name, price FROM diagnostic_test ORDER BY test_name'));
}));

// everything recorded for one visit (diagnosis, tests, medicines)
app.get('/api/visits/:id', h(async (req, res) => {
  const id = req.params.id;
  res.json({
    history: await q('SELECT diagnosis, symptoms FROM medical_history WHERE appt_id = ?', [id]),
    tests: await q(`SELECT t.test_name, o.status, t.price FROM test_order o
      JOIN diagnostic_test t ON t.test_id = o.test_id WHERE o.appt_id = ?`, [id]),
    meds: await q(`SELECT m.med_name, pi.dosage, pi.frequency, pi.quantity FROM prescription pr
      JOIN prescription_item pi ON pi.presc_id = pr.presc_id
      JOIN medicine m ON m.med_id = pi.med_id WHERE pr.appt_id = ?`, [id]),
  });
}));

app.post('/api/visits/:id/diagnosis', h(async (req, res) => {
  const { diagnosis, symptoms } = req.body;
  if (!diagnosis) return res.status(400).json({ error: 'Diagnosis is required' });
  await q(`INSERT INTO medical_history (patient_id, appt_id, symptoms, diagnosis)
           SELECT patient_id, appt_id, ?, ? FROM appointment WHERE appt_id = ?`,
    [symptoms || null, diagnosis, req.params.id]);
  res.status(201).json({ message: 'Diagnosis saved' });
}));

app.post('/api/visits/:id/test', h(async (req, res) => {
  if (!req.body.test_id) return res.status(400).json({ error: 'Choose a test' });
  await q('INSERT INTO test_order (appt_id, test_id) VALUES (?,?)', [req.params.id, req.body.test_id]);
  res.status(201).json({ message: 'Test ordered' });
}));

// stock is checked by trg_stock_check; insufficient stock comes back as an error
app.post('/api/visits/:id/prescribe', h(async (req, res) => {
  const { med_id, quantity, dosage, frequency, duration_days } = req.body;
  if (!med_id || !(quantity > 0)) return res.status(400).json({ error: 'Medicine and quantity are required' });
  let [p] = await q('SELECT presc_id FROM prescription WHERE appt_id = ?', [req.params.id]);
  if (!p) p = { presc_id: (await q('INSERT INTO prescription (appt_id) VALUES (?)', [req.params.id])).insertId };
  await q(`INSERT INTO prescription_item (presc_id, med_id, dosage, frequency, duration_days, quantity)
           VALUES (?,?,?,?,?,?)`, [p.presc_id, med_id, dosage || null, frequency || null, duration_days || null, quantity]);
  res.status(201).json({ message: 'Medicine prescribed' });
}));

const port = process.env.PORT || 5000;
app.listen(port, () => console.log('API running on port ' + port));
