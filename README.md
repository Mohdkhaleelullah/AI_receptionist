# 🏥 Clinic AI — AI-Powered Clinic Receptionist & Appointment Automation

An end-to-end **AI-powered clinic appointment automation system** that allows patients to interact with an AI receptionist, check doctor availability, book appointments, automatically create Google Calendar events, and receive email notifications.

The system combines **AI voice interaction, REST APIs, n8n workflow automation, Supabase, Google Calendar, and Gmail** into a single appointment management workflow.

---

## 🚀 Features

### 🤖 AI Voice Receptionist

* Natural voice-based interaction with patients
* Understands appointment requests
* Identifies the requested doctor
* Collects appointment date and time
* Collects patient information
* Checks doctor availability before booking
* Handles unavailable appointment slots
* Confirms successful bookings

### 📅 Appointment Automation

The system follows a structured booking flow:

```text
Patient Request
      ↓
Find Doctor
      ↓
Check Availability
      ↓
Is Slot Available?
   ↙          ↘
 YES           NO
  ↓             ↓
Book          Suggest
Appointment   Another Time
  ↓
Google Calendar
  ↓
Email Confirmation
```

### 🔍 Doctor & Availability Management

The AI receptionist can:

* Search for doctors by name/specialization
* Retrieve the doctor's unique ID
* Check whether a specific time slot is already booked
* Prevent duplicate bookings
* Continue with booking only when the requested slot is available

### 📧 Email Notifications

Using **n8n + Gmail**, the system can automate:

* Appointment confirmations
* Appointment reminders
* Patient notifications

### 📆 Google Calendar Integration

After a successful appointment:

* A Google Calendar event is created automatically
* Patient and doctor information is included
* Appointment date and time are synchronized with the calendar

### 🖥️ Clinic Admin Dashboard

The dashboard provides an overview of:

* Total appointments
* Confirmed appointments
* Cancelled appointments
* Total patients
* Total doctors
* Appointment dates and times
* Doctor information
* Patient information
* Appointment management

---

# 🛠️ Tech Stack

| Technology              | Purpose                            |
| ----------------------- | ---------------------------------- |
| **React.js**            | Frontend / Admin Dashboard         |
| **Node.js**             | Backend                            |
| **Express.js**          | REST API                           |
| **Supabase**            | Database & backend services        |
| **PostgreSQL**          | Appointment, doctor & patient data |
| **n8n**                 | Workflow automation                |
| **Vapi**                | AI voice receptionist              |
| **Google Calendar API** | Calendar event creation            |
| **Gmail**               | Email notifications & reminders    |
| **Docker**              | Running n8n                        |
| **ngrok**               | Local backend tunneling            |
| **REST APIs**           | Service communication              |

---

# 🏗️ System Architecture

```text
                    ┌──────────────────────┐
                    │       Patient        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Vapi AI Receptionist│
                    │    Voice Assistant    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Node.js Backend   │
                    │      Express API     │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
      ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
      │  Supabase   │   │    n8n      │   │   Doctor    │
      │ PostgreSQL  │   │ Automation  │   │ Availability│
      └─────────────┘   └──────┬──────┘   └─────────────┘
                                │
                     ┌──────────┴──────────┐
                     │                     │
                     ▼                     ▼
             ┌──────────────┐      ┌──────────────┐
             │Google Calendar│      │    Gmail     │
             │     API      │      │ Notifications│
             └──────────────┘      └──────────────┘
```

---

# 📂 Project Structure

```text
clinic-automation/
│
├── backend/
│   ├── routes/
│   │   ├── appointments.js
│   │   ├── patients.js
│   │   ├── doctors.js
│   │   ├── calendar.js
│   │   ├── notifications.js
│   │   ├── tools.js
│   │   ├── whatsapp.js
│   │   └── google.js
│   │
│   ├── services/
│   │
│   ├── server.js
│   ├── .env
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   └── ...
│
└── README.md
```

> `whatsapp.js` is included as part of the backend webhook integration work; the current appointment notification workflow primarily uses **Gmail**.

---

# 🔑 Environment Variables

Create a `.env` file inside the backend directory.

Example:

```env
PORT=5000

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_google_redirect_uri

VAPI_API_KEY=your_vapi_api_key

WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

⚠️ **Never commit `.env` to GitHub.**

Add:

```gitignore
.env
node_modules/
```

to `.gitignore`.

---

# ⚙️ Installation

## 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/clinic-automation.git
```

