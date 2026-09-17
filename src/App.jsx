import AppRoutes from './routes/AppRoutes';
import NativeAppController from './components/common/NativeAppController';
import NativeAppLock from './components/common/NativeAppLock';
import NativePushRegistration from './components/common/NativePushRegistration';

export default function App() {
  return (
    <>
      <NativeAppController />
      <AppRoutes />
      <NativeAppLock />
      <NativePushRegistration />
    </>
  );
}
