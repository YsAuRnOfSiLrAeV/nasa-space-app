import { PageIntro, PageLayout } from '@/components/shell/PageLayout';
import { ForestViewer } from '@/features/forest3d';

/**
 * A standalone page for the 3D forest illustration (first milestone). Lazily
 * loaded, so Three.js is fetched only when this page opens. Not linked from the
 * navigation yet; reached at #/research/forest-3d.
 */
export function Forest3DPage() {
  return (
    <PageLayout section="research">
      <PageIntro eyebrow="Research · illustration" title="Forest structure in three dimensions">
        <p>
          Greenness is a surface; a forest is a structure of trunks, branches and crowns over
          terrain. This block is a conceptual model of that structure. Its terrain and trees are
          synthetic, not measurements of any fire or place.
        </p>
      </PageIntro>
      <ForestViewer />
    </PageLayout>
  );
}
