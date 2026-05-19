"use client";

import {
  motion,
  AnimatePresence,
  useMotionValue,
  useDragControls,
  animate,
} from "framer-motion";

const DISMISS_THRESHOLD = 80; // px arrastado pra baixo dispara o fechamento

/**
 * Bottom sheet reutilizável:
 * - Arrasta o handle (barrinha no topo) pra baixo → fecha
 * - Tap no handle → fecha (atalho rápido)
 * - Tap no backdrop → fecha
 * - Conteúdo interno scrollla normalmente (não interfere no drag)
 */
export function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = "85vh",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
}) {
  const y = useMotionValue(0);
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
            aria-hidden
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            style={{ y, maxHeight }}
            onDragEnd={(_, info) => {
              if (info.offset.y > DISMISS_THRESHOLD || info.velocity.y > 500) {
                onClose();
              } else {
                animate(y, 0, { type: "spring", stiffness: 350, damping: 32 });
              }
            }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl pb-[max(env(safe-area-inset-bottom),12px)] flex flex-col"
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              onClick={onClose}
              className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
              role="button"
              aria-label="Arrastar para fechar"
            >
              <span className="w-10 h-1.5 bg-slate-300 rounded-full" />
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
