import type { Ref } from 'react';
import type { RecoveryFile, RecoveryImage } from '@/data/recoverySchema';
import { groundWidthKm } from './planet/observationWindow';
import { extentLines } from './planet/region';
import cartography from './ScientificLanding.module.css';

const platformName = (p: string) => p.replace(/^landsat-/i, 'Landsat ');

/**
 * FIG. 01A: where the globe's flat cartography gives way to a real observation.
 * One Landsat surface-reflectance scene, cropped to one Ontario burn, at its
 * true extent (marked on the globe and joined to this window by leader lines).
 * Every label comes from the recovery record.
 */
export function ObservationWindow({
  record,
  image,
  imageRef,
  className,
}: {
  record: RecoveryFile;
  image: RecoveryImage;
  imageRef: Ref<HTMLDivElement>;
  className?: string;
}) {
  const km = groundWidthKm(record.bbox);
  const barKm = km >= 10 ? 5 : km >= 4 ? 2 : 1;
  const [lat, lon] = extentLines(record.bbox);
  return (
    <figure className={className}>
      <div className={cartography.panelLabel}>
        <span className={cartography.figureIndex}>FIG. 01A / OBSERVATION WINDOW</span>
        <span>ONTARIO</span>
      </div>
      <div ref={imageRef} className={cartography.windowFrame}>
        <img
          src={image.natural}
          alt={`${platformName(image.platform)} natural-colour image of a ${record.fire_year} Ontario burn, ${image.date}, about ${Math.round(km)} km across.`}
          width={512}
          height={512}
          loading="lazy"
          decoding="async"
        />
        <div aria-hidden="true" className={cartography.scaleBar}>
          <span style={{ width: `${(barKm / km) * 100}%` }} />
          {barKm} km
        </div>
      </div>
      <figcaption className={cartography.panelCaption}>
        <span>
          {platformName(image.platform).toUpperCase()} · {image.date} · NATURAL COLOUR
        </span>
        <span>
          BURN OF {record.fire_year} · {lat}
        </span>
        <span>{lon}</span>
      </figcaption>
    </figure>
  );
}
