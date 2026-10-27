import api from './api';

export interface PermissionRequestPayload {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  requestType?: 'PERMISSION' | 'WFH' | 'LEAVE' | 'WEEK_OFF';
}

export const calculateDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return { decimalHours: 0, formatted: '0 hrs', diffMins: 0 };

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return { decimalHours: 0, formatted: '0 hrs', diffMins: 0 };
  }

  const startTotalMins = startH * 60 + startM;
  const endTotalMins = endH * 60 + endM;

  let diffMins = endTotalMins - startTotalMins;
  if (diffMins < 0) {
    diffMins += 24 * 60;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const decimalHours = Number((diffMins / 60).toFixed(2));

  const parts = [];
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (mins > 0) parts.push(`${mins} min${mins > 1 ? 's' : ''}`);
  const formatted = parts.length > 0 ? parts.join(' ') : '0 mins';

  return { decimalHours, formatted, diffMins };
};

export const submitPermission = async (payload: PermissionRequestPayload, attachment?: File | null) => {
  if (attachment) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value));
    });
    formData.append('attachment', attachment);
    const response = await api.post('/permissions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
  const response = await api.post('/permissions', payload);
  return response.data;
};

export const getMyPermissions = async () => {
  const response = await api.get('/permissions/my');
  return response.data;
};

export const getTeamPermissions = async () => {
  const response = await api.get('/permissions/team');
  return response.data;
};

export const updatePermissionStatus = async (
  id: string,
  payload: { status: 'APPROVED' | 'REJECTED'; managerComment?: string }
) => {
  const response = await api.put(`/permissions/${id}/status`, payload);
  return response.data;
};
