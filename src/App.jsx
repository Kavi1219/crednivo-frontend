import AppRoutes from './routes/AppRoutes';
import NativeAppController from './components/common/NativeAppController';
import NativeAppLock from './components/common/NativeAppLock';
import NativePushRegistration from './components/common/NativePushRegistration';
import UpdateWatcher from './components/common/UpdateWatcher';

export default function App() {
  return (
    <>
      <UpdateWatcher />
      <NativeAppController />
      <AppRoutes />
      <NativeAppLock />
      <NativePushRegistration />
    </>
  );
}
