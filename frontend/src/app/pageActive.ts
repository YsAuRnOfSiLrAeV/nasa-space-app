import { createContext, useContext } from 'react';

/**
 * False while a page is kept mounted but covered by another one (the explorer
 * under Forest Recovery). Animated canvases read it and hold still.
 */
export const PageActiveContext = createContext(true);

export const usePageActive = () => useContext(PageActiveContext);
