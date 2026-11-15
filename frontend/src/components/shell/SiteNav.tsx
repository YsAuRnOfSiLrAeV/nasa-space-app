import { RESEARCH_HREF, changeMapMode, mapHref, type Section } from '@/app/route';
import { useMapNavigation } from '@/app/mapNavigation';
import { SiteHeader } from './SiteHeader';
import { APP_TITLE } from './brand';
import styles from './nav.module.css';

/**
 * The app's primary navigation, the same on every page: the two map modes
 * (Examples, Find Your Fire) and the research page, with the current one marked.
 */
export function SiteNav({
  current,
  onExplore,
  fade,
}: {
  current: Section;
  /**
   * On the explorer itself, Explore and the brand return to its opening view
   * instead of following a link to the page that is already open.
   */
  onExplore?: () => void;
  fade?: boolean;
}) {
  const map = useMapNavigation();
  return (
    <SiteHeader
      label="Primary"
      fade={fade}
      brand={
        onExplore
          ? { onSelect: onExplore, label: `${APP_TITLE}: planet view` }
          : { href: mapHref(map), label: `${APP_TITLE}: return to map` }
      }
      center={
        <div className={styles.modes} aria-label="Map mode">
          {(['examples', 'search'] as const).map((mode) => (
            <a
              key={mode}
              href={mapHref(changeMapMode(map, mode))}
              aria-current={current === 'explore' && map.mode === mode ? 'true' : undefined}
            >
              {mode === 'examples' ? 'Examples' : 'Find Your Fire'}
            </a>
          ))}
        </div>
      }
      items={[
        {
          id: 'research',
          label: 'Methodology',
          href: RESEARCH_HREF,
          current: current === 'research',
        },
      ]}
    />
  );
}
