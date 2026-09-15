const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("patients")
            .select("id, name, phone, email, date_of_birth")
            .order("name");

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, phone, email, date_of_birth } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ error: "name and phone are required" });
        }

        const { data, error } = await supabase
            .from("patients")
            .insert([{ name, phone, email: email || null, date_of_birth: date_of_birth || null }])
            .select("id, name, phone, email, date_of_birth")
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Find patient by phone
router.get("/search", async (req, res) => {
    try {
        const { phone } = req.query;

        if (!phone) {
            return res.status(400).json({
                error: "Phone number is required"
            });
        }

        const normalizedPhone = String(phone).trimStart().startsWith("919")
            ? `+${String(phone).trim()}`
            : String(phone).trim();

        const { data, error } = await supabase
            .from("patients")
            .select("id, name, phone, email, date_of_birth")
            .eq("phone", normalizedPhone)
            .single();

        if (error) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        res.json({
            patient: data
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;