const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // JWT Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (token) {
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
          console.log('Socket JWT verification failed:', err.message);
          // Allow connection but mark as anonymous
          socket.userId = 'anonymous';
          socket.user = null;
        } else {
          // Authenticated user
          socket.userId = user.userId || user.email;
          socket.user = user;
          console.log(`Authenticated user connected: ${socket.userId}`);
        }
        next();
      });
    } else {
      // No token provided - anonymous user
      socket.userId = 'anonymous';
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (Socket ID: ${socket.id})`);
    
    // Join user-specific room for private messages
    socket.join(socket.userId);
    
    // Handle real-time chat messages
    socket.on('chat_message', async (data) => {
      console.log(`Chat message from ${socket.userId}:`, data.message);
      
      try {
        // Here you would integrate with your RAG service
        // const response = await ragService.processQuery(data.message, socket.userId);
        
        // For now, echo back with user info
        const response = {
          text: `Echo: ${data.message}`,
          timestamp: new Date().toISOString(),
          userId: socket.userId,
          isAuthenticated: !!socket.user
        };
        
        // Send response back to the specific user
        io.to(socket.userId).emit('chat_response', response);
        
      } catch (error) {
        console.error('Socket chat error:', error);
        socket.emit('chat_error', { error: 'Failed to process message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', () => {
      socket.broadcast.to(socket.userId).emit('user_typing', { userId: socket.userId });
    });

    socket.on('typing_stop', () => {
      socket.broadcast.to(socket.userId).emit('user_stopped_typing', { userId: socket.userId });
    });

    // Handle pause/resume for streaming responses
    socket.on('pause_stream', () => {
      socket.emit('stream_paused');
    });

    socket.on('resume_stream', () => {
      socket.emit('stream_resumed');
    });

    // Handle document upload notifications
    socket.on('document_uploaded', (data) => {
      console.log(`Document uploaded by ${socket.userId}:`, data.filename);
      socket.emit('document_processed', {
        message: `Document "${data.filename}" has been processed and is ready for questions!`,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.userId} (${reason})`);
    });
  });

  return io;
}

module.exports = setupSocket;