```bash
cd clinic-automation
```

---

## 2. Install backend dependencies

```bash
cd backend
npm install
```

---

## 3. Configure environment variables

Create:

```text
backend/.env
```

and add your credentials.

---

## 4. Start the backend

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

You should see:

```text
Server running on port 5000
```

---

# 🔄 n8n Setup

n8n is used to orchestrate the appointment workflow.

Example workflow:

```text
Webhook
   ↓
Edit Fields
   ↓
Check Availability
   ↓
IF
 ┌─┴──────────────┐
 │                │
Available       Not Available
 │                │
 ▼                ▼
Book           Suggest
Appointment    Another Time
 │
 ▼
Google Calendar
 │
 ▼
Wait
 │
 ▼
Gmail Reminder
```

### Run n8n with Docker

```bash
docker run -it --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

n8n will be available at:

```text
http://localhost:5678
```

---

# 🧪 Testing the n8n Webhook

For the test webhook:

```text
http://localhost:5678/webhook-test/clinic-test
```

Make sure the Webhook node is listening for a test event.

PowerShell:

```powershell
$body=@{patientName="Rahul Sharma";patientEmail="mohdzakaullah356@gmail.com";phone="9876543210";doctorName="Dr. Ahmed Khan";appointmentDate="2026-09-17";appointmentTime="17:00";reason="Regular checkup"}|ConvertTo-Json;Invoke-RestMethod -Uri "http://localhost:5678/webhook-test/clinic-test" -Method POST -ContentType "application/json" -Body $body
```

---

# 🌐 Local Development with ngrok

For external services such as Vapi, expose the backend:

```bash
ngrok http 5000
```

You'll receive an HTTPS URL such as:

```text
https://your-ngrok-url.ngrok-free.app
```

The backend can then be accessed externally through:

```text
https://your-ngrok-url.ngrok-free.app/api/...
```

---

# 🧠 AI Appointment Flow

The receptionist follows a strict sequence:

```text
Patient:
"I want to book Dr. Ahmed Khan tomorrow at 5 PM."

             ↓

FindDoctor
             ↓
Save doctorId
             ↓
CheckAvailability
             ↓
available = true?
        ↙          ↘
      YES           NO
       ↓             ↓
Collect details   Offer another
       ↓             time
Book Appointment
       ↓
Google Calendar
       ↓
Gmail Confirmation
       ↓
Patient Confirmation
```

This prevents the AI from assuming that a requested slot is available without checking the backend.

---

# 📊 Admin Dashboard

The dashboard provides a centralized view of clinic operations.

Example metrics:

```text
Appointments     10
Confirmed         8
Cancelled         2
Patients          3
Doctors           2
```

It also displays appointment records containing:

* Patient
* Doctor
* Date
* Time
* Status
* Management actions

---

# 🔐 Security Considerations

* Keep API keys in environment variables
* Never commit `.env`
* Never expose Supabase service-role keys on the frontend
* Use HTTPS for production webhooks
* Validate incoming webhook requests
* Restrict database permissions appropriately
* Use authentication for admin functionality
* Rotate exposed credentials immediately

---

# 🔮 Future Improvements

Planned improvements include:

* 💬 Full WhatsApp conversational integration
* 🧠 More advanced AI conversation memory
* 📱 Patient self-service portal
* 🔔 SMS/WhatsApp appointment reminders
* ❌ Appointment cancellation and rescheduling through AI
* 👨‍⚕️ Doctor availability schedules
* 📈 Clinic analytics
* 🔐 Role-based admin access
* ☁️ Production deployment
* 🐳 Containerized backend deployment

---

# 👨‍💻 Project Goal

The goal of **Clinic AI** is to demonstrate how AI agents and workflow automation can be combined with traditional backend systems to automate repetitive administrative tasks in healthcare environments.

Instead of simply providing an AI chatbot, the system allows the AI receptionist to **interact with real backend services and execute an appointment workflow**.

---

## ⭐ If you find this project interesting

Feel free to explore the code, raise issues, or suggest improvements.

**Built with:**
`React` `Node.js` `Express` `Supabase` `PostgreSQL` `n8n` `Vapi` `Google Calendar` `Gmail` `Docker`
