export const getPrefix = (username) => `chartreplay_${username}_`;

export const getStorageItem = (username, key, defaultValue) => {
  if (!username) return defaultValue;
  try {
    const item = localStorage.getItem(getPrefix(username) + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

export const setStorageItem = (username, key, value) => {
  if (!username) return;
  try {
    localStorage.setItem(getPrefix(username) + key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};

export const checkUserExists = (username) => {
  return localStorage.getItem(getPrefix(username) + 'account') !== null;
};
