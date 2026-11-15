import type { ReactNode, RefObject } from 'react';
import { PageLayout } from '@/components/shell/PageLayout';

/** The Recovery page's shell: the shared page layout, in the Research section. */
export function RecoveryLayout({
  scrollRef,
  children,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <PageLayout section="research" scrollRef={scrollRef}>
      {children}
    </PageLayout>
  );
}
