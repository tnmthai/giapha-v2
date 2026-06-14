import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert } from '@mui/material';

interface AuthScreenProps {
  onAuth: (user: any, token: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuth }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const url = mode === 'login' ? '/api/login' : '/api/register';
    const body = mode === 'login' 
      ? { username, password }
      : { username, password, full_name: fullName };
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Error');
        return;
      }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onAuth(data.user, data.token);
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#0a0a0a'
    }}>
      <Paper sx={{ p: 4, width: 360, background: '#1a1a1a', borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, textAlign: 'center', color: '#4a9eff' }}>
          🌳 Gia Phả
        </Typography>
        
        <Box sx={{ display: 'flex', mb: 2 }}>
          <Button 
            fullWidth 
            variant={mode === 'login' ? 'contained' : 'outlined'}
            onClick={() => setMode('login')}
            sx={{ mr: 1 }}
          >
            Đăng nhập
          </Button>
          <Button 
            fullWidth 
            variant={mode === 'register' ? 'contained' : 'outlined'}
            onClick={() => setMode('register')}
          >
            Đăng ký
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <TextField
              fullWidth
              label="Họ tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}
          <TextField
            fullWidth
            label="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
          />
          <Button fullWidth type="submit" variant="contained" size="large">
            {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default AuthScreen;
