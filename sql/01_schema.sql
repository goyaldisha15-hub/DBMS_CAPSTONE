DROP DATABASE IF EXISTS healthcare_db;
CREATE DATABASE healthcare_db;
USE healthcare_db;

CREATE TABLE department (
  dept_id INT AUTO_INCREMENT PRIMARY KEY,
  dept_name VARCHAR(60) NOT NULL UNIQUE,
  location VARCHAR(60)
);

CREATE TABLE doctor (
  doctor_id INT AUTO_INCREMENT PRIMARY KEY,
  dept_id INT NOT NULL,
  full_name VARCHAR(80) NOT NULL,
  specialization VARCHAR(60),
  phone VARCHAR(15),
  email VARCHAR(100) UNIQUE,
  consultation_fee DECIMAL(10,2) NOT NULL CHECK (consultation_fee >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (dept_id) REFERENCES department(dept_id)
);

CREATE TABLE patient (
  patient_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(80) NOT NULL,
  dob DATE NOT NULL,
  gender ENUM('M','F','O') NOT NULL,
  blood_group VARCHAR(3),
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(100),
  address VARCHAR(200),
  registered_on DATE DEFAULT (CURRENT_DATE)
);

CREATE TABLE appointment (
  appt_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  appt_date DATE NOT NULL,
  appt_time TIME NOT NULL,
  status ENUM('Scheduled','Completed','Cancelled','No-Show') DEFAULT 'Scheduled',
  reason VARCHAR(200),
  FOREIGN KEY (patient_id) REFERENCES patient(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id)
);

CREATE TABLE medical_history (
  history_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  appt_id INT,
  symptoms TEXT,
  diagnosis VARCHAR(200) NOT NULL,
  notes TEXT,
  recorded_on DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patient(patient_id),
  FOREIGN KEY (appt_id) REFERENCES appointment(appt_id)
);

CREATE TABLE diagnostic_test (
  test_id INT AUTO_INCREMENT PRIMARY KEY,
  test_name VARCHAR(80) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE test_order (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  appt_id INT NOT NULL,
  test_id INT NOT NULL,
  ordered_on DATE DEFAULT (CURRENT_DATE),
  status ENUM('Ordered','Completed') DEFAULT 'Ordered',
  result TEXT,
  result_date DATE,
  FOREIGN KEY (appt_id) REFERENCES appointment(appt_id),
  FOREIGN KEY (test_id) REFERENCES diagnostic_test(test_id)
);

CREATE TABLE medicine (
  med_id INT AUTO_INCREMENT PRIMARY KEY,
  med_name VARCHAR(80) NOT NULL UNIQUE,
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0)
);

CREATE TABLE prescription (
  presc_id INT AUTO_INCREMENT PRIMARY KEY,
  appt_id INT NOT NULL,
  issued_on DATE DEFAULT (CURRENT_DATE),
  FOREIGN KEY (appt_id) REFERENCES appointment(appt_id)
);

CREATE TABLE prescription_item (
  presc_id INT,
  med_id INT,
  dosage VARCHAR(40),
  frequency VARCHAR(40),
  duration_days INT CHECK (duration_days > 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (presc_id, med_id),
  FOREIGN KEY (presc_id) REFERENCES prescription(presc_id),
  FOREIGN KEY (med_id) REFERENCES medicine(med_id)
);

CREATE TABLE bill (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  appt_id INT NOT NULL UNIQUE,
  bill_date DATE DEFAULT (CURRENT_DATE),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('Unpaid','Partial','Paid') DEFAULT 'Unpaid',
  FOREIGN KEY (appt_id) REFERENCES appointment(appt_id)
);

CREATE TABLE bill_item (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  description VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bill(bill_id)
);

CREATE TABLE payment (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  method ENUM('Cash','Card','UPI','Insurance') NOT NULL,
  paid_on DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bill(bill_id)
);

CREATE TABLE audit_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(40),
  action VARCHAR(10),
  record_id INT,
  changed_by VARCHAR(80),
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
