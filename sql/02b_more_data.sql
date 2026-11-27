USE healthcare_db;
-- Run AFTER 04_procedures_triggers.sql (uses generate_bill and triggers)

INSERT INTO patient (full_name, dob, gender, blood_group, phone) VALUES
('Kabir Joshi','2016-03-21','M','A+','9876500003');

INSERT INTO appointment (patient_id, doctor_id, appt_date, appt_time, status, reason) VALUES
(1,1,'2026-11-10','16:00','Completed','Follow-up'),
(2,2,'2026-11-20','11:30','Completed','Knee pain'),
(3,3,'2026-11-18','09:30','Completed','Fever'),
(1,1,CURDATE(),'10:00','Scheduled','Chest pain'),
(2,3,'2026-11-12','12:00','Cancelled','Checkup');

INSERT INTO medical_history (patient_id, appt_id, symptoms, diagnosis) VALUES
(1,1,'Headache, dizziness','Mild hypertension'),
(2,2,'Knee pain','Osteoarthritis (knee)'),
(3,3,'Fever, cough','Viral fever');

INSERT INTO test_order (appt_id, test_id) VALUES (1,1), (2,2), (3,3);

INSERT INTO prescription (appt_id) VALUES (1), (3);
INSERT INTO prescription_item (presc_id, med_id, dosage, frequency, duration_days, quantity) VALUES
(1,1,'75mg','Once daily',30,30),
(1,2,'10mg','Night',30,30);

CALL generate_bill(1);
CALL generate_bill(2);
CALL generate_bill(3);

INSERT INTO payment (bill_id, amount, method) VALUES (2, 200, 'UPI');
