const express = require("express");
const router = express.Router();
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// ============================================================
// HELPER: EXTRACT VAPI TOOL ARGUMENTS
// ============================================================

function getToolArguments(toolCall) {

    // Vapi commonly sends:
    //
    // toolCall.function.arguments
    //
    // Older / alternate formats may send:
    //
    // toolCall.arguments
    // toolCall.parameters

    let args =
        toolCall?.function?.arguments ||
        toolCall?.arguments ||
        toolCall?.parameters ||
        {};

    // Vapi may send arguments as a JSON STRING
    //
    // Example:
    //
    // "{\"doctorId\":\"123\",\"date\":\"2026-09-17\"}"

    if (typeof args === "string") {

        try {
            args = JSON.parse(args);
        } catch (error) {

            console.error(
                "Unable to parse tool arguments:",
                args
            );

            return {};
        }
    }

    return args || {};
}


// ============================================================
// HELPER: NORMALIZE TIME
// ============================================================

function normalizeTime(input) {

    if (!input) {
        return "";
    }

    let time = String(input)
        .trim()
        .toLowerCase();


    // --------------------------------------------------------
    // Already HH:MM:SS
    // --------------------------------------------------------

    if (
        /^\d{2}:\d{2}:\d{2}$/.test(time)
    ) {
        return time;
    }


    // --------------------------------------------------------
    // HH:MM
    // --------------------------------------------------------

    if (
        /^\d{2}:\d{2}$/.test(time)
    ) {
        return `${time}:00`;
    }


    // --------------------------------------------------------
    // 5 PM
    // 5:00 PM
    // 5pm
    // 5:00pm
    // --------------------------------------------------------

    const match =
        time.match(
            /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/
        );


    if (match) {

        let hour =
            parseInt(
                match[1],
                10
            );

        const minute =
            match[2] || "00";

        const ampm =
            match[3];


        if (
            ampm === "pm" &&
            hour !== 12
        ) {
            hour += 12;
        }


        if (
            ampm === "am" &&
            hour === 12
        ) {
            hour = 0;
        }


        return `${String(hour).padStart(2, "0")}:${minute}:00`;
    }


    return time;
}


// ============================================================
// FIND DOCTOR
// ============================================================

router.post("/find-doctor", async (req, res) => {

    try {

        console.log(
            "\n===== VAPI FIND DOCTOR ====="
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );


        const toolCalls =
            req.body
                ?.message
                ?.toolCallList || [];


        if (!toolCalls.length) {

            console.log(
                "No tool calls received."
            );

            return res.status(200).json({
                results: []
            });
        }


        const results = [];


        for (const toolCall of toolCalls) {

            const toolCallId =
                toolCall.id;


            // ------------------------------------------------
            // GET ARGUMENTS
            // ------------------------------------------------

            const args =
                getToolArguments(
                    toolCall
                );


            const name =
                args.name || "";


            let specialization =
                args.specialization || "";


            console.log(
                "Tool Call ID:",
                toolCallId
            );


            console.log(
                "Arguments:",
                args
            );


            // ------------------------------------------------
            // NORMALIZE SPECIALIZATION
            // ------------------------------------------------

            const specializationMap = {

                "cardiology":
                    "Cardiologist",

                "cardiologist":
                    "Cardiologist",

                "heart doctor":
                    "Cardiologist",

                "heart specialist":
                    "Cardiologist",

                "heart":
                    "Cardiologist",


                "dermatology":
                    "Dermatologist",

                "dermatologist":
                    "Dermatologist",

                "skin doctor":
                    "Dermatologist",

                "skin specialist":
                    "Dermatologist",


                "pediatrics":
                    "Pediatrician",

                "pediatric":
                    "Pediatrician",

                "pediatrician":
                    "Pediatrician",

                "child doctor":
                    "Pediatrician",

                "children's doctor":
                    "Pediatrician",


                "orthopedics":
                    "Orthopedic",

                "orthopedic":
                    "Orthopedic",

                "bone doctor":
                    "Orthopedic",

                "bone specialist":
                    "Orthopedic",


                "neurology":
                    "Neurologist",

                "neurologist":
                    "Neurologist",

                "brain doctor":
                    "Neurologist",

                "nerve doctor":
                    "Neurologist",


                "gynecology":
                    "Gynecologist",

                "gynecologist":
                    "Gynecologist",

                "women's doctor":
                    "Gynecologist",

                "womens doctor":
                    "Gynecologist",


                "ent":
                    "ENT Specialist",

                "ent doctor":
                    "ENT Specialist",

                "ear doctor":
                    "ENT Specialist",

                "nose doctor":
                    "ENT Specialist",

                "throat doctor":
                    "ENT Specialist",


                "general medicine":
                    "General Physician",

                "general physician":
                    "General Physician",

                "general doctor":
                    "General Physician",

                "physician":
                    "General Physician",

                "family doctor":
                    "General Physician"
            };


            const normalized =
                String(
                    specialization
                )
                    .toLowerCase()
                    .trim();


            if (
                specializationMap[
                    normalized
                ]
            ) {

                specialization =
                    specializationMap[
                        normalized
                    ];
            }


            console.log(
                "Normalized specialization:",
                specialization
            );


            // ------------------------------------------------
            // SUPABASE QUERY
            // ------------------------------------------------

            let query =
                supabase
                    .from("doctors")
                    .select(
                        "id, name, specialization, phone, email"
                    );


            if (name) {

                query =
                    query.ilike(
                        "name",
                        `%${name}%`
                    );
            }


            if (specialization) {

                query =
                    query.ilike(
                        "specialization",
                        `%${specialization}%`
                    );
            }


            const {
                data,
                error
            } = await query;


            // ------------------------------------------------
            // SUPABASE ERROR
            // ------------------------------------------------

            if (error) {

                console.error(
                    "Supabase error:",
                    error
                );


                results.push({

                    toolCallId,

                    result:
                        JSON.stringify({

                            success: false,

                            message:
                                "Unable to search doctors right now."
                        })
                });


                continue;
            }


            console.log(
                "Doctors found:",
                data
            );


            // ------------------------------------------------
            // NO DOCTOR
            // ------------------------------------------------

            if (
                !data ||
                data.length === 0
            ) {

                results.push({

                    toolCallId,

                    result:
                        JSON.stringify({

                            success: false,

                            message:
                                "No matching doctor was found."
                        })
                });


                continue;
            }


            // ------------------------------------------------
            // SELECT FIRST MATCH
            // ------------------------------------------------

            const doctor =
                data[0];


            console.log(
                "Selected doctor:",
                doctor
            );


            // ------------------------------------------------
            // RETURN DOCTOR
            // ------------------------------------------------

            results.push({

                toolCallId,

                result:
                    JSON.stringify({

                        success: true,

                        doctorId:
                            doctor.id,

                        doctorName:
                            doctor.name,

                        specialization:
                            doctor.specialization,

                        message:
                            `Doctor found. Use doctorId ${doctor.id} for the availability check.`
                    })
            });
        }


        console.log(
            "\n===== FIND DOCTOR RESPONSE ====="
        );


        console.log(
            JSON.stringify(
                { results },
                null,
                2
            )
        );


        return res.status(200).json({
            results
        });


    } catch (error) {

        console.error(
            "VAPI FIND DOCTOR ERROR:",
            error
        );


        return res.status(200).json({

            results: [

                {

                    toolCallId:
                        req.body
                            ?.message
                            ?.toolCallList
                            ?.[0]
                            ?.id ||
                        "unknown",

                    result:
                        JSON.stringify({

                            success: false,

                            message:
                                "There was an error searching for doctors."
                        })
                }
            ]
        });
    }
});



