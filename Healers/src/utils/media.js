const YOUR_COMPUTER_IP = '192.168.88.76';

const BASE_URL = `http://${YOUR_COMPUTER_IP}:5000/api`;
const SERVER_ROOT = BASE_URL.replace(/\/api\/?$/, '');

export const getAssetUrl = (relativePath) => {
  if (!relativePath) return null;
  return `${SERVER_ROOT}${relativePath}`;
};