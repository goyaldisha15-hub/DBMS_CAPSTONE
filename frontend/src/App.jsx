import { useCallback, useEffect, useState } from 'react'
import './App.css'

async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

// loads data on mount; exposes reload + error so every page handles failures the same way
function useLoad(url) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    api(url).then((d) => { setData(d); setError('') }).catch((e) => setError(e.message))
  }, [url])
  useEffect(() => { load() }, [load])
  return [data, load, error]
}

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const money = (n) => '₹' + Number(n).toLocaleString('en-IN')
const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v)

function Table({ cols, rows, onRowClick }) {
  if (!rows.length) return <p>Nothing here yet.</p>
  return (
    <table>
      <thead><tr>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={onRowClick ? 'click' : ''} onClick={() => onRowClick?.(r)}>
            {cols.map((c) => <td key={c.label}>{c.render ? c.render(r) : dash(r[c.key])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
const col = (label, key, render) => ({ label, key, render })
const badge = (k) => (r) => <span className={`badge ${r[k]}`}>{r[k]}</span>

function Msg({ m }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!m) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 4000)
    return () => clearTimeout(t)
  }, [m])
  return m && show ? <div className={`toast ${m.ok ? 'ok' : 'err'}`} role="status">{m.ok ? '✓' : '✕'} {m.text}</div> : null
}

function Page({ title, error, ready, children }) {
  return (
    <>
      <h2>{title}</h2>
      {error && <div className="error-box">Could not load data: {error}. Is the backend running and the database set up?</div>}
      {!error && !ready ? <p>Loading…</p> : children}
    </>
  )
}

const COLORS = { Completed: '#1b7f4b', Scheduled: '#d97706', Cancelled: '#b3261e', 'No-Show': '#7c3aed' }

function Donut({ data }) {
  const total = data.reduce((s, d) => s + d.n, 0) || 1
  let acc = 0
  const stops = data.map((d) => { const from = (acc / total) * 100; acc += d.n; return `${COLORS[d.status]} ${from}% ${(acc / total) * 100}%` }).join(',')
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops || '#ddd 0 100%'})` }}><span>{total}</span></div>
      <ul className="legend">{data.map((d) => <li key={d.status}><i style={{ background: COLORS[d.status] }} />{d.status} ({d.n})</li>)}</ul>
    </div>
  )
}

function Bars({ rows, k, v }) {
  if (!rows.length) return <p>Nothing here yet.</p>
  const mx = Math.max(...rows.map((r) => +r[v]), 1)
  return rows.map((r) => (
    <div className="hbar" key={r[k]}><span>{r[k]}</span><div><i style={{ width: (+r[v] / mx) * 100 + '%' }} /></div><b>{r[v]}</b></div>
  ))
}

function Dashboard() {
  const [d, , error] = useLoad('/dashboard')
  const c = d?.counts
  const stats = c && [['Patients', c.patients, '#0e6b6b'], ['Appointments', c.appointments, '#2563eb'], ['Today', c.today, '#d97706'], ['Outstanding', money(c.outstanding), '#b3261e']]
  return (
    <Page title="Dashboard" error={error} ready={d}>
      {d && <>
        {d.lowStock.length > 0 && <div className="alert">Low stock: {d.lowStock.map((m) => `${m.med_name} (${m.stock_qty})`).join(', ')}</div>}
        <div className="stats">{stats.map(([l, v, col]) => <div className="card stat" style={{ borderTopColor: col }} key={l}><b>{v}</b>{l}</div>)}</div>
        <div className="grid2">
          <div className="card"><h3>Appointment status</h3><Donut data={d.statusCounts} /></div>
          <div className="card"><h3>Appointments by department</h3><Bars rows={d.apptReport} k="dept_name" v="total_appts" /></div>
        </div>
        <div className="card"><h3>Today’s schedule</h3>
          <Table rows={d.todayAppts} cols={[col('Time', 'appt_time'), col('Patient', 'patient'), col('Doctor', 'doctor'), col('Reason', 'reason'), col('Status', 'status', badge('status'))]} /></div>
        <div className="grid2">
          <div className="card"><h3>Top diagnoses</h3><Bars rows={d.topDx} k="diagnosis" v="cases" /></div>
          <div className="card"><h3>Recent payments</h3>
            <Table rows={d.recentPayments} cols={[col('Patient', 'patient'), col('Amount', 'amount', (r) => money(r.amount)), col('Method', 'method')]} /></div>
        </div>
        <div className="card"><h3>Revenue by department</h3>
          <Table rows={d.revReport} cols={[col('Department', 'dept_name'), col('Month', 'month'), col('Billed', 'billed', (r) => money(r.billed)), col('Collected', 'collected', (r) => money(r.collected))]} /></div>
      </>}
    </Page>
  )
}

function PatientProfile({ id, onSaved }) {
  const [d, reload, error] = useLoad(`/patients/${id}/profile`)
  const [f, setF] = useState(null)
  const [m, setM] = useState(null)
  if (error) return <div className="error-box">{error}</div>
  if (!d) return <p>Loading…</p>
  const p = d.patient
  const form = f || { full_name: p.full_name, phone: p.phone, blood_group: p.blood_group || '', address: p.address || '' }
  const set = (k) => (e) => setF({ ...form, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try { const r = await api(`/patients/${id}`, 'PUT', form); setM({ ok: true, text: r.message }); setF(null); reload(); onSaved() }
    catch (err) { setM({ ok: false, text: err.message }) }
  }
  return (
    <div className="card">
      <h3>Patient record: {p.full_name} (ID {p.patient_id})</h3>
      <p className="muted">Date of birth {p.dob} (age {Math.floor((Date.now() - new Date(p.dob)) / 31557600000)}) · Gender {p.gender} · Registered {p.registered_on}</p>
      <form onSubmit={save}>
        <label>Full name<input value={form.full_name} onChange={set('full_name')} required /></label>
        <label>Phone<input value={form.phone} onChange={set('phone')} maxLength="10" required /></label>
        <label>Blood group<input value={form.blood_group} onChange={set('blood_group')} maxLength="3" /></label>
        <label>Address<input value={form.address} onChange={set('address')} /></label>
        <button className="btn">Update record</button>
      </form>
      <Msg m={m} />
      <p className="muted">Every update is written to audit_log by the trg_patient_audit trigger.</p>
      <h4>Medical history</h4>
      <Table rows={d.history} cols={[col('Date', 'appt_date'), col('Doctor', 'doctor'), col('Department', 'dept_name'), col('Symptoms', 'symptoms'), col('Diagnosis', 'diagnosis')]} />
      <h4>Diagnostic tests</h4>
      <Table rows={d.tests} cols={[col('Date', 'appt_date'), col('Test', 'test_name'), col('Status', 'status'), col('Result', 'result')]} />
      <h4>Prescriptions</h4>
      <Table rows={d.meds} cols={[col('Date', 'appt_date'), col('Medicine', 'med_name'), col('Dosage', 'dosage'), col('Frequency', 'frequency'), col('Days', 'duration_days'), col('Qty', 'quantity')]} />
      <h4>Bills</h4>
      <Table rows={d.bills} cols={[col('Bill', 'bill_id', (r) => '#' + r.bill_id), col('Date', 'bill_date'), col('Total', 'total_amount', (r) => money(r.total_amount)), col('Status', 'status', badge('status'))]} />
    </div>
  )
}

function Patients() {
  const [search, setSearch] = useState('')
  const [rows, reload, error] = useLoad('/patients?q=' + encodeURIComponent(search))
  const [sel, setSel] = useState(null)
  const [bg, setBg] = useState('')
  const [hist, setHist] = useState([])
  const blank = { full_name: '', dob: '', gender: 'M', blood_group: '', phone: '' }
  const [f, setF] = useState(blank)
  const [m, setM] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const open = (p) => { setSel(p); api(`/patients/${p.patient_id}/history`).then(setHist) }
  const submit = async (e) => {
    e.preventDefault()
    try { const r = await api('/patients', 'POST', f); setM({ ok: true, text: r.message }); setF(blank); reload() }
    catch (err) { setM({ ok: false, text: err.message }) }
  }
  return (
    <Page title="Patients" error={error} ready={rows}>
      <div className="card"><h3>Add a patient</h3>
        <form onSubmit={submit}>
          <label>Full name<input value={f.full_name} onChange={set('full_name')} required /></label>
          <label>Date of birth<input type="date" value={f.dob} onChange={set('dob')} required /></label>
          <label>Gender<select value={f.gender} onChange={set('gender')}><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></label>
          <label>Blood group<select value={f.blood_group} onChange={set('blood_group')}><option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></label>
          <label>Phone<input value={f.phone} onChange={set('phone')} maxLength="10" required /></label>
          <button className="btn">Add patient</button>
        </form><Msg m={m} /></div>
      <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" /></label>
        <label>Blood group<select value={bg} onChange={(e) => setBg(e.target.value)}><option value="">All</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></label></div>
      <div className="card">{rows && <Table onRowClick={open} rows={rows.filter((r) => !bg || r.blood_group === bg)} cols={[col('ID', 'patient_id'), col('Name', 'full_name', (r) => <span className="who"><i className="av">{r.full_name[0]}</i>{r.full_name}</span>), col('Gender', 'gender'), col('Blood group', 'blood_group'), col('Phone', 'phone')]} />}</div>
      {sel && <PatientProfile key={sel.patient_id} id={sel.patient_id} onSaved={reload} />}
    </Page>
  )
}

function Appointments() {
  const [list, reload, error] = useLoad('/appointments')
  const [open, setOpen] = useState(null)
  const [flt, setFlt] = useState({ status: '', doctor: '', date: '' })
  const [pats] = useLoad('/patients')
  const [docs] = useLoad('/doctors')
  const [f, setF] = useState({ patient_id: '', doctor_id: '', appt_date: '', appt_time: '', reason: '' })
  const [m, setM] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const pid = f.patient_id || pats?.[0]?.patient_id || ''
  const did = f.doctor_id || docs?.[0]?.doctor_id || ''
  const submit = async (e) => {
    e.preventDefault()
    try { const r = await api('/appointments', 'POST', { ...f, patient_id: pid, doctor_id: did }); setM({ ok: true, text: r.message }); reload() }
    catch (err) { setM({ ok: false, text: err.message }) }
  }
  const setStatus = async (id, status) => {
    try { await api(`/appointments/${id}/status`, 'PATCH', { status }); reload() }
    catch (err) { setM({ ok: false, text: err.message }) }
  }
  const shown = (list || []).filter((r) => (!flt.status || r.status === flt.status) && (!flt.doctor || r.doctor === flt.doctor) && (!flt.date || r.appt_date === flt.date))
  const doctorsInList = [...new Set((list || []).map((r) => r.doctor))]
  if (open) return <Consultation appt={open} onBack={() => { setOpen(null); reload() }} />
  return (
    <Page title="Appointments" error={error} ready={list && pats && docs}>
      <div className="card"><h3>Book an appointment</h3>
        <form onSubmit={submit}>
          <label>Patient<select value={pid} onChange={set('patient_id')}>{pats?.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.full_name}</option>)}</select></label>
          <label>Doctor<select value={did} onChange={set('doctor_id')}>{docs?.map((d) => <option key={d.doctor_id} value={d.doctor_id}>{d.full_name} ({d.dept_name})</option>)}</select></label>
          <label>Date<input type="date" value={f.appt_date} onChange={set('appt_date')} required /></label>
          <label>Time<input type="time" value={f.appt_time} onChange={set('appt_time')} required /></label>
          <label>Reason<input value={f.reason} onChange={set('reason')} /></label>
          <button className="btn">Book appointment</button>
        </form><Msg m={m} /></div>
      <div className="card"><h3>Track appointments</h3><form>
        <label>Status<select value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}><option value="">All</option>{['Scheduled', 'Completed', 'Cancelled', 'No-Show'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Doctor<select value={flt.doctor} onChange={(e) => setFlt({ ...flt, doctor: e.target.value })}><option value="">All</option>{doctorsInList.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>Date<input type="date" value={flt.date} onChange={(e) => setFlt({ ...flt, date: e.target.value })} /></label>
        <button type="button" className="ghost" onClick={() => setFlt({ status: '', doctor: '', date: '' })}>Clear</button></form></div>
      <div className="card">{list && <Table rows={shown} cols={[col('Date', 'appt_date'), col('Time', 'appt_time'), col('Patient', 'patient'), col('Doctor', 'doctor'), col('Reason', 'reason'),
        col('Record', 'appt_id', (r) => <button className="btn small" onClick={() => setOpen(r)}>Open record</button>),
        col('Status', 'status', (r) => (
          <select value={r.status} onChange={(e) => setStatus(r.appt_id, e.target.value)}>
            {['Scheduled', 'Completed', 'Cancelled', 'No-Show'].map((s) => <option key={s}>{s}</option>)}
          </select>))]} />}</div>
    </Page>
  )
}

function Invoice({ id, onClose }) {
  const [d, , error] = useLoad(`/bills/${id}`)
  if (error) return <div className="error-box">{error}</div>
  if (!d) return <p>Loading…</p>
  const paid = d.payments.reduce((s, x) => s + Number(x.amount), 0)
  return (
    <div className="card invoice"><h3>Invoice #{d.bill.bill_id} – {d.bill.patient} ({d.bill.bill_date})</h3>
      <Table rows={d.items} cols={[col('Description', 'description'), col('Amount', 'amount', (r) => money(r.amount))]} />
      <p><b>Total {money(d.bill.total_amount)}</b> · Paid {money(paid)} · Balance {money(d.bill.total_amount - paid)} · <span className={`badge ${d.bill.status}`}>{d.bill.status}</span></p>
      <h4>Payments</h4>
      <Table rows={d.payments} cols={[col('Date', 'paid_on'), col('Amount', 'amount', (r) => money(r.amount)), col('Method', 'method')]} />
      <button className="btn small" onClick={() => window.print()}>Print invoice</button> <button className="ghost" onClick={onClose}>Close invoice</button></div>
  )
}

function Billing() {
  const [bills, reload, error] = useLoad('/bills')
  const [inv, setInv] = useState(null)
  const [unbilled, reloadUn] = useLoad('/appointments/unbilled')
  const [f, setF] = useState({ bill_id: '', amount: '', method: 'Cash' })
  const [m, setM] = useState(null)
  const open = bills?.filter((b) => b.status !== 'Paid') || []
  const bid = f.bill_id || open[0]?.bill_id || ''
  const refresh = () => { reload(); reloadUn() }
  const generate = async (id) => {
    try { const r = await api('/bills', 'POST', { appt_id: id }); setM({ ok: true, text: r.message }); refresh() }
    catch (err) { setM({ ok: false, text: err.message }) }
  }
  const pay = async (e) => {
    e.preventDefault()
    try { const r = await api('/payments', 'POST', { bill_id: bid, amount: Number(f.amount), method: f.method }); setM({ ok: true, text: r.message }); setF({ ...f, amount: '' }); refresh() }
    catch (err) { setM({ ok: false, text: err.message }) }
  }
  return (
    <Page title="Billing" error={error} ready={bills && unbilled}>
      <Msg m={m} />
      {inv && <Invoice id={inv} onClose={() => setInv(null)} />}
      {unbilled?.length > 0 && <div className="card"><h3>Completed visits without a bill</h3>
        <Table rows={unbilled} cols={[col('Date', 'appt_date'), col('Patient', 'patient'), col('', 'appt_id', (r) => <button className="btn small" onClick={() => generate(r.appt_id)}>Generate bill</button>)]} /></div>}
      <div className="card">{bills && <Table rows={bills} cols={[col('Bill', 'bill_id', (r) => '#' + r.bill_id), col('Patient', 'patient'), col('Total', 'total_amount', (r) => money(r.total_amount)), col('Paid', 'paid', (r) => money(r.paid)), col('Balance', 'balance', (r) => money(r.balance)), col('Status', 'status', badge('status')), col('', 'bill_id', (r) => <button className="btn small" onClick={() => setInv(r.bill_id)}>Invoice</button>)]} />}</div>
      <div className="card"><h3>Record a payment</h3>
        {open.length === 0 ? <p>All bills are paid.</p> :
          <form onSubmit={pay}>
            <label>Bill<select value={bid} onChange={(e) => setF({ ...f, bill_id: e.target.value })}>{open.map((b) => <option key={b.bill_id} value={b.bill_id}>#{b.bill_id} – {b.patient} (due {money(b.balance)})</option>)}</select></label>
            <label>Amount<input type="number" min="1" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></label>
            <label>Method<select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{['Cash', 'Card', 'UPI', 'Insurance'].map((x) => <option key={x}>{x}</option>)}</select></label>
            <button className="btn">Record payment</button>
          </form>}
      </div>
    </Page>
  )
}

function RestockCell({ r, onSaved }) {
  const [n, setN] = useState('')
  const go = async (e) => {
    e.preventDefault()
    try { await api(`/medicines/${r.med_id}/restock`, 'PATCH', { qty: Number(n) }); setN(''); onSaved() } catch (err) { alert(err.message) }
  }
  return <form onSubmit={go}><input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} placeholder="Qty" required /><button className="btn small">Add stock</button></form>
}

function Medicines() {
  const [meds, reload, error] = useLoad('/medicines')
  return (
    <Page title="Medicines" error={error} ready={meds}>
      <div className="card">{meds && <Table rows={meds} cols={[col('Medicine', 'med_name'), col('Unit price', 'unit_price', (r) => money(r.unit_price)),
        col('In stock', 'stock_qty', (r) => <span className={r.stock_qty < 50 ? 'low' : ''}>{r.stock_qty}{r.stock_qty < 50 ? ' (low)' : ''}</span>), col('Restock', 'med_id', (r) => <RestockCell r={r} onSaved={reload} />)]} />}</div>
    </Page>
  )
}

function ResultCell({ r, onSaved }) {
  const [v, setV] = useState('')
  if (r.status === 'Completed') return r.result || '—'
  const save = async (e) => {
    e.preventDefault()
    try { await api(`/tests/${r.order_id}/result`, 'PATCH', { result: v }); onSaved() } catch (err) { alert(err.message) }
  }
  return <form onSubmit={save}><input value={v} onChange={(e) => setV(e.target.value)} placeholder="Enter result" required /><button className="btn small">Save</button></form>
}

// the medical record of one appointment: diagnosis, tests, prescription (all linked to the appointment)
function Consultation({ appt, onBack }) {
  const aid = appt.appt_id
  const [tests] = useLoad('/tests')
  const [meds, reloadMeds] = useLoad('/medicines')
  const [v, reload, error] = useLoad(`/visits/${aid}`)
  const [dx, setDx] = useState({ symptoms: '', diagnosis: '' })
  const [tid, setTid] = useState('')
  const [rx, setRx] = useState({ med_id: '', quantity: '', dosage: '', frequency: '', duration_days: '' })
  const [m, setM] = useState(null)
  const send = (path, body, done) => async (e) => {
    e.preventDefault()
    try { const r = await api(`/visits/${aid}/${path}`, 'POST', body); setM({ ok: true, text: r.message }); done(); reload(); reloadMeds() }
    catch (err) { setM({ ok: false, text: err.message }) }
  }
  return (
    <Page title="Appointment record" error={error} ready={tests && meds && v}>
      <button className="ghost" onClick={onBack}>← Back to appointments</button>
      <div className="card" style={{ marginTop: 14 }}><h3>Appointment #{aid}</h3>
        <p>{appt.patient} with {appt.doctor} · {appt.appt_date} {appt.appt_time} · {appt.status}</p>
        <p className="muted">Everything below is stored against this appointment: diagnosis in medical_history, tests in test_order, medicines in prescription_item. The bill for this appointment is built from them.</p></div>
      <Msg m={m} />
      <div className="grid2">
        <div className="card"><h3>Diagnosis (medical_history)</h3>
          <form onSubmit={send('diagnosis', dx, () => setDx({ symptoms: '', diagnosis: '' }))}>
            <label>Symptoms<input value={dx.symptoms} onChange={(e) => setDx({ ...dx, symptoms: e.target.value })} /></label>
            <label>Diagnosis<input value={dx.diagnosis} onChange={(e) => setDx({ ...dx, diagnosis: e.target.value })} required /></label>
            <button className="btn">Save</button></form>
          <Table rows={v?.history || []} cols={[col('Diagnosis', 'diagnosis'), col('Symptoms', 'symptoms')]} /></div>
        <div className="card"><h3>Diagnostic tests (test_order)</h3>
          <form onSubmit={send('test', { test_id: tid || tests?.[0]?.test_id }, () => {})}>
            <label>Test<select value={tid || tests?.[0]?.test_id} onChange={(e) => setTid(e.target.value)}>{tests?.map((t) => <option key={t.test_id} value={t.test_id}>{t.test_name} ({money(t.price)})</option>)}</select></label>
            <button className="btn">Order test</button></form>
          <Table rows={v?.tests || []} cols={[col('Test', 'test_name'), col('Status', 'status'), col('Result', 'result', (r) => <ResultCell r={r} onSaved={reload} />)]} /></div>
      </div>
      <div className="card"><h3>Prescription (prescription_item)</h3>
        <form onSubmit={send('prescribe', { ...rx, med_id: rx.med_id || meds?.[0]?.med_id }, () => setRx({ ...rx, quantity: '' }))}>
          <label>Medicine<select value={rx.med_id || meds?.[0]?.med_id} onChange={(e) => setRx({ ...rx, med_id: e.target.value })}>{meds?.map((x) => <option key={x.med_id} value={x.med_id}>{x.med_name} (stock {x.stock_qty})</option>)}</select></label>
          <label>Quantity<input type="number" min="1" value={rx.quantity} onChange={(e) => setRx({ ...rx, quantity: e.target.value })} required /></label>
          <label>Dosage<input value={rx.dosage} onChange={(e) => setRx({ ...rx, dosage: e.target.value })} /></label>
          <label>Frequency<input value={rx.frequency} onChange={(e) => setRx({ ...rx, frequency: e.target.value })} /></label>
          <label>Days<input type="number" min="1" value={rx.duration_days} onChange={(e) => setRx({ ...rx, duration_days: e.target.value })} /></label>
          <button className="btn">Prescribe</button></form>
        <Table rows={v?.meds || []} cols={[col('Medicine', 'med_name'), col('Dosage', 'dosage'), col('Frequency', 'frequency'), col('Qty', 'quantity')]} /></div>
    </Page>
  )
}

function Reports() {
  const [d, , error] = useLoad('/reports')
  const [ex] = useLoad('/explain')
  return (
    <Page title="Department-wise Reports" error={error} ready={d}>
      {d && <>
        <div className="card"><h3>Appointments by department</h3><p className="muted">Source: view v_dept_appointment_report</p>
          <Table rows={d.appts} cols={[col('Department', 'dept_name'), col('Total', 'total_appts'), col('Completed', 'completed'), col('Cancelled', 'cancelled'), col('No-shows', 'no_shows')]} /></div>
        <div className="card"><h3>Monthly revenue by department</h3><p className="muted">Source: view v_dept_revenue_monthly</p>
          <Table rows={d.revenue} cols={[col('Department', 'dept_name'), col('Month', 'month'), col('Billed', 'billed', (r) => money(r.billed)), col('Collected', 'collected', (r) => money(r.collected))]} /></div>
        <div className="grid2">
          <div className="card"><h3>Doctors ranked by revenue</h3><p className="muted">Window function RANK() per department</p>
            <Table rows={d.ranking} cols={[col('Department', 'dept_name'), col('Doctor', 'doctor'), col('Revenue', 'revenue', (r) => money(r.revenue)), col('Rank', 'dept_rank')]} /></div>
          <div className="card"><h3>Top diagnoses by department</h3><p className="muted">Medical history grouped by department</p>
            <Table rows={d.topDx} cols={[col('Department', 'dept_name'), col('Diagnosis', 'diagnosis'), col('Cases', 'cases')]} /></div>
        </div>
        <div className="grid2">
          <div className="card"><h3>Diagnostic tests by department</h3>
            <Table rows={d.tests} cols={[col('Department', 'dept_name'), col('Test', 'test_name'), col('Orders', 'orders')]} /></div>
          <div className="card"><h3>Outstanding dues</h3>
            <Table rows={d.dues} cols={[col('Patient', 'patient'), col('Bill', 'bill_id', (r) => '#' + r.bill_id), col('Balance due', 'balance_due', (r) => money(r.balance_due))]} /></div>
        </div>
        {ex && <div className="card"><h3>Query optimization: EXPLAIN</h3><p className="muted">Doctor schedule query, run without any index and then with idx_appt_doctor_date</p>
          <h4>Without index</h4><Table rows={ex.noIndex} cols={[col('Access type', 'type'), col('Index used', 'key'), col('Rows examined', 'rows'), col('Extra', 'extra')]} />
          <h4>With index</h4><Table rows={ex.withIndex} cols={[col('Access type', 'type'), col('Index used', 'key'), col('Rows examined', 'rows'), col('Extra', 'extra')]} /></div>}
        <div className="card"><h3>Audit log (changes to patient records)</h3><p className="muted">Written by trigger trg_patient_audit</p>
          <Table rows={d.audit} cols={[col('Table', 'table_name'), col('Action', 'action'), col('Record', 'record_id'), col('By', 'changed_by'), col('When', 'changed_at')]} /></div>
      </>}
    </Page>
  )
}

function Doctors() {
  const [docs, reload, error] = useLoad('/doctors/overview')
  const [pats] = useLoad('/patients')
  const [did, setDid] = useState('')
  const [pid, setPid] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [m, setM] = useState(null)
  const sel = did || docs?.[0]?.doctor_id || 0
  const [slots, reloadSlots] = useLoad(`/doctors/${sel}/slots?date=${date}`)
  const times = Array.from({ length: 16 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
  const booked = Object.fromEntries((slots || []).map((s) => [s.t, s.patient]))
  const book = async (t) => {
    try {
      const r = await api('/appointments', 'POST', { patient_id: pid || pats[0].patient_id, doctor_id: sel, appt_date: date, appt_time: t, reason: 'Booked from schedule' })
      setM({ ok: true, text: r.message }); reloadSlots(); reload()
    } catch (err) { setM({ ok: false, text: err.message }) }
  }
  return (
    <Page title="Doctors and Availability" error={error} ready={docs && pats}>
      <div className="card"><h3>Doctors by department (doctor, department)</h3>
        <Table rows={docs || []} cols={[col('Doctor', 'full_name'), col('Department', 'dept_name'), col('Specialization', 'specialization'), col('Fee', 'consultation_fee', (r) => money(r.consultation_fee)), col('Today', 'today_appts'), col('Total appointments', 'total_appts')]} /></div>
      <div className="card"><h3>Availability and quick booking</h3>
        <form>
          <label>Doctor<select value={sel} onChange={(e) => setDid(e.target.value)}>{docs?.map((d) => <option key={d.doctor_id} value={d.doctor_id}>{d.full_name}</option>)}</select></label>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Book for patient<select value={pid || pats?.[0]?.patient_id} onChange={(e) => setPid(e.target.value)}>{pats?.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.full_name}</option>)}</select></label>
        </form>
        <p className="muted">Green slots are free: click one to book it (uses the book_appointment procedure). Grey slots are already taken.</p>
        <div className="slots">{times.map((t) => booked[t]
          ? <button key={t} className="slot booked" disabled title={booked[t]}>{t}<br />{booked[t]}</button>
          : <button key={t} className="slot free" onClick={() => book(t)}>{t}<br />Free</button>)}</div>
      </div>
      <Msg m={m} />
    </Page>
  )
}

const tabs = { Dashboard, Patients, Doctors, Appointments, Billing, Medicines, Reports }

const ICON = { Dashboard: '📊', Patients: '🧑', Appointments: '📅', Visits: '🩺', Billing: '💳', Medicines: '💊', Reports: '📈', Doctors: '👨‍⚕️' }

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const View = tabs[tab]
  return (
    <div className="layout">
      <nav>
        <h1><span className="logo">✚</span> MediTrack</h1>
        {Object.keys(tabs).map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}><span>{ICON[t]}</span>{t}</button>
        ))}
        <small>Healthcare record system</small>
      </nav>
      <div className="content">
        <div className="topbar"><span>Hospital management</span></div>
        <main><View key={tab} /></main>
      </div>
    </div>
  )
}
