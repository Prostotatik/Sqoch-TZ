import { useEffect, useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, useReducedMotion } from 'motion/react';
import { useOrderStore } from '@/state/orderStore';
import { useFinePointer, useLayoutMode } from '@/hooks/useMediaQuery';
import { useLenis } from '@/hooks/useLenis';
import { SceneLayer } from '@/components/three/SceneLayer';
import { PortalFlash } from '@/components/fx/PortalFlash';
import { Cursor } from '@/components/fx/Cursor';
import { Landing } from '@/screens/Landing';
import { FlowShell } from '@/screens/flow/FlowShell';
import { SuccessScreen } from '@/screens/final/SuccessScreen';
import { SoldOutScreen } from '@/screens/final/SoldOutScreen';

// `m` components + features in their own chunk (layout animations need domMax)
const loadFeatures = () => import('@/motion/features').then((r) => r.default);

const FLOW_STEPS = new Set(['tickets', 'participants', 'summary', 'processing']);

/**
 * Root composition:
 *  - one persistent WebGL layer (SceneLayer) under everything (INV-00);
 *  - the landing/hero stays mounted; on >=768 the flow floats over it (sheet / side panel),
 *    on phones the flow replaces it;
 *  - 05/06 are a centred modal on >=768 and a full screen on phones.
 */
export function App() {
  const step = useOrderStore((s) => s.step);
  const layout = useLayoutMode();
  const inFlow = FLOW_STEPS.has(step);
  const final = step === 'success' || step === 'soldout';
  const overlayOpen = inFlow || final;
  // phones: while the flow opens "through the portal" the hero stays visible underneath (INV-03)
  const [intro, setIntro] = useState(false);
  const covering = overlayOpen && layout === 'phone' && !intro;
  const fine = useFinePointer();
  const reduced = useReducedMotion() ?? false;
  // INV-02: smooth wheel scroll of the landing, desktop only; paused under the panel/modal
  useLenis(fine && !reduced, overlayOpen);

  useEffect(() => {
    const lock = overlayOpen && layout !== 'phone';
    document.documentElement.classList.toggle('is-locked', lock);
  }, [overlayOpen, layout]);

  useEffect(() => {
    // phones: every overlay screen starts at the top of the page
    if (covering) window.scrollTo({ top: 0 });
  }, [covering, step]);

  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div className="app" data-step={step} data-layout={layout} data-overlay={overlayOpen || undefined}>
          <SceneLayer />
          <Landing hidden={covering} inert={overlayOpen && !covering} />
          <AnimatePresence>{inFlow && <FlowShell key="flow" layout={layout} onIntro={setIntro} />}</AnimatePresence>
          <AnimatePresence mode="wait">
            {step === 'success' && <SuccessScreen key="success" layout={layout} />}
            {step === 'soldout' && <SoldOutScreen key="soldout" layout={layout} />}
          </AnimatePresence>
          <PortalFlash />
          {fine && !reduced && <Cursor />}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
