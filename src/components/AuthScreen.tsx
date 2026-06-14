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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Paper sx={{ 
        p: 4, 
        width: 380, 
        background: '#ffffff', 
        borderRadius: 3,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <Typography variant="h4" sx={{ mb: 1, textAlign: 'center', color: '#333', fontWeight: 'bold' }}>
          🌳 Gia Phả
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: '#888' }}>
          Quản lý gia phả gia đình
        </Typography>
        
        <Box sx={{ display: 'flex', mb: 3, background: '#f5f5f5', borderRadius: 2, p: 0.5 }}>
          <Button 
            fullWidth 
            variant={mode === 'login' ? 'contained' : 'text'}
            onClick={() => setMode('login')}
            sx={{ 
              borderRadius: 1.5,
              color: mode === 'login' ? '#fff' : '#666',
              fontWeight: 'bold',
            }}
          >
            Đăng nhập
          </Button>
          <Button 
            fullWidth 
            variant={mode === 'register' ? 'contained' : 'text'}
            onClick={() => setMode('register')}
            sx={{ 
              borderRadius: 1.5,
              color: mode === 'register' ? '#fff' : '#666',
              fontWeight: 'bold',
            }}
          >
            Đăng ký
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <TextField
              fullWidth
              label="Họ tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              sx={{ mb: 2 }}
              variant="outlined"
            />
          )}
          <TextField
            fullWidth
            label="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            sx={{ mb: 2 }}
            variant="outlined"
          />
          <TextField
            fullWidth
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
            variant="outlined"
          />
          <Button 
            fullWidth 
            type="submit" 
            variant="contained" 
            size="large"
            sx={{ 
              py: 1.5,
              fontWeight: 'bold',
              fontSize: '16px',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
              }
            }}
          >
            {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </Button>
        </form>

        <Typography variant="caption" sx={{ display: 'block', mt: 2, textAlign: 'center', color: '#aaa' }}>
          Demo: demo / demo123
        </Typography>
      </Paper>
    </Box>
  );
};

export default AuthScreen;