// ============================================================
// CHECK AVAILABILITY
// ============================================================

router.post(
    "/check-availability",
    async (req, res) => {

        try {

            console.log(
                "\n===== VAPI CHECK AVAILABILITY ====="
            );


            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );


            const toolCalls =
                req.body
                    ?.message
                    ?.toolCallList || [];


            if (!toolCalls.length) {

                console.log(
                    "No Vapi tool calls received."
                );


                return res.status(200).json({
                    results: []
                });
            }


            const results = [];


            // ====================================================
            // PROCESS EACH TOOL CALL
            // ====================================================

            for (
                const toolCall
                of toolCalls
            ) {

                const toolCallId =
                    toolCall.id;


                // ------------------------------------------------
                // IMPORTANT:
                // Vapi sends arguments inside:
                //
                // toolCall.function.arguments
                //
                // and arguments are usually a JSON string.
                // ------------------------------------------------

                const args =
                    getToolArguments(
                        toolCall
                    );


                console.log(
                    "Parsed arguments:",
                    args
                );


                // ------------------------------------------------
                // GET VALUES
                // ------------------------------------------------

                let doctorId =
                    args.doctorId ||
                    args.doctor_id ||
                    "";


                let date =
                    args.date ||
                    "";


                let time =
                    args.time ||
                    "";


                // ------------------------------------------------
                // NORMALIZE
                // ------------------------------------------------

                doctorId =
                    String(
                        doctorId
                    ).trim();


                date =
                    String(
                        date
                    ).trim();


                time =
                    normalizeTime(
                        time
                    );


                console.log(
                    "--------------------------------"
                );


                console.log(
                    "Tool Call ID:",
                    toolCallId
                );


                console.log(
                    "Doctor ID:",
                    doctorId
                );


                console.log(
                    "Date:",
                    date
                );


                console.log(
                    "Time:",
                    time
                );


                console.log(
                    "--------------------------------"
                );


                // =================================================
                // VALIDATION
                // =================================================

                if (
                    !doctorId ||
                    !date ||
                    !time
                ) {

                    console.log(
                        "INVALID AVAILABILITY REQUEST"
                    );


                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                available: null,

                                status:
                                    "INVALID_REQUEST",

                                message:
                                    "I could not check availability because the doctor, date, or time was missing.",

                                nextStep:
                                    "Ask the patient only for the missing appointment information. Do not say the appointment is unavailable."
                            })
                    });


                    continue;
                }


                // =================================================
                // VALIDATE DATE FORMAT
                // =================================================

                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(
                        date
                    )
                ) {

                    console.log(
                        "INVALID DATE FORMAT:",
                        date
                    );


                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                available: null,

                                status:
                                    "INVALID_DATE",

                                message:
                                    "The appointment date must be in YYYY-MM-DD format.",

                                receivedDate:
                                    date
                            })
                    });


                    continue;
                }


                // =================================================
                // CHECK DOCTOR EXISTS
                // =================================================

                const {
                    data: doctor,
                    error: doctorError
                } =
                    await supabase
                        .from("doctors")
                        .select(
                            "id, name, specialization"
                        )
                        .eq(
                            "id",
                            doctorId
                        )
                        .maybeSingle();


                if (
                    doctorError
                ) {

                    throw new Error(
                        `Doctor lookup failed: ${doctorError.message}`
                    );
                }


                if (!doctor) {

                    console.log(
                        "Doctor not found:",
                        doctorId
                    );


                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                available: null,

                                status:
                                    "DOCTOR_NOT_FOUND",

                                message:
                                    "The requested doctor could not be found."
                            })
                    });


                    continue;
                }


                // =================================================
                // CHECK APPOINTMENTS
                // =================================================

                const {
                    data: appointments,
                    error:
                        appointmentError
                } =
                    await supabase
                        .from("appointments")
                        .select(
                            "id, patient_id, appointment_date, appointment_time, status"
                        )
                        .eq(
                            "doctor_id",
                            doctorId
                        )
                        .eq(
                            "appointment_date",
                            date
                        )
                        .eq(
                            "appointment_time",
                            time
                        )
                        .eq(
                            "status",
                            "confirmed"
                        );


                if (
                    appointmentError
                ) {

                    throw new Error(
                        `Appointment lookup failed: ${appointmentError.message}`
                    );
                }


                console.log(
                    "Existing appointments:",
                    appointments
                );


                // =================================================
                // DETERMINE AVAILABILITY
                // =================================================

                const available =
                    !appointments ||
                    appointments.length === 0;


                console.log(
                    "FINAL AVAILABILITY:",
                    available
                );


                // =================================================
                // AVAILABLE
                // =================================================

                if (
                    available
                ) {

                    console.log(
                        "SLOT IS AVAILABLE"
                    );


                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: true,

                                available: true,

                                status:
                                    "AVAILABLE",

                                doctorId:
                                    doctor.id,

                                doctorName:
                                    doctor.name,

                                specialization:
                                    doctor.specialization,

                                date:
                                    date,

                                time:
                                    time,

                                message:
                                    `AVAILABLE: ${doctor.name} is available on ${date} at ${time}.`,

                                nextStep:
                                    "Tell the patient that the slot is available. Collect the patient's full name and phone number if needed. Then proceed directly to booking. Do not call checkAvailability again unless the date or time changes."
                            })
                    });

                }


                // =================================================
                // NOT AVAILABLE
                // =================================================

                else {

                    console.log(
                        "SLOT IS BOOKED"
                    );


                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: true,

                                available: false,

                                status:
                                    "BOOKED",

                                doctorId:
                                    doctor.id,

                                doctorName:
                                    doctor.name,

                                specialization:
                                    doctor.specialization,

                                date:
                                    date,

                                time:
                                    time,

                                message:
                                    `NOT AVAILABLE: ${doctor.name} already has an appointment on ${date} at ${time}.`,

                                nextStep:
                                    "Tell the patient that the requested slot is unavailable and offer another date or time."
                            })
                    });
                }
            }


            // =================================================
            // LOG RESPONSE
            // =================================================

            console.log(
                "\n===== VAPI AVAILABILITY RESPONSE ====="
            );


            console.log(
                JSON.stringify(
                    {
                        results
                    },
                    null,
                    2
                )
            );


            // =================================================
            // RETURN TO VAPI
            // =================================================

            return res.status(200).json({
                results
            });


        } catch (error) {

            console.error(
                "\n===== CHECK AVAILABILITY ERROR ====="
            );


            console.error(
                error
            );


            const toolCallId =
                req.body
                    ?.message
                    ?.toolCallList
                    ?.[0]
                    ?.id ||
                "unknown";


            return res.status(200).json({

                results: [

                    {

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                available: null,

                                status:
                                    "ERROR",

                                message:
                                    "There was a technical error while checking availability.",

                                nextStep:
                                    "Tell the patient there was a technical issue. Do not say that the appointment is unavailable."
                            })
                    }
                ]
            });
        }
    }
);

