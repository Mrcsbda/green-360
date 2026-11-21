import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS } from '@/core/navigation/menu';

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return { width, isMobile: width < BREAKPOINTS.tablet, isWide: width >= BREAKPOINTS.wide };
}
