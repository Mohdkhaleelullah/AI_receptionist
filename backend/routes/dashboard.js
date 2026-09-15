const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get("/stats", async (req, res) => {
    try {
        const [appointments, confirmed, cancelled, patients, doctors] =
            await Promise.all([
                supabase.from("appointments").select("id", { count: "exact", head: true }),
                supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
                supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
                supabase.from("patients").select("id", { count: "exact", head: true }),
                supabase.from("doctors").select("id", { count: "exact", head: true })
            ]);

        const failedQuery = [appointments, confirmed, cancelled, patients, doctors]
            .find((result) => result.error);

        if (failedQuery) {
            return res.status(500).json({ error: failedQuery.error.message });
        }

        res.json({
            appointments: appointments.count || 0,
            confirmed: confirmed.count || 0,
            cancelled: cancelled.count || 0,
            patients: patients.count || 0,
            doctors: doctors.count || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;