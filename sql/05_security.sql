USE healthcare_db;

CREATE ROLE 'r_admin','r_doctor','r_reception','r_billing';

GRANT ALL ON healthcare_db.* TO 'r_admin';

GRANT SELECT ON healthcare_db.patient TO 'r_doctor';
GRANT SELECT, INSERT, UPDATE ON healthcare_db.medical_history TO 'r_doctor';
GRANT SELECT, INSERT ON healthcare_db.prescription TO 'r_doctor';
GRANT SELECT, INSERT ON healthcare_db.prescription_item TO 'r_doctor';
GRANT SELECT, INSERT ON healthcare_db.test_order TO 'r_doctor';

GRANT SELECT, INSERT, UPDATE ON healthcare_db.patient TO 'r_reception';
GRANT SELECT, INSERT, UPDATE ON healthcare_db.appointment TO 'r_reception';
GRANT EXECUTE ON PROCEDURE healthcare_db.book_appointment TO 'r_reception';

GRANT SELECT, INSERT ON healthcare_db.bill TO 'r_billing';
GRANT SELECT, INSERT ON healthcare_db.bill_item TO 'r_billing';
GRANT SELECT, INSERT ON healthcare_db.payment TO 'r_billing';
GRANT EXECUTE ON PROCEDURE healthcare_db.generate_bill TO 'r_billing';

-- Billing staff see only basic patient info, no clinical data
CREATE VIEW v_billing_patient AS
SELECT patient_id, full_name, phone FROM patient;
GRANT SELECT ON healthcare_db.v_billing_patient TO 'r_billing';
