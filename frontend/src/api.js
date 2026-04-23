import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Helper to standardise responses
const fetchAPI = async (endpoint, params) => {
  try {
    const response = await api.get(endpoint, { params });
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    return response.data.data;
  } catch (error) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
};

export const fetchCandles = (symbol, timeframe) =>
  fetchAPI('/candles', { symbol, timeframe });

export const fetchRSI = (symbol, timeframe, period) =>
  fetchAPI('/indicators/rsi', { symbol, timeframe, period });

export const fetchSMA = (symbol, timeframe, period) =>
  fetchAPI('/indicators/sma', { symbol, timeframe, period });

export const fetchVolume = (symbol, timeframe) =>
  fetchAPI('/indicators/volume', { symbol, timeframe });
