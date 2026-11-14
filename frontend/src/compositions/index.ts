import type { ComponentType } from 'react';
import type { ThemeId } from '@/theme/themes';
import { EarthIntelligenceComposition } from './earth-intelligence/EarthIntelligenceComposition';
import type { CompositionProps } from './types';

/**
 * Layout composition per theme. Earth Intelligence is the only active one;
 * archived compositions (archive/) take the same props and can be registered here again.
 */
export const COMPOSITIONS: Record<ThemeId, ComponentType<CompositionProps>> = {
  'earth-intelligence': EarthIntelligenceComposition,
};
