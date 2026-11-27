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
        <div className="hero"><div><h3>{greet()}, Doctor</h3><p>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
          <div className="hero-n"><b>{c.today}</b>appointments today</div></div>
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

function Patients() {
  const [search, setSearch] = useState('')
  const [rows, reload, error] = useLoad('/patients?q=' + encodeURIComponent(search))
  const [sel, setSel] = useState(null)
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
      <div className="card"><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" /></label></div>
      <div className="card">{rows && <Table onRowClick={open} rows={rows} cols={[col('ID', 'patient_id'), col('Name', 'full_name', (r) => <span className="who"><i className="av">{r.full_name[0]}</i>{r.full_name}</span>), col('Gender', 'gender'), col('Blood group', 'blood_group'), col('Phone', 'phone')]} />}</div>
      {sel && <div className="card"><h3>Visit history: {sel.full_name}</h3>
        <Table rows={hist} cols={[col('Date', 'appt_date'), col('Doctor', 'doctor'), col('Department', 'dept_name'), col('Diagnosis', 'diagnosis')]} /></div>}
    </Page>
  )
}

function Appointments() {
  const [list, reload, error] = useLoad('/appointments')
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
      <div className="card">{list && <Table rows={list} cols={[col('Date', 'appt_date'), col('Time', 'appt_time'), col('Patient', 'patient'), col('Doctor', 'doctor'), col('Reason', 'reason'),
        col('Status', 'status', (r) => (
          <select value={r.status} onChange={(e) => setStatus(r.appt_id, e.target.value)}>
            {['Scheduled', 'Completed', 'Cancelled', 'No-Show'].map((s) => <option key={s}>{s}</option>)}
          </select>))]} />}</div>
    </Page>
  )
}

function Billing() {
  const [bills, reload, error] = useLoad('/bills')
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
      {unbilled?.length > 0 && <div className="card"><h3>Completed visits without a bill</h3>
        <Table rows={unbilled} cols={[col('Date', 'appt_date'), col('Patient', 'patient'), col('', 'appt_id', (r) => <button className="btn small" onClick={() => generate(r.appt_id)}>Generate bill</button>)]} /></div>}
      <div className="card">{bills && <Table rows={bills} cols={[col('Bill', 'bill_id', (r) => '#' + r.bill_id), col('Patient', 'patient'), col('Total', 'total_amount', (r) => money(r.total_amount)), col('Paid', 'paid', (r) => money(r.paid)), col('Balance', 'balance', (r) => money(r.balance)), col('Status', 'status', badge('status'))]} />}</div>
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

function Medicines() {
  const [meds, , error] = useLoad('/medicines')
  return (
    <Page title="Medicines" error={error} ready={meds}>
      <div className="card">{meds && <Table rows={meds} cols={[col('Medicine', 'med_name'), col('Unit price', 'unit_price', (r) => money(r.unit_price)),
        col('In stock', 'stock_qty', (r) => <span className={r.stock_qty < 50 ? 'low' : ''}>{r.stock_qty}{r.stock_qty < 50 ? ' (low)' : ''}</span>)]} />}</div>
    </Page>
  )
}

function Visits() {
  const [appts] = useLoad('/appointments')
  const [tests] = useLoad('/tests')
  const [meds, reloadMeds] = useLoad('/medicines')
  const [sel, setSel] = useState('')
  const aid = sel || appts?.find((a) => a.status !== 'Cancelled')?.appt_id || 0
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
  const open = (appts || []).filter((a) => a.status !== 'Cancelled')
  return (
    <Page title="Clinical (Visits)" error={error} ready={appts && tests && meds && v}>
      <div className="card"><label>Visit<select value={aid} onChange={(e) => { setSel(e.target.value); setM(null) }}>
        {open.map((a) => <option key={a.appt_id} value={a.appt_id}>{a.appt_date} – {a.patient} with {a.doctor}</option>)}</select></label></div>
      <Msg m={m} />
      <div className="grid2">
        <div className="card"><h3>Diagnosis</h3>
          <form onSubmit={send('diagnosis', dx, () => setDx({ symptoms: '', diagnosis: '' }))}>
            <label>Symptoms<input value={dx.symptoms} onChange={(e) => setDx({ ...dx, symptoms: e.target.value })} /></label>
            <label>Diagnosis<input value={dx.diagnosis} onChange={(e) => setDx({ ...dx, diagnosis: e.target.value })} required /></label>
            <button className="btn">Save</button></form>
          <Table rows={v?.history || []} cols={[col('Diagnosis', 'diagnosis'), col('Symptoms', 'symptoms')]} /></div>
        <div className="card"><h3>Diagnostic tests</h3>
          <form onSubmit={send('test', { test_id: tid || tests?.[0]?.test_id }, () => {})}>
            <label>Test<select value={tid || tests?.[0]?.test_id} onChange={(e) => setTid(e.target.value)}>{tests?.map((t) => <option key={t.test_id} value={t.test_id}>{t.test_name} ({money(t.price)})</option>)}</select></label>
            <button className="btn">Order test</button></form>
          <Table rows={v?.tests || []} cols={[col('Test', 'test_name'), col('Status', 'status'), col('Price', 'price', (r) => money(r.price))]} /></div>
      </div>
      <div className="card"><h3>Prescription</h3>
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

const tabs = { Dashboard, Patients, Appointments, Visits, Billing, Medicines }

const ICON = { Dashboard: '📊', Patients: '🧑', Appointments: '📅', Visits: '🩺', Billing: '💳', Medicines: '💊' }

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const [dark, setDark] = useState(false)
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
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
        <div className="topbar"><span>Hospital management</span>
          <button className="ghost" onClick={() => setDark(!dark)}>{dark ? '☀️ Light' : '🌙 Dark'}</button></div>
        <main><View key={tab} /></main>
      </div>
    </div>
  )
}
