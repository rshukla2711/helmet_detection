const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();
const db_url = process.env.DB_URL;
const port=process.env.PORT;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(db_url, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('Database connection opened');
});

// Define a schema and model for your existing data
const detectionSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  time: { type: String, required: true },
  date: { type: String, required: true },
  location: { type: String, required: true },
  source: { type: Number, required: true }
});
const Detection = mongoose.model('Detection', detectionSchema, 'withoutHelmet');

// Function to get all detections sorted by timestamp and location
async function getAllDetectionsSorted() {
  try {
    const detections = await Detection.find().sort({ timestamp: -1, location: 1 });
    return detections;
  } catch (error) {
    console.error('Error fetching sorted detections:', error);
    throw error;
  }
}

// API endpoint to fetch all data
app.get('/api/detections', async (req, res) => {
  try {
    console.log('API endpoint hit: /api/detections');
    const detections = await getAllDetectionsSorted();
    res.json(detections);
  } catch (err) {
    console.error('Error in API endpoint:', err);
    res.status(500).send(err);
  }
});

// Create HTTP server and WebSocket server
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });
console.log(wss)

// Broadcast all detections to all connected clients
async function broadcastDetections() {
  try {
    const detections = await getAllDetectionsSorted();
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(detections));
      }
    });
  } catch (error) {
    console.error('Error broadcasting detections:', error);
  }
}

// Set interval to periodically broadcast updates every second
setInterval(broadcastDetections, 1000); // Adjust interval as needed

wss.on('connection', async (ws) => {
  console.log('Client connected');

  // Send all detections to the connected client
  try {
    const detections = await getAllDetectionsSorted();
    ws.send(JSON.stringify(detections));
  } catch (error) {
    console.error('Error fetching detections for new connection:', error);
    ws.send(JSON.stringify({ error: 'Error fetching detections' }));
  }

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
