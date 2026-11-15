import { PageIntro, PageLayout } from '@/components/shell/PageLayout';
import { ForestGrowthExplorer } from './ForestGrowthExplorer';

/**
 * Forest growth in 3D: an illustration of a stand at a fire's modeled recovery.
 * Lazily loaded, so Three.js is fetched only when this page opens; nothing in the
 * explorer or the map depends on it (see docs/forest-3d.md to remove it).
 * Reached at #/research/forest-3d.
 */
export function Forest3DPage() {
  return (
    <PageLayout section="research">
      <PageIntro eyebrow="Research · illustration" title="Forest growth in three dimensions">
        <p>
          Greenness is a surface; a forest is a structure of trunks, branches and crowns over
          terrain. Pick a fire and a year: the trees in this synthetic block grow to the height the
          model estimates for that fire. It is an illustration, not a measurement and not a picture
          of the place.
        </p>
      </PageIntro>
      <ForestGrowthExplorer />
    </PageLayout>
  );
}
