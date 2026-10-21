import {
  Dimensions,
  PixelRatio,
} from 'react-native';

const { width, height } = Dimensions.get("window");

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const scale = Math.min(Math.max(width / BASE_WIDTH, 0.85), 1.15);

export const fontSize = (size) => PixelRatio.roundToNearestPixel(size * scale);

export const wp = (size) => (width / BASE_WIDTH) * size;

export const hp = (size) => (height / BASE_HEIGHT) * size;

// export const wp = (percent) => (width * percent) / 100;
// export const hp = (percent) => (height * percent) / 100;