import express from 'express';
import dotenv from 'dotenv';
import { PORT } from './config/env.js';
import connectToDatabase from './database/mongodb.js';
import cors from 'cors';
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import cityRouter from './routes/city.routes.js';
import aqiRouter from './routes/aqi.routes.js';
import http from 'http';
import { initSocket } from './utils/socket.js';
import weatherRouter from './routes/weather.routes.js';
import trafficRouter from './routes/traffic.routes.js';
import sentimentRouter from './routes/sentiment.routes.js';
import cityPulseRouter from './routes/citypulse.routes.js';
import chatRouter from './routes/chat.routes.js';
import incidentRouter from './routes/incident.routes.js';
import alertsRouter from './routes/alerts.routes.js';
import preferencesRouter from './routes/preferences.routes.js';
import './jobs/aqiPoller.js'; // Import the AQI poller to start it when the server runs
import './jobs/weatherPoller.js'; // Import the Weather poller to start it when the server runs
// import './jobs/trafficPoller.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/auth" , authRouter);
app.use("/api/v1/city" , cityRouter);
app.use("/api/v1/users" , userRouter);
app.use("/api/v1/aqi" , aqiRouter);
app.use("/api/v1/weather" , weatherRouter);
app.use("/api/v1/traffic" , trafficRouter);
app.use("/api/v1/sentiment" , sentimentRouter);
app.use("/api/v1/incidents" , incidentRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/preferences', preferencesRouter);
app.use("/api/v1/citypulse" , cityPulseRouter);
app.use("/api/v1/chat" , chatRouter);
app.get('/' , (req, res) => {
    res.send("Welcome to the social media api");
});

// create HTTP server and attach socket.io
const server = http.createServer(app);

const startServer = async () => {
  await connectToDatabase();
  initSocket(server);
  server.listen(PORT, () => {
    console.log(`Listening to server on http://localhost:${PORT}`);
  });
};

startServer();

export default app;
