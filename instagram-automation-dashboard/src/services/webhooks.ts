import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const postAutomationStatus = (data: any) =>
  axios.post(`${API_BASE_URL}/webhook/automation-status`, data);

export const postContentPublished = (data: any) =>
  axios.post(`${API_BASE_URL}/webhook/content-published`, data);

export const postEngagementUpdate = (data: any) =>
  axios.post(`${API_BASE_URL}/webhook/engagement-update`, data);

export const fetchAnalyticsData = () =>
  axios.get(`${API_BASE_URL}/webhook/analytics-data`); 