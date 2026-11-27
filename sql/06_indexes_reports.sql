USE healthcare_db;

CREATE INDEX idx_appt_doctor_date ON appointment (doctor_id, appt_date, appt_time);
CREATE INDEX idx_appt_patient ON appointment (patient_id, appt_date);
CREATE INDEX idx_history_patient ON medical_history (patient_id, recorded_on);
CREATE INDEX idx_payment_bill ON payment (bill_id);
CREATE INDEX idx_patient_name ON patient (full_name);
CREATE INDEX idx_patient_phone ON patient (phone);

CREATE VIEW v_dept_appointment_report AS
SELECT dep.dept_name,
       COUNT(a.appt_id) AS total_appts,
       COALESCE(SUM(a.status = 'Completed'),0) AS completed,
       COALESCE(SUM(a.status = 'Cancelled'),0) AS cancelled,
       COALESCE(SUM(a.status = 'No-Show'),0) AS no_shows
FROM department dep
LEFT JOIN doctor d ON d.dept_id = dep.dept_id
LEFT JOIN appointment a ON a.doctor_id = d.doctor_id
GROUP BY dep.dept_id, dep.dept_name;

CREATE VIEW v_dept_revenue_monthly AS
SELECT dep.dept_name,
       DATE_FORMAT(b.bill_date,'%Y-%m') AS month,
       SUM(b.total_amount) AS billed,
       SUM(CASE WHEN b.status='Paid' THEN b.total_amount ELSE 0 END) AS collected
FROM bill b
JOIN appointment a ON a.appt_id = b.appt_id
JOIN doctor d ON d.doctor_id = a.doctor_id
JOIN department dep ON dep.dept_id = d.dept_id
GROUP BY dep.dept_name, month;
