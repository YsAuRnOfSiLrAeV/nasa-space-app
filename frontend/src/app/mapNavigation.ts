import { createContext, useContext } from 'react';
import { INITIAL_MAP_STATE, type MapState } from './route';

/** Shared with document headers so Research can return to the last map state. */
export const MapNavigationContext = createContext<MapState>(INITIAL_MAP_STATE);
export const useMapNavigation = () => useContext(MapNavigationContext);
