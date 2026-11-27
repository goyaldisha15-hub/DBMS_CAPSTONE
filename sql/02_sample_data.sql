USE healthcare_db;

INSERT INTO department (dept_name, location) VALUES
('Cardiology','Block A'), ('Orthopedics','Block B'), ('Pediatrics','Block C');

INSERT INTO doctor (dept_id, full_name, specialization, consultation_fee) VALUES
(1,'Dr. Meera Sharma','Cardiologist',800),
(2,'Dr. Arjun Verma','Orthopedic Surgeon',700),
(3,'Dr. Neha Gupta','Pediatrician',500);

INSERT INTO patient (full_name, dob, gender, blood_group, phone) VALUES
('Rohan Mehta','1990-05-14','M','B+','9876500001'),
('Anita Singh','1985-11-02','F','O+','9876500002');

INSERT INTO diagnostic_test (test_name, price) VALUES ('ECG',400), ('X-Ray',350), ('CBC',250);

INSERT INTO medicine (med_name, unit_price, stock_qty) VALUES
('Aspirin 75mg',2.5,500), ('Atorvastatin 10mg',8,300),
('Paracetamol 500mg',1.5,42), ('Amoxicillin 250mg',6,18);
