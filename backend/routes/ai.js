const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require("@supabase/supabase-js");
const {
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent
} = require("../services/googleCalendar");

const router = express.Router();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findDoctor(name, specialization) {
    let query = supabase
        .from("doctors")
        .select("id, name, specialization");

    if (name) {
        query = query.ilike("name", `%${name}%`);
    }

    if (specialization) {
        query = query.ilike(
            "specialization",
            `%${specialization}%`
        );
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

async function checkAvailability(
    doctorId,
    date,
    time
) {
    const { data, error } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", date)
        .eq("appointment_time", time)
        .eq("status", "confirmed");

    if (error) {
        throw new Error(error.message);
    }

    return {
        available: data.length === 0,
        doctor_id: doctorId,
        date,
        time
    };
}

async function findPatient(name, phone) {
    let query = supabase
        .from("patients")
        .select("id, name, phone, email, date_of_birth");

    if (phone) {
        query = query.eq("phone", phone);
    } else if (name) {
        query = query.ilike("name", `%${name}%`);
    } else {
        return {
            found: false,
            message: "Please provide the patient's name or phone number."
        };
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        return {
            found: false,
            message: "Patient not found."
        };
    }

    return {
        found: true,
        patient: data
    };
}

async function bookAppointment(
    patientId,
    doctorId,
    date,
    time,
    reason
) {
    // First check whether slot is already booked
    const { data: existing, error: checkError } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", date)
        .eq("appointment_time", time)
        .eq("status", "confirmed");

    if (checkError) {
        throw new Error(checkError.message);
    }

    if (existing.length > 0) {
        return {
            success: false,
            message: "This appointment slot is already booked."
        };
    }

    // Create appointment
    const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
            patient_id: patientId,
            doctor_id: doctorId,
            appointment_date: date,
            appointment_time: time,
            reason: reason || "General consultation",
            status: "confirmed"
        })
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
        throw new Error(error.message);
    }

    const calendarEvent = await createCalendarEvent({
        patientName: appointment.patients.name,
        patientPhone: appointment.patients.phone,
        doctorName: appointment.doctors.name,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time,
        reason: appointment.reason
    });

    await supabase
        .from("appointments")
        .update({
            google_calendar_event_id: calendarEvent.id
        })
        .eq("id", appointment.id);

    return {
        success: true,
        appointment,
        google_calendar_event_id: calendarEvent.id
    };
}

