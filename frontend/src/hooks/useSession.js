import { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem, checkUserExists } from '../utils/localStorage';

export default function useSession() {
  const [username, setUsername] = useState(null);
  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [drawingsMap, setDrawingsMap] = useState({});
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (!username) return;
    setStorageItem(username, 'account', account);
  }, [username, account]);

  useEffect(() => {
    if (!username) return;
    setStorageItem(username, 'trades', trades);
  }, [username, trades]);

  useEffect(() => {
    if (!username) return;
    setStorageItem(username, 'openTrades', openTrades);
  }, [username, openTrades]);
  
  useEffect(() => {
    if (!username) return;
    setStorageItem(username, 'pendingOrders', pendingOrders);
  }, [username, pendingOrders]);

  useEffect(() => {
    if (!username) return;
    setStorageItem(username, 'drawings', drawingsMap);
  }, [username, drawingsMap]);

  useEffect(() => {
    if (!username) return;
    setStorageItem(username, 'settings', settings);
  }, [username, settings]);

  const login = (user, pin, isNew) => {
    if (isNew) {
      if (checkUserExists(user)) {
        return { success: false, message: 'User already exists.' };
      }
      setStorageItem(user, 'pin', pin);
      setUsername(user);
      return { success: true, isNew: true };
    } else {
      if (!checkUserExists(user)) {
        return { success: false, message: 'User not found.' };
      }
      const savedPin = getStorageItem(user, 'pin', '');
      if (savedPin !== pin) {
        return { success: false, message: 'Incorrect PIN.' };
      }
      setUsername(user);
      setAccount(getStorageItem(user, 'account', null));
      setTrades(getStorageItem(user, 'trades', []));
      setOpenTrades(getStorageItem(user, 'openTrades', []));
      setPendingOrders(getStorageItem(user, 'pendingOrders', []));
      setDrawingsMap(getStorageItem(user, 'drawings', {}));
      setSettings(getStorageItem(user, 'settings', {}));
      return { success: true, isNew: false };
    }
  };

  const logout = () => {
    setUsername(null);
    setAccount(null);
    setTrades([]);
    setOpenTrades([]);
    setPendingOrders([]);
    setDrawingsMap({});
    setSettings({});
  };

  const setupAccount = (balance, currency, leverage) => {
    const acc = {
      startingBalance: parseFloat(balance),
      currentBalance: parseFloat(balance),
      currency,
      leverage: parseInt(leverage, 10)
    };
    setAccount(acc);
    setStorageItem(username, 'account', acc);
  };

  const resetAccount = () => {
    if (!account) return;
    const acc = { ...account, currentBalance: account.startingBalance };
    setAccount(acc);
    setTrades([]);
    setOpenTrades([]);
    setPendingOrders([]);
  };

  return {
    username,
    account, setAccount,
    trades, setTrades,
    openTrades, setOpenTrades,
    pendingOrders, setPendingOrders,
    drawingsMap, setDrawingsMap,
    settings, setSettings,
    login, logout, setupAccount, resetAccount
  };
}
