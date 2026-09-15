
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const {
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent
} = require("../services/googleCalendar");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// =====================================================
// GET ALL APPOINTMENTS
// =====================================================

router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("appointments")
            .select(`
                id,
                appointment_date,
                appointment_time,
                status,
                reason,
                patients (
                    id,
                    name,
                    phone
                ),
                doctors (
                    id,
                    name,
                    specialization
                )
            `)
            .order("appointment_date")
            .order("appointment_time");

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        res.json(data);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});


// =====================================================
// CHECK DOCTOR AVAILABILITY
// =====================================================

router.get("/availability", async (req, res) => {
    try {
        const {
            doctor_id,
            date,
            time
        } = req.query;

        if (!doctor_id || !date || !time) {
            return res.status(400).json({
                error: "doctor_id, date and time are required"
            });
        }

        const { data, error } = await supabase
            .from("appointments")
            .select("id")
            .eq("doctor_id", doctor_id)
            .eq("appointment_date", date)
            .eq("appointment_time", time)
            .eq("status", "confirmed");

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        const available = data.length === 0;

        res.json({
            available,
            doctor_id,
            date,
            time
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});


// =====================================================
// BOOK APPOINTMENT
// =====================================================

router.post("/", async (req, res) => {
    try {

        const {
            patient_id,
            doctor_id,
            appointment_date,
            appointment_time,
            reason
        } = req.body;


        // Validate required fields
        if (
            !patient_id ||
            !doctor_id ||
            !appointment_date ||
            !appointment_time
        ) {
            return res.status(400).json({
                error:
                    "patient_id, doctor_id, appointment_date and appointment_time are required"
            });
        }


        // -------------------------------------------------
        // CHECK IF SLOT IS ALREADY BOOKED
        // -------------------------------------------------

        const {
            data: existingAppointment,
            error: checkError
        } = await supabase
            .from("appointments")
            .select("id")
            .eq("doctor_id", doctor_id)
            .eq("appointment_date", appointment_date)
            .eq("appointment_time", appointment_time)
            .eq("status", "confirmed");


        if (checkError) {
            return res.status(500).json({
                error: checkError.message
            });
        }


        if (existingAppointment.length > 0) {
            return res.status(409).json({
                error: "This appointment slot is already booked"
            });
        }


        // -------------------------------------------------
        // CREATE APPOINTMENT IN SUPABASE
        // -------------------------------------------------

        const {
            data,
            error
        } = await supabase
            .from("appointments")
            .insert([
                {
                    patient_id,
                    doctor_id,
                    appointment_date,
                    appointment_time,
                    reason: reason || null,
                    status: "confirmed"
                }
            ])
            .select(`
                id,
                appointment_date,
                appointment_time,
                status,
                reason,
                patients (
                    id,
                    name,
                    phone
                ),
                doctors (
                    id,
                    name,
                    specialization
                )
            `)
            .single();


        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }


        // -------------------------------------------------
        // CREATE GOOGLE CALENDAR EVENT
        // -------------------------------------------------

        try {

            const calendarEvent = await createCalendarEvent({

                patientName: data.patients.name,

                patientPhone: data.patients.phone,

                doctorName: data.doctors.name,

                date: data.appointment_date,

                time: data.appointment_time,

                reason: data.reason

            });

            await supabase
                .from("appointments")
                .update({
                    google_calendar_event_id: calendarEvent.id
                })
                .eq("id", data.id);


            // -------------------------------------------------
            // RETURN SUCCESS
            // -------------------------------------------------

            return res.status(201).json({

                message: "Appointment booked successfully",

                appointment: {
                    ...data,
                    google_calendar_event_id: calendarEvent.id
                }

            });


        } catch (calendarError) {

            console.error(
                "Google Calendar Error:",
                calendarError.message
            );


            // Appointment was created successfully,
            // but calendar synchronization failed.

            return res.status(502).json({

                message:
                    "Appointment booked, but Google Calendar synchronization failed",

                appointment: data,

                calendar: {
                    synced: false
                }

            });

        }

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }
});


// =====================================================
// CANCEL APPOINTMENT
// =====================================================

router.patch("/:id/cancel", async (req, res) => {

    try {

        const { id } = req.params;

        const {
            data: appointment,
            error
        } = await supabase
            .from("appointments")
            .select(`
                *,
                patients (name, phone),
                doctors (name)
            `)
            .eq("id", id)
            .eq("status", "confirmed")
            .single();

        if (error || !appointment) {
            return res.status(404).json({
                error: "Appointment not found"
            });
        }

        if (appointment.google_calendar_event_id) {
            await deleteCalendarEvent(
                appointment.google_calendar_event_id
            );
        }

        const {
            data,
            error: updateError
        } = await supabase
            .from("appointments")
            .update({
                status: "cancelled"
            })
            .eq("id", id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({
                error: updateError.message
            });
        }

        res.json({
            message: "Appointment cancelled successfully",
            appointment: data
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});


// =====================================================
// RESCHEDULE APPOINTMENT
// =====================================================

router.patch("/:id/reschedule", async (req, res) => {

    try {

        const { id } = req.params;

        const {
            new_date,
            new_time
        } = req.body;


        if (!new_date || !new_time) {

            return res.status(400).json({

                error:
                    "new_date and new_time are required"

            });

        }


        // -------------------------------------------------
        // GET CURRENT APPOINTMENT
        // -------------------------------------------------

        const {
            data: appointment,
            error: appointmentError
        } = await supabase
            .from("appointments")
            .select(`
                *,
                patients (name, phone),
                doctors (name)
            `)
            .eq("id", id)
            .eq("status", "confirmed")
            .single();


        if (appointmentError || !appointment) {

            return res.status(404).json({

                error:
                    "Appointment not found"

            });

        }


        // -------------------------------------------------
        // CHECK NEW SLOT
        // -------------------------------------------------

        const {
            data: existing,
            error: checkError
        } = await supabase
            .from("appointments")
            .select("id")
            .eq("doctor_id", appointment.doctor_id)
            .eq("appointment_date", new_date)
            .eq("appointment_time", new_time)
            .eq("status", "confirmed")
            .neq("id", id);


        if (checkError) {

            return res.status(500).json({

                error:
                    checkError.message

            });

        }


        if (existing.length > 0) {

            return res.status(409).json({

                error:
                    "The new appointment slot is already booked"

            });

        }


        // -------------------------------------------------
        // UPDATE APPOINTMENT
        // -------------------------------------------------

        const {
            data,
            error
        } = await supabase
            .from("appointments")
            .update({

                appointment_date:
                    new_date,

                appointment_time:
                    new_time

            })
            .eq("id", id)
            .select()
            .single();


        if (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

        let calendarEvent = null;
        try {
            if (appointment.google_calendar_event_id) {
                calendarEvent = await updateCalendarEvent(
                    appointment.google_calendar_event_id,
                    {
                        patientName: appointment.patients.name,
                        patientPhone: appointment.patients.phone,
                        doctorName: appointment.doctors.name,
                        date: new_date,
                        time: new_time,
                        reason: appointment.reason
                    }
                );
            } else {
                calendarEvent = await createCalendarEvent({
                    patientName: appointment.patients.name,
                    patientPhone: appointment.patients.phone,
                    doctorName: appointment.doctors.name,
                    date: new_date,
                    time: new_time,
                    reason: appointment.reason
                });
            }
        } catch (calendarError) {
            console.error("Google Calendar Error:", calendarError.message);
            return res.status(502).json({
                error: `Appointment was not rescheduled because Google Calendar sync failed: ${calendarError.message}`
            });
        }


        res.json({

            message:
                "Appointment rescheduled successfully",

            appointment: data,
            calendar: {
                synced: true,
                event_id: calendarEvent.id
            }

        });


    } catch (error) {

        res.status(500).json({

            error:
                error.message

        });

    }

});


router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("appointments")
            .select(`
                *,
                patients (
                    id,
                    name,
                    phone,
                    email
                ),
                doctors (
                    id,
                    name,
                    specialization
                )
            `)
            .order("appointment_date", { ascending: true })
            .order("appointment_time", { ascending: true });

        if (error) {
            console.error(error);
            return res.status(500).json({
                error: error.message
            });
        }

        res.json(data);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch appointments"
        });
    }
});

module.exports = router;
