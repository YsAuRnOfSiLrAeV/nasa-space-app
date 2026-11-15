import styles from './MapShell.module.css';

/** Returns to the grouped Examples list with no fire selected. */
export function OtherFiresMenu({ href }: { href: string }) {
  return (
    <a className={`${styles.otherFires} ${styles.otherFiresButton}`} href={href}>
      Other fires
    </a>
  );
}
