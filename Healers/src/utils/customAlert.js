import { Alert } from 'react-native';

let listener = null;
let installed = false;
const nativeAlert = Alert.alert.bind(Alert);

export const registerAlertHost = (fn) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};

export const installCustomAlert = () => {
  if (installed) return;
  installed = true;

  Alert.alert = (title, message, buttons, options) => {
    // fall back to the native alert if the host isn't mounted yet
    if (!listener) return nativeAlert(title, message, buttons, options);
    listener({ title, message, buttons, options });
  };
};