// ============================================================
// BOOK APPOINTMENT
// ============================================================

router.post(
    "/book-appointment",
    async (req, res) => {

        try {

            console.log(
                "\n===== VAPI BOOK APPOINTMENT ====="
            );

            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            const toolCalls =
                req.body
                    ?.message
                    ?.toolCallList || [];

            if (!toolCalls.length) {

                return res.status(200).json({
                    results: []
                });
            }

            const results = [];

            for (const toolCall of toolCalls) {

                const toolCallId =
                    toolCall.id;

                // Get Vapi arguments
                const args =
                    getToolArguments(
                        toolCall
                    );

                console.log(
                    "Parsed booking arguments:",
                    args
                );

                // ====================================================
                // GET VALUES
                // ====================================================

                const patientName =
                    String(
                        args.patientName ||
                        args.patient_name ||
                        args.name ||
                        ""
                    ).trim();

                const patientPhone =
                    String(
                        args.patientPhone ||
                        args.patient_phone ||
                        args.phone ||
                        ""
                    ).trim();

                const patientEmail =
                    String(
                        args.patientEmail ||
                        args.patient_email ||
                        ""
                    ).trim();

                const doctorId =
                    String(
                        args.doctorId ||
                        args.doctor_id ||
                        ""
                    ).trim();

                const date =
                    String(
                        args.date ||
                        ""
                    ).trim();

                const time =
                    normalizeTime(
                        args.time ||
                        ""
                    );

                const reason =
                    String(
                        args.reason ||
                        ""
                    ).trim();

                console.log(
                    "Patient Name:",
                    patientName
                );

                console.log(
                    "Patient Phone:",
                    patientPhone
                );

                console.log(
                    "Doctor ID:",
                    doctorId
                );

                console.log(
                    "Date:",
                    date
                );

                console.log(
                    "Time:",
                    time
                );

                // ====================================================
                // VALIDATION
                // ====================================================

                if (
                    !patientName ||
                    !patientPhone ||
                    !doctorId ||
                    !date ||
                    !time
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                status:
                                    "INVALID_REQUEST",

                                message:
                                    "Patient name, phone number, doctor, date, and time are required."
                            })
                    });

                    continue;
                }

                // ====================================================
                // VALIDATE DATE
                // ====================================================

                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(
                        date
                    )
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                status:
                                    "INVALID_DATE",

                                message:
                                    "The appointment date must be in YYYY-MM-DD format."
                            })
                    });

                    continue;
                }

                // ====================================================
                // CHECK DOCTOR
                // ====================================================

                const {
                    data: doctor,
                    error: doctorError
                } =
                    await supabase
                        .from("doctors")
                        .select(
                            "id, name, specialization"
                        )
                        .eq(
                            "id",
                            doctorId
                        )
                        .maybeSingle();

                if (doctorError) {

                    throw new Error(
                        `Doctor lookup failed: ${doctorError.message}`
                    );
                }

                if (!doctor) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                status:
                                    "DOCTOR_NOT_FOUND",

                                message:
                                    "The requested doctor could not be found."
                            })
                    });

                    continue;
                }

                // ====================================================
                // RE-CHECK AVAILABILITY
                // ====================================================
                //
                // IMPORTANT:
                // Even though Vapi already called CheckAvailability,
                // we check again immediately before booking.
                //
                // This prevents double booking if another patient
                // booked the slot after the first availability check.
                // ====================================================

                const {
                    data: existingAppointments,
                    error:
                        availabilityError
                } =
                    await supabase
                        .from("appointments")
                        .select(
                            "id"
                        )
                        .eq(
                            "doctor_id",
                            doctorId
                        )
                        .eq(
                            "appointment_date",
                            date
                        )
                        .eq(
                            "appointment_time",
                            time
                        )
                        .eq(
                            "status",
                            "confirmed"
                        );

                if (
                    availabilityError
                ) {

                    throw new Error(
                        `Availability check failed: ${availabilityError.message}`
                    );
                }

                if (
                    existingAppointments &&
                    existingAppointments.length > 0
                ) {

                    console.log(
                        "BOOKING BLOCKED - SLOT ALREADY BOOKED"
                    );

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                booked: false,

                                status:
                                    "SLOT_NO_LONGER_AVAILABLE",

                                message:
                                    "The requested appointment slot is no longer available. Please offer the patient another time."
                            })
                    });

                    continue;
                }

                // ====================================================
                // FIND OR CREATE PATIENT
                // ====================================================

                let {
                    data: patient,
                    error: patientSearchError
                } =
                    await supabase
                        .from("patients")
                        .select(
                            "id, name, phone, email"
                        )
                        .eq(
                            "phone",
                            patientPhone
                        )
                        .maybeSingle();

                if (
                    patientSearchError
                ) {

                    throw new Error(
                        `Patient lookup failed: ${patientSearchError.message}`
                    );
                }

                // ====================================================
                // CREATE PATIENT IF NOT FOUND
                // ====================================================

                if (!patient) {

                    console.log(
                        "Patient not found. Creating patient..."
                    );

                    const {
                        data:
                            newPatient,
                        error:
                            createPatientError
                    } =
                        await supabase
                            .from("patients")
                            .insert({

                                name:
                                    patientName,

                                phone:
                                    patientPhone

                            })
                            .select(
                                "id, name, phone, email"
                            )
                            .single();

                    if (
                        createPatientError
                    ) {

                        throw new Error(
                            `Patient creation failed: ${createPatientError.message}`
                        );
                    }

                    patient =
                        newPatient;

                } else {

                    console.log(
                        "Existing patient found:",
                        patient.id
                    );

                    // Update name if needed
                    if (
                        patient.name !==
                        patientName
                    ) {

                        const {
                            data:
                                updatedPatient,
                            error:
                                updatePatientError
                        } =
                            await supabase
                                .from("patients")
                                .update({

                                    name:
                                        patientName

                                })
                                .eq(
                                    "id",
                                    patient.id
                                )
                                .select(
                                    "id, name, phone, email"
                                )
                                .single();

                        if (
                            updatePatientError
                        ) {

                            throw new Error(
                                `Patient update failed: ${updatePatientError.message}`
                            );
                        }

                        patient =
                            updatedPatient;
                    }
                }

                // ====================================================
                // CREATE APPOINTMENT
                // ====================================================

                console.log(
                    "Creating appointment..."
                );

                const {
                    data:
                        appointment,
                    error:
                        appointmentError
                } =
                    await supabase
                        .from("appointments")
                        .insert({

                            patient_id:
                                patient.id,

                            doctor_id:
                                doctor.id,

                            appointment_date:
                                date,

                            appointment_time:
                                time,

                            status:
                                "confirmed",

                            reason:
                                reason ||
                                null

                        })
                        .select(
                            `
                            id,
                            patient_id,
                            doctor_id,
                            appointment_date,
                            appointment_time,
                            status,
                            reason
                            `
                        )
                        .single();

                if (
                    appointmentError
                ) {

                    throw new Error(
                        `Appointment creation failed: ${appointmentError.message}`
                    );
                }

                console.log(
                    "Appointment created:",
                    appointment
                );

                // ====================================================
                // GOOGLE CALENDAR
                // ====================================================

                let calendarEvent = null;

                try {

                    const {
                        createCalendarEvent
                    } =
                        require(
                            "../services/googleCalendar"
                        );

                    calendarEvent =
                        await createCalendarEvent({

                            patientName:
                                patient.name,

                            patientPhone:
                                patient.phone,

                            doctorName:
                                doctor.name,

                            date:
                                date,

                            time:
                                time,

                            reason:
                                reason

                        });

                    console.log(
                        "Google Calendar event created:",
                        calendarEvent.id
                    );

                    // Save Google Calendar event ID
                    const {
                        error:
                            calendarUpdateError
                    } =
                        await supabase
                            .from("appointments")
                            .update({

                                google_calendar_event_id:
                                    calendarEvent.id

                            })
                            .eq(
                                "id",
                                appointment.id
                            );

                    if (
                        calendarUpdateError
                    ) {

                        console.error(
                            "Failed to save Google Calendar event ID:",
                            calendarUpdateError
                        );
                    }

                    try {
                        await axios.post(process.env.N8N_REMINDER_WEBHOOK_URL, {
                            appointmentId: appointment.id,
                            patientName: patient.name,
                            patientEmail: patient.email || patientEmail,
                            phone: patient.phone,
                            doctorName: doctor.name,
                            appointmentDate: date,
                            appointmentTime: time,
                            reason: reason || ""
                        });

                        console.log("Reminder workflow triggered successfully");
                    } catch (error) {
                        console.error(
                            "Failed to trigger reminder workflow:",
                            error.response?.data || error.message
                        );
                    }

                } catch (
                    calendarError
                ) {

                    console.error(
                        "Google Calendar error:",
                        calendarError
                    );

                    // Appointment already exists.
                    // Do NOT tell Vapi that the booking failed.
                    //
                    // The appointment was successfully created in
                    // Supabase, but calendar synchronization failed.

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: true,

                                booked: true,

                                calendarSynced:
                                    false,

                                appointmentId:
                                    appointment.id,

                                doctorId:
                                    doctor.id,

                                doctorName:
                                    doctor.name,

                                specialization:
                                    doctor.specialization,

                                patientId:
                                    patient.id,

                                patientName:
                                    patient.name,

                                date:
                                    date,

                                time:
                                    time,

                                message:
                                    `Appointment booked successfully with ${doctor.name} on ${date} at ${time}. Calendar synchronization could not be completed.`

                            })
                    });

                    continue;
                }

                // ====================================================
                // SUCCESS
                // ====================================================

                results.push({

                    toolCallId,

                    result:
                        JSON.stringify({

                            success: true,

                            booked: true,

                            calendarSynced:
                                true,

                            appointmentId:
                                appointment.id,

                            doctorId:
                                doctor.id,

                            doctorName:
                                doctor.name,

                            specialization:
                                doctor.specialization,

                            patientId:
                                patient.id,

                            patientName:
                                patient.name,

                            patientPhone:
                                patient.phone,

                            date:
                                date,

                            time:
                                time,

                            reason:
                                reason,

                            calendarEventId:
                                calendarEvent.id,

                            message:
                                `Appointment successfully booked for ${patient.name} with ${doctor.name} on ${date} at ${time}.`

                        })
                });
            }

            // ====================================================
            // RETURN RESULT
            // ====================================================

            console.log(
                "\n===== BOOK APPOINTMENT RESPONSE ====="
            );

            console.log(
                JSON.stringify(
                    {
                        results
                    },
                    null,
                    2
                )
            );

            return res.status(200).json({
                results
            });

        } catch (error) {

            console.error(
                "\n===== BOOK APPOINTMENT ERROR ====="
            );

            console.error(
                error
            );

            const toolCallId =
                req.body
                    ?.message
                    ?.toolCallList
                    ?.[0]
                    ?.id ||
                "unknown";

            return res.status(200).json({

                results: [

                    {

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                booked: false,

                                status:
                                    "ERROR",

                                message:
                                    "There was a technical error while booking the appointment. Do not tell the patient that the appointment was booked."

                            })
                    }
                ]
            });
        }
    }
);

