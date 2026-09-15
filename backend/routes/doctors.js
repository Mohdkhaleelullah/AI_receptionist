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
            .from("doctors")
            .select("id, name, specialization, phone, email")
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
        const { name, specialization, phone, email } = req.body;

        if (!name || !specialization) {
            return res.status(400).json({ error: "name and specialization are required" });
        }

        const { data, error } = await supabase
            .from("doctors")
            .insert([{ name, specialization, phone: phone || null, email: email || null }])
            .select("id, name, specialization, phone, email")
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search doctor
router.get("/search", async (req, res) => {
    try {
        const { name, specialization } = req.query;

        if (!name && !specialization) {
            return res.status(400).json({
                error: "Provide doctor name or specialization"
            });
        }

        let query = supabase
            .from("doctors")
            .select(`
                id,
                name,
                specialization,
                phone,
                email
            `);

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
            return res.status(500).json({
                error: error.message
            });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                error: "Doctor not found"
            });
        }

        res.json({
            doctors: data
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;