USE healthcare_db;

-- 1. Patient profile with visit history
SELECT p.full_name, a.appt_date, d.full_name AS doctor, dep.dept_name, mh.diagnosis
FROM patient p
JOIN appointment a ON a.patient_id = p.patient_id
JOIN doctor d ON d.doctor_id = a.doctor_id
JOIN department dep ON dep.dept_id = d.dept_id
LEFT JOIN medical_history mh ON mh.appt_id = a.appt_id
WHERE p.patient_id = 1
ORDER BY a.appt_date DESC;

-- 2. A doctor's schedule for today
SELECT a.appt_time, p.full_name, a.reason, a.status
FROM appointment a JOIN patient p USING (patient_id)
WHERE a.doctor_id = 1 AND a.appt_date = CURRENT_DATE
ORDER BY a.appt_time;

-- 3. Unpaid or partial bills with balance due
SELECT p.full_name, b.bill_id, b.total_amount,
       b.total_amount - COALESCE(SUM(pay.amount),0) AS balance_due
FROM bill b
JOIN appointment a ON a.appt_id = b.appt_id
JOIN patient p ON p.patient_id = a.patient_id
LEFT JOIN payment pay ON pay.bill_id = b.bill_id
WHERE b.status <> 'Paid'
GROUP BY b.bill_id, p.full_name, b.total_amount;

-- 4. Doctors with above-average appointment count (subquery)
SELECT d.full_name, COUNT(*) AS appt_count
FROM appointment a JOIN doctor d USING (doctor_id)
GROUP BY d.doctor_id, d.full_name
HAVING COUNT(*) > (SELECT COUNT(*) / COUNT(DISTINCT doctor_id) FROM appointment);

-- 5. Rank doctors by revenue within each department (window function)
SELECT dep.dept_name, d.full_name, SUM(b.total_amount) AS revenue,
       RANK() OVER (PARTITION BY dep.dept_id ORDER BY SUM(b.total_amount) DESC) AS dept_rank
FROM bill b
JOIN appointment a ON a.appt_id = b.appt_id
JOIN doctor d ON d.doctor_id = a.doctor_id
JOIN department dep ON dep.dept_id = d.dept_id
GROUP BY dep.dept_id, dep.dept_name, d.doctor_id, d.full_name;

-- 6. Low stock medicines
SELECT med_name, stock_qty FROM medicine WHERE stock_qty < 50;

-- 7. Top diagnoses per department
SELECT dep.dept_name, mh.diagnosis, COUNT(*) AS cases
FROM medical_history mh
JOIN appointment a ON a.appt_id = mh.appt_id
JOIN doctor d ON d.doctor_id = a.doctor_id
JOIN department dep ON dep.dept_id = d.dept_id
GROUP BY dep.dept_name, mh.diagnosis
ORDER BY dep.dept_name, cases DESC;
