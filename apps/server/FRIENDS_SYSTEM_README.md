# Kracken Messenger - Friends System & Mobile Interface

## 🆕 New Features

### 1. Friends System
- **Send Friend Requests**: Users can send friend requests to other users by username
- **Accept/Reject Requests**: Users receive notifications and can accept or reject incoming friend requests
- **Friends List**: View all accepted friends with their online status
- **Direct Messages**: Start private conversations with friends

### 2. Mobile-First Interface
- **Responsive Design**: Optimized for mobile devices with a Discord-like mobile interface
- **Bottom Navigation**: Easy switching between Chat, Friends, and Servers views
- **Touch-Friendly**: Large buttons and touch-optimized interactions
- **Desktop Fallback**: Full desktop interface for larger screens

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- PostgreSQL database
- Existing Kracken Messenger setup

### Installation

1. **Update Database Schema**
   ```bash
   cd apps/server
   node scripts/init-friends-db.js
   ```

2. **Restart Server**
   ```bash
   npm start
   ```

3. **Access the Application**
   - Open in browser: `http://localhost:3000`
   - Test on mobile device or use browser dev tools mobile view

## 📱 Mobile Interface

### Navigation
- **Chat Tab**: Main messaging interface
- **Friends Tab**: Manage friends and friend requests
- **Servers Tab**: Server management

### Friends Management
- **Add Friends**: Tap the + button to send friend requests
- **View Requests**: Switch to "Requests" tab to see incoming requests
- **Accept/Reject**: Tap checkmark or X to respond to requests
- **Direct Message**: Tap the chat icon to start a private conversation

## 🔧 API Endpoints

### Friends System
- `POST /api/friends/send-request` - Send friend request
- `POST /api/friends/respond-request` - Accept/reject friend request
- `GET /api/friends/requests/:userId` - Get pending requests
- `GET /api/friends/list/:userId` - Get friends list

### Socket.IO Events
- `friend_request_sent` - Client notifies server of sent request
- `friend_request_received` - Server notifies client of received request

## 🎨 UI Components

### Mobile Navigation
```css
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--discord-secondary);
  z-index: 1000;
}
```

### Friends List
```css
.friend-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--discord-secondary);
  border-radius: var(--radius-md);
}
```

### Friend Request Modal
```css
.friend-request-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  text-align: center;
}
```

## 📱 Mobile Responsiveness

### Breakpoints
- **Desktop**: `> 768px` - Full Discord-like interface
- **Mobile**: `≤ 768px` - Mobile navigation and views
- **Small Mobile**: `≤ 480px` - Optimized spacing and sizing

### CSS Variables
```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 20px;
  --spacing-xxl: 24px;
}
```

## 🔄 Database Schema

### Friends Table
```sql
CREATE TABLE friends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    friend_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);
```

### Friend Requests Table
```sql
CREATE TABLE friend_requests (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id),
    to_user_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_user_id, to_user_id)
);
```

## 🧪 Testing

### Test Friend Request Flow
1. Create two test users
2. Login as first user
3. Send friend request to second user
4. Login as second user
5. Check for friend request notification
6. Accept/reject the request

### Test Mobile Interface
1. Open browser dev tools
2. Switch to mobile view
3. Test navigation between tabs
4. Verify touch interactions
5. Check responsive behavior

## 🐛 Troubleshooting

### Common Issues

**Friend requests not sending**
- Check database connection
- Verify user authentication
- Check server logs for errors

**Mobile interface not showing**
- Ensure CSS is loaded
- Check viewport meta tag
- Verify JavaScript errors

**Socket.IO connection issues**
- Check server status
- Verify CORS settings
- Check network connectivity

### Debug Mode
Enable debug logging in `app.js`:
```javascript
const socket = io(SERVER_URL, {
  debug: true,
  // ... other options
});
```

## 🔮 Future Enhancements

- [ ] Friend status indicators (online/offline/idle)
- [ ] Friend groups/categories
- [ ] Push notifications for mobile
- [ ] Friend activity feed
- [ ] Block/unblock functionality
- [ ] Friend suggestions

## 📝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is part of Kracken Messenger and follows the same license terms.

---

**Note**: This system is designed to work alongside the existing Kracken Messenger infrastructure. Make sure all dependencies and database connections are properly configured before testing.