// ============================================================
// FIND APPOINTMENT
// ============================================================

router.post(
    "/find-appointment",
    async (req, res) => {

        try {

            console.log(
                "\n===== VAPI FIND APPOINTMENT ====="
            );

            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            const toolCalls =
                req.body
                    ?.message
                    ?.toolCallList || [];

            if (!toolCalls.length) {

                return res.status(200).json({
                    results: []
                });
            }

            const results = [];

            for (const toolCall of toolCalls) {

                const toolCallId =
                    toolCall.id;

                const args =
                    getToolArguments(
                        toolCall
                    );

                console.log(
                    "Parsed appointment arguments:",
                    args
                );

                // ====================================================
                // GET PATIENT INFORMATION
                // ====================================================

                const patientPhone =
                    String(
                        args.patientPhone ||
                        args.patient_phone ||
                        args.phone ||
                        ""
                    ).trim();

                const patientName =
                    String(
                        args.patientName ||
                        args.patient_name ||
                        args.name ||
                        ""
                    ).trim();

                console.log(
                    "Patient Phone:",
                    patientPhone
                );

                console.log(
                    "Patient Name:",
                    patientName
                );

                // ====================================================
                // VALIDATION
                // ====================================================

                if (!patientPhone && !patientName) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                status:
                                    "INVALID_REQUEST",

                                message:
                                    "Patient phone number or full name is required."
                            })
                    });

                    continue;
                }

                // ====================================================
                // FIND PATIENT
                // ====================================================

                let patientQuery =
                    supabase
                        .from("patients")
                        .select(
                            "id, name, phone, email"
                        );

                if (patientPhone) {

                    patientQuery =
                        patientQuery.eq(
                            "phone",
                            patientPhone
                        );

                } else {

                    patientQuery =
                        patientQuery.ilike(
                            "name",
                            `%${patientName}%`
                        );
                }

                const {
                    data: patients,
                    error: patientError
                } =
                    await patientQuery;

                if (patientError) {

                    throw new Error(
                        `Patient lookup failed: ${patientError.message}`
                    );
                }

                if (
                    !patients ||
                    patients.length === 0
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                status:
                                    "PATIENT_NOT_FOUND",

                                message:
                                    "No patient record was found with the provided information."
                            })
                    });

                    continue;
                }

                // ====================================================
                // SELECT PATIENT
                // ====================================================

                const patient =
                    patients[0];

                console.log(
                    "Patient found:",
                    patient
                );

                // ====================================================
                // FIND UPCOMING CONFIRMED APPOINTMENTS
                // ====================================================

                const today =
                    new Date()
                        .toISOString()
                        .split("T")[0];

                const {
                    data: appointments,
                    error:
                        appointmentError
                } =
                    await supabase
                        .from("appointments")
                        .select(
                            `
                            id,
                            patient_id,
                            doctor_id,
                            appointment_date,
                            appointment_time,
                            status,
                            reason,
                            doctors (
                                id,
                                name,
                                specialization
                            )
                            `
                        )
                        .eq(
                            "patient_id",
                            patient.id
                        )
                        .eq(
                            "status",
                            "confirmed"
                        )
                        .gte(
                            "appointment_date",
                            today
                        )
                        .order(
                            "appointment_date",
                            {
                                ascending: true
                            }
                        )
                        .order(
                            "appointment_time",
                            {
                                ascending: true
                            }
                        );

                if (
                    appointmentError
                ) {

                    throw new Error(
                        `Appointment lookup failed: ${appointmentError.message}`
                    );
                }

                console.log(
                    "Upcoming appointments:",
                    appointments
                );

                // ====================================================
                // NO APPOINTMENTS
                // ====================================================

                if (
                    !appointments ||
                    appointments.length === 0
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                status:
                                    "NO_APPOINTMENTS",

                                patientId:
                                    patient.id,

                                patientName:
                                    patient.name,

                                message:
                                    "The patient does not have any upcoming confirmed appointments."
                            })
                    });

                    continue;
                }

                // ====================================================
                // FORMAT APPOINTMENTS
                // ====================================================

                const formattedAppointments =
                    appointments.map(
                        appointment => ({

                            appointmentId:
                                appointment.id,

                            doctorId:
                                appointment.doctor_id,

                            doctorName:
                                appointment
                                    .doctors
                                    ?.name ||
                                "Unknown doctor",

                            specialization:
                                appointment
                                    .doctors
                                    ?.specialization ||
                                "",

                            date:
                                appointment
                                    .appointment_date,

                            time:
                                appointment
                                    .appointment_time,

                            status:
                                appointment.status,

                            reason:
                                appointment.reason

                        })
                    );

                // ====================================================
                // RETURN APPOINTMENTS
                // ====================================================

                results.push({

                    toolCallId,

                    result:
                        JSON.stringify({

                            success: true,

                            patientId:
                                patient.id,

                            patientName:
                                patient.name,

                            patientPhone:
                                patient.phone,

                            appointments:
                                formattedAppointments,

                            message:
                                `Found ${formattedAppointments.length} upcoming confirmed appointment(s) for ${patient.name}.`

                        })
                });
            }

            // ====================================================
            // RESPONSE
            // ====================================================

            console.log(
                "\n===== FIND APPOINTMENT RESPONSE ====="
            );

            console.log(
                JSON.stringify(
                    {
                        results
                    },
                    null,
                    2
                )
            );

            return res.status(200).json({
                results
            });

        } catch (error) {

            console.error(
                "\n===== FIND APPOINTMENT ERROR ====="
            );

            console.error(
                error
            );

            const toolCallId =
                req.body
                    ?.message
                    ?.toolCallList
                    ?.[0]
                    ?.id ||
                "unknown";

            return res.status(200).json({

                results: [

                    {

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                status:
                                    "ERROR",

                                message:
                                    "There was a technical error while finding the appointment."
                            })
                    }
                ]
            });
        }
    }
);


