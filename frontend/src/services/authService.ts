import api from './api';

export const login = async (
  email: string, 
  password: string, 
  location?: { latitude?: number; longitude?: number }
) => {
  const payload: any = { email, password };
  if (location && location.latitude !== undefined && location.longitude !== undefined) {
    payload.latitude = location.latitude;
    payload.longitude = location.longitude;
  }
  const response = await api.post('/auth/login', payload);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
  }
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
};


