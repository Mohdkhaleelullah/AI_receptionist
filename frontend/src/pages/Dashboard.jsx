import React, { useEffect, useState } from "react";
import "./Dashboard.css";

const API = "http://localhost:5000/api";

async function request(path, options) {
    const response = await fetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
}

function Dashboard() {
    const [view, setView] = useState("dashboard");
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [stats, setStats] = useState({ appointments: 0, confirmed: 0, cancelled: 0, patients: 0, doctors: 0 });
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadData = async () => {
        setLoading(true);
        setError("");
        try {
            const [appointmentData, statData, patientData, doctorData] = await Promise.all([
                request("/appointments"),
                request("/dashboard/stats"),
                request("/patients"),
                request("/doctors")
            ]);
            setAppointments(appointmentData);
            setStats(statData);
            setPatients(patientData);
            setDoctors(doctorData);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const updateAppointment = async (appointment) => {
        if (appointment.status !== "confirmed") return;
        const action = window.prompt("Type cancel or reschedule");
        if (action === "cancel") {
            await request(`/appointments/${appointment.id}/cancel`, { method: "PATCH" });
        } else if (action === "reschedule") {
            const newDate = window.prompt("New date (YYYY-MM-DD)", appointment.appointment_date);
            const newTime = window.prompt("New time (HH:MM)", appointment.appointment_time);
            if (!newDate || !newTime) return;
            await request(`/appointments/${appointment.id}/reschedule`, {
                method: "PATCH",
                body: JSON.stringify({ new_date: newDate, new_time: newTime })
            });
        } else return;
        await loadData();
    };

    const createRecord = async (path, payload) => {
        try {
            setError("");
            await request(path, { method: "POST", body: JSON.stringify(payload) });
            await loadData();
        } catch (createError) {
            setError(createError.message);
        }
    };

    const filteredAppointments = appointments.filter((appointment) => {
        const text = [appointment.patients?.name, appointment.doctors?.name, appointment.status, appointment.reason].join(" ");
        return text.toLowerCase().includes(query.toLowerCase());
    });

    const navItems = [
        ["dashboard", "📊 Dashboard"],
        ["appointments", "📅 Appointments"],
        ["patients", "👥 Patients"],
        ["doctors", "👨‍⚕️ Doctors"]
    ];

    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="logo">🏥 Clinic AI</div>
                <nav>{navItems.map(([key, label]) => (
                    <button key={key} className={`nav-item ${view === key ? "active" : ""}`} onClick={() => setView(key)}>{label}</button>
                ))}</nav>
            </aside>
            <main className="main-content">
                <header className="topbar">
                    <div><h1>{navItems.find(([key]) => key === view)?.[1].replace(/^\S+\s/, "")}</h1><p>Clinic overview and appointments</p></div>
                    <div className="admin-profile"><div className="avatar">A</div><div><strong>Admin</strong><span>Clinic Administrator</span></div></div>
                </header>
                {error && <div className="error-banner">{error}</div>}

                {view === "dashboard" && <>
                    <section className="stats">
                        {[["📅", "Appointments", stats.appointments], ["✓", "Confirmed", stats.confirmed], ["✕", "Cancelled", stats.cancelled], ["👥", "Patients", stats.patients], ["👨‍⚕️", "Doctors", stats.doctors]].map(([icon, label, value]) => <div className="stat-card" key={label}><div className="stat-icon">{icon}</div><div><span>{label}</span><h2>{value}</h2></div></div>)}
                    </section>
                    <AppointmentTable appointments={filteredAppointments.slice(0, 8)} loading={loading} onAction={updateAppointment} />
                </>}

                {view === "appointments" && <section className="appointments-card"><div className="section-header"><div><h2>Appointments</h2><p>Search, cancel, reschedule, or add appointments</p></div><button className="refresh-button" onClick={loadData}>↻ Refresh</button></div><AppointmentForm patients={patients} doctors={doctors} onSubmit={(form) => createRecord("/appointments", form)} /><input className="search-input" placeholder="Search patient, doctor, status, or reason" value={query} onChange={(event) => setQuery(event.target.value)} /><AppointmentTable appointments={filteredAppointments} loading={loading} onAction={updateAppointment} /></section>}

                {view === "patients" && <><PatientForm onSubmit={(form) => createRecord("/patients", form)} /><Directory title="Patients" items={patients} empty="No patients found." renderItem={(patient) => { const history = appointments.filter((appointment) => appointment.patients?.id === patient.id); return <><strong>{patient.name}</strong><span>{patient.phone || "No phone"} · {patient.email || "No email"}</span><small>{history.length} appointments</small><div className="history">{history.map((appointment) => <span key={appointment.id}>{appointment.appointment_date} at {appointment.appointment_time} · {appointment.status}</span>)}</div></>; }} /></>}
                {view === "doctors" && <><DoctorForm onSubmit={(form) => createRecord("/doctors", form)} /><Directory title="Doctors" items={doctors} empty="No doctors found." renderItem={(doctor) => { const schedule = appointments.filter((appointment) => appointment.doctors?.id === doctor.id && appointment.status === "confirmed"); return <><strong>{doctor.name}</strong><span>{doctor.specialization || "General practice"}</span><small>{schedule.length} confirmed appointments</small><div className="history">{schedule.map((appointment) => <span key={appointment.id}>{appointment.appointment_date} at {appointment.appointment_time} · {appointment.patients?.name || "Patient"}</span>)}</div></>; }} /></>}
            </main>
        </div>
    );
}

function AppointmentTable({ appointments, loading, onAction }) {
    if (loading) return <div className="appointments-card loading">Loading appointments...</div>;
    if (appointments.length === 0) return <div className="appointments-card empty">No appointments found.</div>;
    return <div className="appointments-card table-wrapper"><table><thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>{appointments.map((appointment) => <tr key={appointment.id}><td>{appointment.patients?.name || "-"}</td><td>{appointment.doctors?.name || "-"}</td><td>{appointment.appointment_date}</td><td>{appointment.appointment_time}</td><td><span className={`status ${appointment.status}`}>{appointment.status}</span></td><td>{appointment.status === "confirmed" && <button className="table-action" onClick={() => onAction(appointment)}>Manage</button>}</td></tr>)}</tbody></table></div>;
}

function Directory({ title, items, empty, renderItem }) {
    return <section className="directory"><div className="section-header"><div><h2>{title}</h2><p>{items.length} records from the database</p></div></div>{items.length === 0 ? <div className="empty">{empty}</div> : <div className="directory-grid">{items.map((item) => <article className="directory-item" key={item.id}><div className="patient-avatar">{item.name?.charAt(0).toUpperCase()}</div><div>{renderItem(item)}</div></article>)}</div>}</section>;
}

function PatientForm({ onSubmit }) {
    return <CreateForm title="Add patient" onSubmit={onSubmit} fields={[
        ["name", "Name", "text", true], ["phone", "Phone", "tel", true], ["email", "Email", "email", false], ["date_of_birth", "Date of birth", "date", false]
    ]} />;
}

function DoctorForm({ onSubmit }) {
    return <CreateForm title="Add doctor" onSubmit={onSubmit} fields={[
        ["name", "Name", "text", true], ["specialization", "Specialization", "text", true], ["phone", "Phone", "tel", false], ["email", "Email", "email", false]
    ]} />;
}

function AppointmentForm({ patients, doctors, onSubmit }) {
    const [form, setForm] = useState({ patient_id: "", doctor_id: "", appointment_date: "", appointment_time: "", reason: "" });
    const submit = (event) => { event.preventDefault(); onSubmit(form); setForm({ patient_id: "", doctor_id: "", appointment_date: "", appointment_time: "", reason: "" }); };
    return <form className="create-form" onSubmit={submit}><h3>Add appointment</h3><div className="form-grid"><select required value={form.patient_id} onChange={(event) => setForm({ ...form, patient_id: event.target.value })}><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select><select required value={form.doctor_id} onChange={(event) => setForm({ ...form, doctor_id: event.target.value })}><option value="">Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select><input required type="date" value={form.appointment_date} onChange={(event) => setForm({ ...form, appointment_date: event.target.value })} /><input required type="time" value={form.appointment_time} onChange={(event) => setForm({ ...form, appointment_time: event.target.value })} /><input placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></div><button className="primary-button" type="submit">Add appointment</button></form>;
}

function CreateForm({ title, fields, onSubmit }) {
    const initial = Object.fromEntries(fields.map(([name]) => [name, ""]));
    const [form, setForm] = useState(initial);
    const submit = (event) => { event.preventDefault(); onSubmit(form); setForm(initial); };
    return <form className="create-form" onSubmit={submit}><h3>{title}</h3><div className="form-grid">{fields.map(([name, label, type, required]) => <input key={name} aria-label={label} placeholder={label} type={type} required={required} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />)}</div><button className="primary-button" type="submit">{title}</button></form>;
}

export default Dashboard;
