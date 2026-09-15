
const express = require("express");
const router = express.Router();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const {
    createCalendarEvent
} = require("../services/googleCalendar");


router.post("/appointment", async (req, res) => {
    try {
        const { appointment_id } = req.body;

        // Validate appointment ID
        if (!appointment_id) {
            return res.status(400).json({
                error: "appointment_id is required"
            });
        }

        // Get appointment from Supabase
        const { data: appointment, error } = await supabase
            .from("appointments")
            .select(`
                id,
                appointment_date,
                appointment_time,
                reason,
                google_calendar_event_id,
                patients (
                    name,
                    phone
                ),
                doctors (
                    name,
                    specialization
                )
            `)
            .eq("id", appointment_id)
            .single();

        if (error) {
            console.error("Supabase error:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        if (!appointment) {
            return res.status(404).json({
                error: "Appointment not found"
            });
        }

        // Don't create duplicate Calendar events
        if (appointment.google_calendar_event_id) {
            return res.json({
                success: true,
                message: "Calendar event already exists.",
                event_id: appointment.google_calendar_event_id
            });
        }

        // Validate patient
        if (!appointment.patients) {
            return res.status(400).json({
                error: "Patient information not found."
            });
        }

        // Validate doctor
        if (!appointment.doctors) {
            return res.status(400).json({
                error: "Doctor information not found."
            });
        }

        // Normalize date
        const date = String(appointment.appointment_date);

        // Normalize time
        let time = String(appointment.appointment_time);

        // Make sure time has seconds
        if (time.length === 5) {
            time = `${time}:00`;
        }

        // Validate date/time before sending to Google
        const indiaDateTime = `${date}T${time}+05:30`;

        const testDate = new Date(indiaDateTime);

        if (isNaN(testDate.getTime())) {
            return res.status(400).json({
                error: "Invalid appointment date/time.",
                date,
                time,
                generated_datetime: indiaDateTime
            });
        }

        console.log("Creating Google Calendar event:");
        console.log({
            date,
            time,
            indiaDateTime
        });

        // Create Google Calendar event
        const event = await createCalendarEvent({
            patientName: appointment.patients.name,
            patientPhone: appointment.patients.phone,
            doctorName: appointment.doctors.name,
            date,
            time,
            reason: appointment.reason
        });

        // Save Google Calendar event ID
        const { error: updateError } = await supabase
            .from("appointments")
            .update({
                google_calendar_event_id: event.id
            })
            .eq("id", appointment_id);

        if (updateError) {
            console.error(
                "Failed to save Google Calendar event ID:",
                updateError
            );

            return res.status(500).json({
                error: updateError.message,
                calendar_event_created: true,
                event_id: event.id
            });
        }

        // Success
        res.json({
            success: true,
            message: "Appointment added to Google Calendar.",
            event_id: event.id,
            appointment_id: appointment_id,
            date: date,
            time: time
        });

    } catch (error) {
        console.error("Calendar error:", error);

        res.status(500).json({
            error: error.message
        });
    }
});


module.exports = router;
