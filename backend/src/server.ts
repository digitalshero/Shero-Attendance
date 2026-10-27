import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectPostgres } from './db';
import authRoutes from './routes/auth';
import attendanceRoutes from './routes/attendance';
import adminRoutes from './routes/admin';
import permissionRoutes from './routes/permission';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Bind to localhost only: on a shared server this must sit behind Nginx, never reachable directly.
const HOST = process.env.HOST || '127.0.0.1';

const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;

app.use(cors({
  origin: frontendUrl 
    ? [frontendUrl, 'http://localhost:5173', 'http://localhost:3000', /\.vercel\.app$/] 
    : '*',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health Check
app.get('/', (req, res) => {
  res.json({ message: 'Shero Attendance API is running', status: 'healthy', timestamp: new Date() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/permissions', permissionRoutes);

// Basic error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const startServer = async () => {
  try {
    await connectPostgres();
    app.listen(Number(PORT), HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

