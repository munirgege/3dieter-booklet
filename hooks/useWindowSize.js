import { useState, useLayoutEffect } from 'react';

// SSR renders isMobile=false (no window to check), so the very first client
// render must also be false to match for hydration. useLayoutEffect then
// corrects it synchronously before the browser paints, so mobile users never
// see a frame of the desktop layout - unlike useEffect, which paints first.
const useIsomorphicLayoutEffect =
  typeof window === 'object' ? useLayoutEffect : () => {};

export default function useWindowSize() {
  const isClient = typeof window === 'object';

  const getSize = () => ({
    width: isClient ? window.innerWidth : undefined,
    height: isClient ? window.innerHeight : undefined
  });

  const [windowSize, setWindowSize] = useState(getSize);
  const [isMobile, setIsMobile] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (!isClient) return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');

    const handleMediaChange = event => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);

    mediaQuery.addEventListener('change', handleMediaChange);

    const handleResize = () => {
      setWindowSize(getSize());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return { windowSize, isMobile };
}
