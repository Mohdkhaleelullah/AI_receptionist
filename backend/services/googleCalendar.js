
const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Temporary: use the refresh token from your OAuth connection
oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client
});


// ======================================================
// CREATE CALENDAR EVENT
// ======================================================

async function createCalendarEvent({
    patientName,
    patientPhone,
    doctorName,
    date,
    time,
    reason
}) {

    // Normalize values coming from Supabase
    const appointmentDate = String(date);
    let appointmentTime = String(time);

    // If time is HH:MM, convert it to HH:MM:SS
    if (appointmentTime.length === 5) {
        appointmentTime = `${appointmentTime}:00`;
    }

    // Explicitly use India Standard Time
    const startDateTime =
        `${appointmentDate}T${appointmentTime}+05:30`;

    const start = new Date(startDateTime);

    // Validate date
    if (isNaN(start.getTime())) {
        throw new Error(
            `Invalid time value: ${startDateTime}`
        );
    }

    // Appointment duration = 30 minutes
    const end = new Date(
        start.getTime() + 30 * 60 * 1000
    );

    const event = {
        summary: `Appointment - ${patientName}`,

        description: `
Patient: ${patientName}
Phone: ${patientPhone}
Doctor: ${doctorName}
Reason: ${reason || "Not provided"}
        `.trim(),

        start: {
            dateTime: start.toISOString(),
            timeZone: "Asia/Kolkata"
        },

        end: {
            dateTime: end.toISOString(),
            timeZone: "Asia/Kolkata"
        }
    };

    console.log("Creating Calendar Event:", event);

    const response = await calendar.events.insert({
        calendarId: "primary",
        resource: event
    });

    return response.data;
}


// ======================================================
// DELETE CALENDAR EVENT
// ======================================================

async function deleteCalendarEvent(eventId) {

    if (!eventId) {
        return;
    }

    await calendar.events.delete({
        calendarId: "primary",
        eventId
    });

    console.log(
        `Google Calendar event deleted: ${eventId}`
    );
}


// ======================================================
// UPDATE / RESCHEDULE CALENDAR EVENT
// ======================================================

async function updateCalendarEvent(
    eventId,
    {
        patientName,
        patientPhone,
        doctorName,
        date,
        time,
        reason
    }
) {

    let appointmentTime = String(time);

    // Normalize HH:MM → HH:MM:SS
    if (appointmentTime.length === 5) {
        appointmentTime = `${appointmentTime}:00`;
    }

    // Explicitly use IST
    const startDateTime =
        `${date}T${appointmentTime}+05:30`;

    const start = new Date(startDateTime);

    // Validate date/time
    if (isNaN(start.getTime())) {
        throw new Error(
            `Invalid time value: ${startDateTime}`
        );
    }

    // 30 minute appointment
    const end = new Date(
        start.getTime() + 30 * 60 * 1000
    );

    const event = {
        summary: `Appointment - ${patientName}`,

        description: `
Patient: ${patientName}
Phone: ${patientPhone}
Doctor: ${doctorName}
Reason: ${reason || "Not provided"}
        `.trim(),

        start: {
            dateTime: start.toISOString(),
            timeZone: "Asia/Kolkata"
        },

        end: {
            dateTime: end.toISOString(),
            timeZone: "Asia/Kolkata"
        }
    };

    console.log("Updating Calendar Event:", event);

    const response = await calendar.events.update({
        calendarId: "primary",
        eventId,
        resource: event
    });

    return response.data;
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent
};