// ============================================================
// CANCEL APPOINTMENT
// ============================================================

router.post(
    "/cancel-appointment",
    async (req, res) => {

        try {

            console.log(
                "\n===== VAPI CANCEL APPOINTMENT ====="
            );

            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            const toolCalls =
                req.body
                    ?.message
                    ?.toolCallList || [];

            if (!toolCalls.length) {

                return res.status(200).json({
                    results: []
                });
            }

            const results = [];

            for (const toolCall of toolCalls) {

                const toolCallId =
                    toolCall.id;

                const args =
                    getToolArguments(
                        toolCall
                    );

                console.log(
                    "Parsed cancellation arguments:",
                    args
                );

                const appointmentId =
                    String(
                        args.appointmentId ||
                        args.appointment_id ||
                        ""
                    ).trim();

                // ====================================================
                // VALIDATION
                // ====================================================

                if (!appointmentId) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                cancelled: false,

                                status:
                                    "INVALID_REQUEST",

                                message:
                                    "Appointment ID is required."
                            })
                    });

                    continue;
                }

                // ====================================================
                // FIND APPOINTMENT
                // ====================================================

                const {
                    data: appointment,
                    error: appointmentError
                } =
                    await supabase
                        .from("appointments")
                        .select(
                            `
                            id,
                            patient_id,
                            doctor_id,
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
                            `
                        )
                        .eq(
                            "id",
                            appointmentId
                        )
                        .maybeSingle();

                if (appointmentError) {

                    throw new Error(
                        `Appointment lookup failed: ${appointmentError.message}`
                    );
                }

                // ====================================================
                // APPOINTMENT NOT FOUND
                // ====================================================

                if (!appointment) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                cancelled: false,

                                status:
                                    "APPOINTMENT_NOT_FOUND",

                                message:
                                    "The requested appointment could not be found."
                            })
                    });

                    continue;
                }

                console.log(
                    "Appointment found:",
                    appointment
                );

                // ====================================================
                // ALREADY CANCELLED
                // ====================================================

                if (
                    appointment.status ===
                    "cancelled"
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                cancelled: false,

                                status:
                                    "ALREADY_CANCELLED",

                                appointmentId:
                                    appointment.id,

                                message:
                                    "This appointment has already been cancelled."
                            })
                    });

                    continue;
                }

                // ====================================================
                // CHECK STATUS
                // ====================================================

                if (
                    appointment.status !==
                    "confirmed"
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                cancelled: false,

                                status:
                                    "INVALID_STATUS",

                                appointmentId:
                                    appointment.id,

                                message:
                                    "This appointment cannot be cancelled because it is not currently confirmed."
                            })
                    });

                    continue;
                }

                // ====================================================
                // DELETE GOOGLE CALENDAR EVENT
                // ====================================================

                if (
                    appointment
                        .google_calendar_event_id
                ) {

                    try {

                        const {
                            deleteCalendarEvent
                        } =
                            require(
                                "../services/googleCalendar"
                            );

                        await deleteCalendarEvent(
                            appointment
                                .google_calendar_event_id
                        );

                        console.log(
                            "Google Calendar event deleted."
                        );

                    } catch (
                        calendarError
                    ) {

                        console.error(
                            "Google Calendar deletion failed:",
                            calendarError
                        );

                        // Do not cancel the database appointment
                        // if calendar deletion failed.

                        results.push({

                            toolCallId,

                            result:
                                JSON.stringify({

                                    success: false,

                                    cancelled: false,

                                    status:
                                        "CALENDAR_ERROR",

                                    appointmentId:
                                        appointment.id,

                                    message:
                                        "The appointment could not be cancelled because the calendar synchronization failed."
                                })
                        });

                        continue;
                    }
                }

                // ====================================================
                // MARK APPOINTMENT AS CANCELLED
                // ====================================================

                const {
                    data:
                        cancelledAppointment,
                    error:
                        cancelError
                } =
                    await supabase
                        .from("appointments")
                        .update({

                            status:
                                "cancelled"

                        })
                        .eq(
                            "id",
                            appointment.id
                        )
                        .select(
                            "id, appointment_date, appointment_time, status"
                        )
                        .single();

                if (cancelError) {

                    throw new Error(
                        `Appointment cancellation failed: ${cancelError.message}`
                    );
                }

                console.log(
                    "Appointment cancelled:",
                    cancelledAppointment
                );

                // ====================================================
                // SUCCESS
                // ====================================================

                results.push({

                    toolCallId,

                    result:
                        JSON.stringify({

                            success: true,

                            cancelled: true,

                            appointmentId:
                                appointment.id,

                            patientName:
                                appointment
                                    .patients
                                    ?.name,

                            patientPhone:
                                appointment
                                    .patients
                                    ?.phone,

                            doctorName:
                                appointment
                                    .doctors
                                    ?.name,

                            specialization:
                                appointment
                                    .doctors
                                    ?.specialization,

                            date:
                                appointment
                                    .appointment_date,

                            time:
                                appointment
                                    .appointment_time,

                            status:
                                "cancelled",

                            message:
                                `Appointment successfully cancelled for ${appointment.patients?.name} with ${appointment.doctors?.name} on ${appointment.appointment_date} at ${appointment.appointment_time}.`

                        })
                });
            }

            // ====================================================
            // RESPONSE
            // ====================================================

            console.log(
                "\n===== CANCEL APPOINTMENT RESPONSE ====="
            );

            console.log(
                JSON.stringify(
                    {
                        results
                    },
                    null,
                    2
                )
            );

            return res.status(200).json({
                results
            });

        } catch (error) {

            console.error(
                "\n===== CANCEL APPOINTMENT ERROR ====="
            );

            console.error(
                error
            );

            const toolCallId =
                req.body
                    ?.message
                    ?.toolCallList
                    ?.[0]
                    ?.id ||
                "unknown";

            return res.status(200).json({

                results: [

                    {

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                cancelled: false,

                                status:
                                    "ERROR",

                                message:
                                    "There was a technical error while cancelling the appointment. Do not tell the patient that the appointment was cancelled."
                            })
                    }
                ]
            });
        }
    }
);



