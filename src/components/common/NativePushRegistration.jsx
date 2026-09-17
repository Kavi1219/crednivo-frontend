import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isNativePushSupported, registerNativePush, listenForDeviceToken } from '../../services/nativePush';

export default function NativePushRegistration() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePushSupported() || !user) return undefined;

    registerNativePush();
    const cleanup = listenForDeviceToken((path) => navigate(path));
    return cleanup;
  }, [user, navigate]);

  return null;
}
