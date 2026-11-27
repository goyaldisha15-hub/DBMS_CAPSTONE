USE healthcare_db;
DELIMITER //

CREATE PROCEDURE book_appointment(
  IN p_patient INT, IN p_doctor INT, IN p_date DATE, IN p_time TIME, IN p_reason VARCHAR(200))
BEGIN
  DECLARE v_conflict INT;
  DECLARE v_doc INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  START TRANSACTION;
  -- lock the doctor row so two users cannot book the same slot at once
  SELECT doctor_id INTO v_doc FROM doctor WHERE doctor_id = p_doctor FOR UPDATE;

  SELECT COUNT(*) INTO v_conflict FROM appointment
  WHERE doctor_id = p_doctor AND appt_date = p_date AND appt_time = p_time
    AND status IN ('Scheduled','Completed');

  IF v_conflict > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot already booked';
  END IF;

  INSERT INTO appointment (patient_id, doctor_id, appt_date, appt_time, reason)
  VALUES (p_patient, p_doctor, p_date, p_time, p_reason);
  COMMIT;
END //

CREATE PROCEDURE generate_bill(IN p_appt INT)
BEGIN
  DECLARE v_bill INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  START TRANSACTION;
  INSERT INTO bill (appt_id) VALUES (p_appt);
  SET v_bill = LAST_INSERT_ID();

  INSERT INTO bill_item (bill_id, description, amount)
  SELECT v_bill, 'Consultation', d.consultation_fee
  FROM appointment a JOIN doctor d USING (doctor_id) WHERE a.appt_id = p_appt;

  INSERT INTO bill_item (bill_id, description, amount)
  SELECT v_bill, t.test_name, t.price
  FROM test_order o JOIN diagnostic_test t USING (test_id) WHERE o.appt_id = p_appt;

  INSERT INTO bill_item (bill_id, description, amount)
  SELECT v_bill, m.med_name, pi.quantity * m.unit_price
  FROM prescription pr
  JOIN prescription_item pi USING (presc_id)
  JOIN medicine m USING (med_id)
  WHERE pr.appt_id = p_appt;

  UPDATE bill
  SET total_amount = (SELECT SUM(amount) FROM bill_item WHERE bill_id = v_bill)
  WHERE bill_id = v_bill;
  COMMIT;
END //

-- Deduct stock when medicine is prescribed; reject if insufficient
CREATE TRIGGER trg_stock_check BEFORE INSERT ON prescription_item
FOR EACH ROW
BEGIN
  DECLARE v_stock INT;
  SELECT stock_qty INTO v_stock FROM medicine WHERE med_id = NEW.med_id FOR UPDATE;
  IF v_stock < NEW.quantity THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient medicine stock';
  END IF;
  UPDATE medicine SET stock_qty = stock_qty - NEW.quantity WHERE med_id = NEW.med_id;
END //

-- Auto-update bill status after each payment
CREATE TRIGGER trg_payment_status AFTER INSERT ON payment
FOR EACH ROW
BEGIN
  DECLARE v_paid DECIMAL(10,2);
  DECLARE v_total DECIMAL(10,2);
  SELECT SUM(amount) INTO v_paid FROM payment WHERE bill_id = NEW.bill_id;
  SELECT total_amount INTO v_total FROM bill WHERE bill_id = NEW.bill_id;
  UPDATE bill SET status = CASE WHEN v_paid >= v_total THEN 'Paid' ELSE 'Partial' END
  WHERE bill_id = NEW.bill_id;
END //

-- Audit trail on patient updates
CREATE TRIGGER trg_patient_audit AFTER UPDATE ON patient
FOR EACH ROW
  INSERT INTO audit_log (table_name, action, record_id, changed_by)
  VALUES ('patient','UPDATE', NEW.patient_id, USER()) //

DELIMITER ;