async function findAppointment(patientId, doctorId, date) {
    let query = supabase
        .from("appointments")
        .select(`
            id,
            appointment_date,
            appointment_time,
            status,
            reason,
            google_calendar_event_id,
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
        .eq("status", "confirmed");

    if (patientId) {
        query = query.eq("patient_id", patientId);
    }

    if (doctorId) {
        query = query.eq("doctor_id", doctorId);
    }

    if (date) {
        query = query.eq("appointment_date", date);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return {
        found: data.length > 0,
        appointments: data
    };
}

async function rescheduleAppointment(
    appointmentId,
    newDate,
    newTime
) {
    // Get existing appointment
    const { data: appointment, error: fetchError } = await supabase
        .from("appointments")
        .select(`
            id,
            patient_id,
            doctor_id,
            appointment_date,
            appointment_time,
            status,
            google_calendar_event_id,
            reason,
            patients (
                name,
                phone
            ),
            doctors (
                name,
                specialization
            )
        `)
        .eq("id", appointmentId)
        .single();

    if (fetchError || !appointment) {
        return {
            success: false,
            message: "Appointment not found."
        };
    }

    if (appointment.status !== "confirmed") {
        return {
            success: false,
            message: "Only confirmed appointments can be rescheduled."
        };
    }

    // Check new slot
    const { data: existing, error: availabilityError } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", appointment.doctor_id)
        .eq("appointment_date", newDate)
        .eq("appointment_time", newTime)
        .eq("status", "confirmed")
        .neq("id", appointmentId);

    if (availabilityError) {
        throw new Error(availabilityError.message);
    }

    if (existing.length > 0) {
        return {
            success: false,
            message: "The new time slot is already booked."
        };
    }

    // Update Supabase
    const { data: updated, error: updateError } = await supabase
        .from("appointments")
        .update({
            appointment_date: newDate,
            appointment_time: newTime
        })
        .eq("id", appointmentId)
        .select()
        .single();

    if (updateError) {
        throw new Error(updateError.message);
    }

    // Update Google Calendar
    if (appointment.google_calendar_event_id) {
        await updateCalendarEvent(
            appointment.google_calendar_event_id,
            {
                patientName: appointment.patients.name,
                patientPhone: appointment.patients.phone,
                doctorName: appointment.doctors.name,
                date: newDate,
                time: newTime,
                reason: appointment.reason
            }
        );
    }

    return {
        success: true,
        message: "Appointment rescheduled successfully.",
        appointment: updated
    };
}

async function cancelAppointment(appointmentId) {
    // Get appointment
    const { data: appointment, error: fetchError } = await supabase
        .from("appointments")
        .select("id, status, google_calendar_event_id")
        .eq("id", appointmentId)
        .single();

    if (fetchError || !appointment) {
        return {
            success: false,
            message: "Appointment not found."
        };
    }

    if (appointment.status === "cancelled") {
        return {
            success: false,
            message: "This appointment is already cancelled."
        };
    }

    // Delete Google Calendar event
    if (appointment.google_calendar_event_id) {
        await deleteCalendarEvent(
            appointment.google_calendar_event_id
        );
    }

    // Update Supabase
    const { error: updateError } = await supabase
        .from("appointments")
        .update({
            status: "cancelled"
        })
        .eq("id", appointmentId);

    if (updateError) {
        throw new Error(updateError.message);
    }

    return {
        success: true,
        message: "Appointment cancelled successfully.",
        appointment_id: appointmentId
    };
}

const tools = [
    {
        functionDeclarations: [
            {
                name: "findDoctor",
                description:
                    "Find doctors by name or medical specialization.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: {
                            type: "STRING",
                            description:
                                "Doctor's name, if provided."
                        },
                        specialization: {
                            type: "STRING",
                            description:
                                "Medical specialization, if provided."
                        }
                    }
                }
            },
            {
                name: "checkAvailability",
                description:
                    "Check whether a doctor is available for an appointment at a specific date and time.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        doctorId: {
                            type: "STRING",
                            description: "The doctor's UUID."
                        },
                        date: {
                            type: "STRING",
                            description:
                                "Appointment date in YYYY-MM-DD format."
                        },
                        time: {
                            type: "STRING",
                            description:
                                "Appointment time in HH:MM:SS format."
                        }
                    },
                    required: [
                        "doctorId",
                        "date",
                        "time"
                    ]
                }
            },
            {
                name: "findPatient",
                description:
                    "Find an existing patient using their name or phone number.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: {
                            type: "STRING",
                            description: "Patient's full name."
                        },
                        phone: {
                            type: "STRING",
                            description: "Patient's phone number."
                        }
                    }
                }
            },
            {
                name: "bookAppointment",
                description:
                    "Book an appointment for an existing patient with a doctor after confirming the date and time.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        patientId: {
                            type: "STRING",
                            description: "The patient's UUID."
                        },
                        doctorId: {
                            type: "STRING",
                            description: "The doctor's UUID."
                        },
                        date: {
                            type: "STRING",
                            description:
                                "Appointment date in YYYY-MM-DD format."
                        },
                        time: {
                            type: "STRING",
                            description:
                                "Appointment time in HH:MM:SS format."
                        },
                        reason: {
                            type: "STRING",
                            description: "Reason for the appointment."
                        }
                    },
                    required: [
                        "patientId",
                        "doctorId",
                        "date",
                        "time"
                    ]
                },
            },
            {
                name: "findAppointment",
                description:
                    "Find confirmed appointments using patient, doctor, and/or appointment date.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        patientId: {
                            type: "STRING",
                            description: "The patient's UUID."
                        },
                        doctorId: {
                            type: "STRING",
                            description: "The doctor's UUID."
                        },
                        date: {
                            type: "STRING",
                            description:
                                "Appointment date in YYYY-MM-DD format."
                        }
                    }
                }
            },
            {
                name: "rescheduleAppointment",
                description:
                    "Reschedule an existing confirmed appointment to a new available date and time.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        appointmentId: {
                            type: "STRING",
                            description: "The appointment UUID."
                        },
                        newDate: {
                            type: "STRING",
                            description:
                                "New appointment date in YYYY-MM-DD format."
                        },
                        newTime: {
                            type: "STRING",
                            description:
                                "New appointment time in HH:MM:SS format."
                        }
                    },
                    required: [
                        "appointmentId",
                        "newDate",
                        "newTime"
                    ]
                }
            },
            {
                name: "cancelAppointment",
                description:
                    "Cancel an existing appointment using its appointment ID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        appointmentId: {
                            type: "STRING",
                            description: "The appointment UUID."
                        }
                    },
                    required: ["appointmentId"]
                }
            }
        ]
    }
];

router.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                error: "Message is required"
            });
        }

        let contents = [
            {
                role: "user",
                parts: [
                    {
                        text: message
                    }
                ]
            }
        ];

        const systemInstruction = `
    You are an AI receptionist for a medical clinic.

    Your responsibilities:
    - Help patients find doctors.
    - Help patients book appointments.
    - Help patients cancel appointments.
    - Help patients reschedule appointments.

    Rules:

    1. Never invent doctor or patient information.
    2. Use findDoctor() to find doctors.
    3. Use findPatient() to find existing patients.
    4. Before booking, ALWAYS use checkAvailability().
    5. NEVER book an appointment without checking availability first.
    6. Only use bookAppointment() after the doctor, patient, date and time are known.
    7. If required information is missing, ask the patient for it.
    8. If a slot is unavailable, tell the patient and ask for another time.
    9. After successful booking, clearly confirm the doctor, date and time.
    10. Do not provide medical diagnosis or medical treatment advice.
    `;

        const config = {
            tools,
            systemInstruction
        };

        // Keep calling Gemini until it has no more tools to call
        while (true) {

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents,
                config
            });

            const functionCalls = response.functionCalls;

            // Gemini has finished using tools
            if (!functionCalls || functionCalls.length === 0) {
                return res.json({
                    response: response.text
                });
            }

            const functionResponses = [];

            for (const call of functionCalls) {

                console.log("Gemini called tool:", call.name);
                console.log("Arguments:", call.args);

                if (call.name === "findDoctor") {

                    const result = await findDoctor(
                        call.args?.name,
                        call.args?.specialization
                    );

                    console.log("findDoctor result:", result);

                    functionResponses.push({
                        name: call.name,
                        response: {
                            doctors: result
                        }
                    });
                }

                if (call.name === "checkAvailability") {

                    const result = await checkAvailability(
                        call.args?.doctorId,
                        call.args?.date,
                        call.args?.time
                    );

                    console.log(
                        "checkAvailability result:",
                        result
                    );

                    functionResponses.push({
                        name: call.name,
                        response: result
                    });
                }

                if (call.name === "findPatient") {
                    const result = await findPatient(
                        call.args?.name,
                        call.args?.phone
                    );

                    functionResponses.push({
                        name: call.name,
                        response: result
                    });
                }

                if (call.name === "bookAppointment") {
                    const result = await bookAppointment(
                        call.args?.patientId,
                        call.args?.doctorId,
                        call.args?.date,
                        call.args?.time,
                        call.args?.reason
                    );

                    functionResponses.push({
                        name: call.name,
                        response: result
                    });
                }

                if (call.name === "findAppointment") {
                    const result = await findAppointment(
                        call.args?.patientId,
                        call.args?.doctorId,
                        call.args?.date
                    );

                    functionResponses.push({
                        name: call.name,
                        response: result
                    });
                }

                if (call.name === "rescheduleAppointment") {
                    const result = await rescheduleAppointment(
                        call.args?.appointmentId,
                        call.args?.newDate,
                        call.args?.newTime
                    );

                    functionResponses.push({
                        name: call.name,
                        response: result
                    });
                }

                if (call.name === "cancelAppointment") {
                    const result = await cancelAppointment(
                        call.args?.appointmentId
                    );

                    functionResponses.push({
                        name: call.name,
                        response: result
                    });
                }
            }

            // Add Gemini's tool call to conversation
            contents.push(response.candidates[0].content);

            // Add tool results
            contents.push({
                role: "user",
                parts: functionResponses.map((result) => ({
                    functionResponse: {
                        name: result.name,
                        response: result.response
                    }
                }))
            });

            // Loop continues
            // Gemini can now call another tool
        }

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;