// ============================================================
// RESCHEDULE APPOINTMENT
// ============================================================

router.post(
    "/reschedule-appointment",
    async (req, res) => {

        try {

            console.log(
                "\n===== VAPI RESCHEDULE APPOINTMENT ====="
            );

            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            const toolCalls =
                req.body
                    ?.message
                    ?.toolCallList || [];

            if (!toolCalls.length) {

                return res.status(200).json({
                    results: []
                });
            }

            const results = [];

            for (const toolCall of toolCalls) {

                const toolCallId =
                    toolCall.id;

                const args =
                    getToolArguments(
                        toolCall
                    );

                console.log(
                    "Parsed reschedule arguments:",
                    args
                );

                // ====================================================
                // GET VALUES
                // ====================================================

                const appointmentId =
                    String(
                        args.appointmentId ||
                        args.appointment_id ||
                        ""
                    ).trim();

                const newDate =
                    String(
                        args.newDate ||
                        args.new_date ||
                        ""
                    ).trim();

                const newTime =
                    normalizeTime(
                        args.newTime ||
                        args.new_time ||
                        ""
                    );

                console.log(
                    "Appointment ID:",
                    appointmentId
                );

                console.log(
                    "New Date:",
                    newDate
                );

                console.log(
                    "New Time:",
                    newTime
                );

                // ====================================================
                // VALIDATION
                // ====================================================

                if (
                    !appointmentId ||
                    !newDate ||
                    !newTime
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                rescheduled: false,

                                status:
                                    "INVALID_REQUEST",

                                message:
                                    "Appointment ID, new date, and new time are required."
                            })
                    });

                    continue;
                }

                // ====================================================
                // VALIDATE DATE
                // ====================================================

                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(
                        newDate
                    )
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                rescheduled: false,

                                status:
                                    "INVALID_DATE",

                                message:
                                    "The new appointment date must be in YYYY-MM-DD format."
                            })
                    });

                    continue;
                }

                // ====================================================
                // FIND EXISTING APPOINTMENT
                // ====================================================

                const {
                    data: appointment,
                    error: appointmentError
                } =
                    await supabase
                        .from("appointments")
                        .select(
                            `
                            id,
                            patient_id,
                            doctor_id,
                            appointment_date,
                            appointment_time,
                            status,
                            reason,
                            google_calendar_event_id,
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
                            `
                        )
                        .eq(
                            "id",
                            appointmentId
                        )
                        .maybeSingle();

                if (appointmentError) {

                    throw new Error(
                        `Appointment lookup failed: ${appointmentError.message}`
                    );
                }

                // ====================================================
                // APPOINTMENT NOT FOUND
                // ====================================================

                if (!appointment) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                rescheduled: false,

                                status:
                                    "APPOINTMENT_NOT_FOUND",

                                message:
                                    "The requested appointment could not be found."
                            })
                    });

                    continue;
                }

                // ====================================================
                // CHECK APPOINTMENT STATUS
                // ====================================================

                if (
                    appointment.status !==
                    "confirmed"
                ) {

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                rescheduled: false,

                                status:
                                    "INVALID_STATUS",

                                message:
                                    "Only confirmed appointments can be rescheduled."
                            })
                    });

                    continue;
                }

                // ====================================================
                // CHECK NEW SLOT AVAILABILITY
                // ====================================================

                const {
                    data:
                        conflictingAppointments,
                    error:
                        availabilityError
                } =
                    await supabase
                        .from("appointments")
                        .select(
                            "id"
                        )
                        .eq(
                            "doctor_id",
                            appointment.doctor_id
                        )
                        .eq(
                            "appointment_date",
                            newDate
                        )
                        .eq(
                            "appointment_time",
                            newTime
                        )
                        .eq(
                            "status",
                            "confirmed"
                        )
                        .neq(
                            "id",
                            appointment.id
                        );

                if (availabilityError) {

                    throw new Error(
                        `New slot availability check failed: ${availabilityError.message}`
                    );
                }

                // ====================================================
                // NEW SLOT NOT AVAILABLE
                // ====================================================

                if (
                    conflictingAppointments &&
                    conflictingAppointments.length > 0
                ) {

                    console.log(
                        "NEW SLOT IS ALREADY BOOKED"
                    );

                    results.push({

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                rescheduled: false,

                                status:
                                    "NEW_SLOT_BOOKED",

                                appointmentId:
                                    appointment.id,

                                doctorName:
                                    appointment
                                        .doctors
                                        ?.name,

                                newDate:
                                    newDate,

                                newTime:
                                    newTime,

                                message:
                                    `The new slot on ${newDate} at ${newTime} is already booked. Offer the patient another time.`
                            })
                    });

                    continue;
                }

                // ====================================================
                // UPDATE DATABASE APPOINTMENT
                // ====================================================

                console.log(
                    "Updating appointment..."
                );

                const {
                    data:
                        updatedAppointment,
                    error:
                        updateError
                } =
                    await supabase
                        .from("appointments")
                        .update({

                            appointment_date:
                                newDate,

                            appointment_time:
                                newTime

                        })
                        .eq(
                            "id",
                            appointment.id
                        )
                        .select(
                            `
                            id,
                            patient_id,
                            doctor_id,
                            appointment_date,
                            appointment_time,
                            status,
                            reason,
                            google_calendar_event_id
                            `
                        )
                        .single();

                if (updateError) {

                    throw new Error(
                        `Appointment update failed: ${updateError.message}`
                    );
                }

                console.log(
                    "Appointment updated:",
                    updatedAppointment
                );

                // ====================================================
                // UPDATE GOOGLE CALENDAR
                // ====================================================

                let calendarSynced =
                    false;

                if (
                    appointment
                        .google_calendar_event_id
                ) {

                    try {

                        const {
                            updateCalendarEvent
                        } =
                            require(
                                "../services/googleCalendar"
                            );

                        await updateCalendarEvent(

                            appointment
                                .google_calendar_event_id,

                            {

                                patientName:
                                    appointment
                                        .patients
                                        ?.name,

                                patientPhone:
                                    appointment
                                        .patients
                                        ?.phone,

                                doctorName:
                                    appointment
                                        .doctors
                                        ?.name,

                                date:
                                    newDate,

                                time:
                                    newTime,

                                reason:
                                    appointment.reason

                            }
                        );

                        calendarSynced =
                            true;

                        console.log(
                            "Google Calendar event updated."
                        );

                        // ====================================================
                        // TRIGGER NEW REMINDER WORKFLOW
                        // ====================================================

                        try {
                            const patientEmail = appointment.patients?.email || "";

                            await axios.post(process.env.N8N_REMINDER_WEBHOOK_URL, {
                                appointmentId: appointment.id,
                                patientName: appointment.patients?.name,
                                patientEmail,
                                phone: appointment.patients?.phone,
                                doctorName: appointment.doctors?.name,
                                appointmentDate: newDate,
                                appointmentTime: newTime,
                                reason: appointment.reason || ""
                            });

                            console.log("New reminder workflow triggered successfully");

                        } catch (error) {
                            console.error(
                                "Failed to trigger new reminder workflow:",
                                error.response?.data || error.message
                            );
                        }

                    } catch (
                        calendarError
                    ) {

                        console.error(
                            "Google Calendar update failed:",
                            calendarError
                        );

                        // Roll database appointment back
                        // because calendar synchronization failed.

                        await supabase
                            .from("appointments")
                            .update({

                                appointment_date:
                                    appointment
                                        .appointment_date,

                                appointment_time:
                                    appointment
                                        .appointment_time

                            })
                            .eq(
                                "id",
                                appointment.id
                            );

                        results.push({

                            toolCallId,

                            result:
                                JSON.stringify({

                                    success: false,

                                    rescheduled: false,

                                    status:
                                        "CALENDAR_ERROR",

                                    appointmentId:
                                        appointment.id,

                                    message:
                                        "The appointment could not be rescheduled because the calendar synchronization failed."
                                })
                        });

                        continue;
                    }

                } else {

                    // No Calendar event exists.
                    // Database update was successful.

                    console.log(
                        "No Google Calendar event associated with appointment."
                    );
                }

                // ====================================================
                // SUCCESS
                // ====================================================

                results.push({

                    toolCallId,

                    result:
                        JSON.stringify({

                            success: true,

                            rescheduled: true,

                            calendarSynced:
                                calendarSynced,

                            appointmentId:
                                appointment.id,

                            patientId:
                                appointment.patient_id,

                            patientName:
                                appointment
                                    .patients
                                    ?.name,

                            patientPhone:
                                appointment
                                    .patients
                                    ?.phone,

                            doctorId:
                                appointment.doctor_id,

                            doctorName:
                                appointment
                                    .doctors
                                    ?.name,

                            specialization:
                                appointment
                                    .doctors
                                    ?.specialization,

                            oldDate:
                                appointment
                                    .appointment_date,

                            oldTime:
                                appointment
                                    .appointment_time,

                            newDate:
                                newDate,

                            newTime:
                                newTime,

                            status:
                                "confirmed",

                            message:
                                `Appointment successfully rescheduled for ${appointment.patients?.name} with ${appointment.doctors?.name} to ${newDate} at ${newTime}.`

                        })
                });
            }

            // ====================================================
            // RESPONSE
            // ====================================================

            console.log(
                "\n===== RESCHEDULE APPOINTMENT RESPONSE ====="
            );

            console.log(
                JSON.stringify(
                    {
                        results
                    },
                    null,
                    2
                )
            );

            return res.status(200).json({
                results
            });

        } catch (error) {

            console.error(
                "\n===== RESCHEDULE APPOINTMENT ERROR ====="
            );

            console.error(
                error
            );

            const toolCallId =
                req.body
                    ?.message
                    ?.toolCallList
                    ?.[0]
                    ?.id ||
                "unknown";

            return res.status(200).json({

                results: [

                    {

                        toolCallId,

                        result:
                            JSON.stringify({

                                success: false,

                                rescheduled: false,

                                status:
                                    "ERROR",

                                message:
                                    "There was a technical error while rescheduling the appointment. Do not tell the patient that the appointment was rescheduled."
                            })
                    }
                ]
            });
        }
    }
);


// ============================================================
// MODULE EXPORT
// ============================================================

module.exports = router;