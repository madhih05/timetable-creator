const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public')); // Serve HTML/CSS/JS
app.use(express.json()); // Parse JSON bodies

const DATA_FILE = path.join(__dirname, 'data', 'school_data.json');

// --- API ROUTES ---

// 1. Get Data
app.get('/api/data', (req, res) => {
    if (!fs.existsSync(DATA_FILE)) {
        // Return default structure if file doesn't exist
        return res.json({ setup: null, allocations: [], grid: {} });
    }
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Error reading data");
        res.json(JSON.parse(data));
    });
});

// 2. Save Data
app.post('/api/save', (req, res) => {
    const newData = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), (err) => {
        if (err) return res.status(500).send("Error saving data");
        res.json({ success: true, message: "Data saved successfully" });
    });
});
// Serve the View-Only page
app.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});
// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});