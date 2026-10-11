import { useEffect, useMemo, useState } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
  type Transition,
} from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Crown, ShoppingBag, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'
import { LAYER_LABELS, LAYER_ORDER, getLayersByCategory } from '@/data/bolo-layers'
import { celebrate } from '@/lib/confetti'
import { formatBRL } from '@/lib/format'
import type { BoloLayer, BoloSelection, CompleteBoloSelection, LayerCategory } from '@/types/bolo-layers'

export interface BoloBuilderProps {
  onClose: () => void
  onAddToCart: (selection: CompleteBoloSelection, total: number) => void
}

/**
 * Geometria da pilha (px, antes da escala). Enquanto o bolo é montado, as camadas
 * flutuam separadas (`floating`) com etiquetas; no resumo elas se aproximam e se
 * encaixam em `bottom`. `focus` é a altura, dentro da imagem, para onde a etiqueta aponta.
 */
const STACK: Record<
  LayerCategory,
  { bottom: number; floating: number; height: number; focus: number; z: number; side: 'left' | 'right' }
> = {
  base: { bottom: 0, floating: 0, height: 150, focus: 75, z: 1, side: 'left' },
  recheio: { bottom: 30, floating: 168, height: 40, focus: 20, z: 2, side: 'right' },
  cobertura: { bottom: 60, floating: 222, height: 100, focus: 77, z: 3, side: 'left' },
  decoracao: { bottom: 80, floating: 300, height: 120, focus: 80, z: 4, side: 'right' },
}
/** Escala da pilha "explodida", para caber na pré-visualização de 320px. */
const FLOATING_SCALE = 0.68
/** Espaço reservado para o prato embaixo da pilha (igual ao `bottom` de .bolo-preview-stack). */
const PLATE_OFFSET = 24

const STEP_TITLES: Record<LayerCategory, string> = {
  base: 'Escolha a base',
  recheio: 'Escolha o recheio',
  cobertura: 'Escolha a cobertura',
  decoracao: 'Escolha a decoração',
}

const SUMMARY_STEP = LAYER_ORDER.length

const enterTransition: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
const layerSpring: Transition = { type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }
const assembleSpring: Transition = { type: 'spring', stiffness: 170, damping: 18 }
const stepTransition: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

const isComplete = (selection: BoloSelection): selection is CompleteBoloSelection =>
  LAYER_ORDER.every(category => selection[category] !== undefined)

export function BoloBuilder({ onClose, onAddToCart }: BoloBuilderProps) {
  const [step, setStep] = useState<number>(0)
  const [selection, setSelection] = useState<BoloSelection>({})
  const [direction, setDirection] = useState<1 | -1>(1)

  const category: LayerCategory | undefined = LAYER_ORDER[step]
  const isSummary = step === SUMMARY_STEP
  const total = useMemo(
    () => LAYER_ORDER.reduce((sum, key) => sum + (selection[key]?.price ?? 0), 0),
    [selection],
  )
  const canAdvance = category ? selection[category] !== undefined : false

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(Math.max(0, Math.min(SUMMARY_STEP, next)))
  }

  const choose = (layer: BoloLayer) => setSelection(prev => ({ ...prev, [layer.category]: layer }))

  const handleAddToCart = () => {
    if (!isComplete(selection)) return
    void celebrate()
    toast.success('Seu bolo personalizado foi adicionado', {
      description: `${selection.base.name} · ${formatBRL(total)}`,
    })
    onAddToCart(selection, total)
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        layoutId="cake-builder"
        className="bolo-builder"
        role="region"
        aria-labelledby="bolo-builder-title"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={enterTransition}
      >
        <header className="bolo-builder-header">
          <div>
            <p className="bolo-builder-eyebrow">
              <Sparkles aria-hidden="true" /> Monte seu bolo
            </p>
            <h2 id="bolo-builder-title">
              {isSummary || !category ? 'Seu bolo está pronto!' : STEP_TITLES[category]}
            </h2>
          </div>
          <button type="button" className="bolo-builder-close" onClick={onClose} aria-label="Fechar o Monte seu Bolo">
            <X aria-hidden="true" />
          </button>
        </header>

        <StepIndicator step={step} selection={selection} onJump={goTo} />

        <CakePreview selection={selection} assembled={isSummary} />

        <div className="bolo-builder-total" aria-live="polite">
          <span>Total</span>
          <AnimatedPrice value={total} />
        </div>

        <div className="bolo-builder-stage">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={isSummary ? 'resumo' : category}
              custom={direction}
              variants={{
                enter: (dir: 1 | -1) => ({ x: dir * 48, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: 1 | -1) => ({ x: dir * -48, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
            >
              {isSummary || !category ? (
                <Summary selection={selection} total={total} onEdit={goTo} onAddToCart={handleAddToCart} />
              ) : (
                <LayerPicker category={category} selectedId={selection[category]?.id} onChoose={choose} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <nav className="bolo-builder-nav" aria-label="Etapas do Monte seu Bolo">
          <button
            type="button"
            className="bolo-builder-back"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            aria-label="Voltar para a camada anterior"
          >
            <ArrowLeft aria-hidden="true" /> Voltar
          </button>
          {!isSummary && (
            <button
              type="button"
              className="bolo-builder-next"
              onClick={() => goTo(step + 1)}
              disabled={!canAdvance}
              aria-label={step === SUMMARY_STEP - 1 ? 'Ver o resumo do bolo' : 'Ir para a próxima camada'}
            >
              {step === SUMMARY_STEP - 1 ? 'Ver resumo' : 'Próxima Camada'} <ArrowRight aria-hidden="true" />
            </button>
          )}
        </nav>
      </motion.div>
    </MotionConfig>
  )
}

/* ---------- Etapas ---------- */

function StepIndicator({
  step,
  selection,
  onJump,
}: {
  step: number
  selection: BoloSelection
  onJump: (step: number) => void
}) {
  // Só dá para pular para etapas já liberadas (todas as anteriores escolhidas).
  const unlocked = LAYER_ORDER.findIndex(key => !selection[key])
  const maxReachable = unlocked === -1 ? SUMMARY_STEP : unlocked

  return (
    <ol className="bolo-builder-steps">
      {LAYER_ORDER.map((key, index) => {
        const done = selection[key] !== undefined
        const current = index === step
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onJump(index)}
              disabled={index > maxReachable}
              aria-current={current ? 'step' : undefined}
              aria-label={`Etapa ${index + 1}: ${LAYER_LABELS[key]}${done ? `, escolhido ${selection[key]?.name}` : ''}`}
              className={current ? 'is-current' : done ? 'is-done' : undefined}
            >
              <span className="bolo-builder-step-dot" aria-hidden="true">
                {done && !current ? <Check /> : index + 1}
              </span>
              <span className="bolo-builder-step-label">{LAYER_LABELS[key]}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- Pré-visualização do bolo empilhado ---------- */

function CakePreview({ selection, assembled }: { selection: BoloSelection; assembled: boolean }) {
  const isEmpty = LAYER_ORDER.every(key => !selection[key])
  const description = LAYER_ORDER.flatMap(key => (selection[key] ? [selection[key].name] : [])).join(', ')

  return (
    <div
      className={`bolo-preview${assembled ? ' is-assembled' : ''}`}
      role="img"
      aria-label={isEmpty ? 'Bolo vazio: escolha a base' : `Seu bolo: ${description}`}
    >
      <div className="bolo-preview-plate" aria-hidden="true" />
      {isEmpty && <p className="bolo-preview-empty">Escolha a base para começar</p>}

      <motion.div
        className="bolo-preview-stack"
        style={{ originX: 0.5, originY: 1 }}
        initial={false}
        animate={{ scale: assembled ? 1 : FLOATING_SCALE }}
        transition={assembleSpring}
      >
        {LAYER_ORDER.map(key => {
          const layer = selection[key]
          const { bottom, floating, height, z } = STACK[key]
          // A posição de repouso é a encaixada; a flutuação é só um deslocamento em y.
          const y = assembled ? 0 : bottom - floating
          return (
            <AnimatePresence key={key} initial={false}>
              {layer && (
                <motion.img
                  key={layer.id}
                  src={layer.image}
                  alt=""
                  draggable={false}
                  className="bolo-preview-layer"
                  style={{ bottom, height, zIndex: z }}
                  initial={{ y: y + 40, opacity: 0, scale: 0.9 }}
                  animate={{ y, opacity: 1, scale: 1 }}
                  exit={{ y: y - 16, opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  transition={assembled ? assembleSpring : layerSpring}
                />
              )}
            </AnimatePresence>
          )
        })}
      </motion.div>

      {/* Etiquetas com linha dourada, como num cardápio ilustrado: somem quando o bolo se fecha. */}
      {LAYER_ORDER.map(key => {
        const layer = selection[key]
        const { floating, focus, side } = STACK[key]
        return (
          <AnimatePresence key={key}>
            {layer && !assembled && (
              <motion.div
                key={layer.id}
                className={`bolo-preview-label is-${side}`}
                style={{ bottom: PLATE_OFFSET + (floating + focus) * FLOATING_SCALE }}
                initial={{ opacity: 0, x: side === 'left' ? -10 : 10 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 0.35, duration: 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                aria-hidden="true"
              >
                <span className="bolo-preview-label-category">{LAYER_LABELS[key]}</span>
                <span className="bolo-preview-label-name">{layer.name}</span>
              </motion.div>
            )}
          </AnimatePresence>
        )
      })}
    </div>
  )
}

/* ---------- Preço com contagem suave ---------- */

function AnimatedPrice({ value }: { value: number }) {
  const reduceMotion = useReducedMotion()
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 })
  const text = useTransform(spring, latest => formatBRL(Math.round(latest * 100) / 100))

  useEffect(() => {
    if (reduceMotion) spring.jump(value)
    else spring.set(value)
  }, [reduceMotion, spring, value])

  return (
    <strong className="bolo-builder-price">
      {/* O texto animado é decorativo; leitores de tela recebem só o valor final. */}
      <motion.span aria-hidden="true">{text}</motion.span>
      <span className="sr-only">{formatBRL(value)}</span>
    </strong>
  )
}

/* ---------- Carrossel de opções da etapa atual ---------- */

function LayerPicker({
  category,
  selectedId,
  onChoose,
}: {
  category: LayerCategory
  selectedId: string | undefined
  onChoose: (layer: BoloLayer) => void
}) {
  const options = useMemo(() => getLayersByCategory(category), [category])
  const [api, setApi] = useState<CarouselApi>()

  // Ao voltar para uma etapa, o carrossel abre já na opção escolhida.
  useEffect(() => {
    if (!api || !selectedId) return
    const index = options.findIndex(option => option.id === selectedId)
    if (index > 0) api.scrollTo(index, true)
    // Só no início da etapa: rolar a cada clique atrapalharia a navegação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: 'start', containScroll: 'trimSnaps', dragFree: true }}
      className="bolo-picker"
      aria-label={`Opções de ${LAYER_LABELS[category].toLowerCase()}`}
    >
      <CarouselContent className="bolo-picker-track">
        {options.map(option => {
          const selected = option.id === selectedId
          return (
            <CarouselItem key={option.id} className="bolo-picker-item">
              <motion.button
                type="button"
                className={`bolo-option${selected ? ' is-selected' : ''}`}
                onClick={() => onChoose(option)}
                aria-pressed={selected}
                aria-label={`Escolher ${LAYER_LABELS[category].toLowerCase()} ${option.name}, ${formatBRL(option.price)}${option.badge ? `, ${option.badge === 'premium' ? 'premium' : 'mais pedido'}` : ''}`}
                animate={{ scale: selected ? 1.04 : 1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              >
                {option.badge && (
                  <span className={`bolo-option-badge is-${option.badge}`} aria-hidden="true">
                    {option.badge === 'premium' ? <Crown /> : <Sparkles />}
                    {option.badge === 'premium' ? 'Premium' : 'Mais pedido'}
                  </span>
                )}
                <span className="bolo-option-media" aria-hidden="true">
                  <img src={option.image} alt="" loading="lazy" draggable={false} />
                </span>
                <span className="bolo-option-name">{option.name}</span>
                <span className="bolo-option-desc">{option.description}</span>
                <span className="bolo-option-price">+ {formatBRL(option.price)}</span>
                {selected && (
                  <span className="bolo-option-check" aria-hidden="true">
                    <Check />
                  </span>
                )}
              </motion.button>
            </CarouselItem>
          )
        })}
      </CarouselContent>
    </Carousel>
  )
}

/* ---------- Resumo final ---------- */

function Summary({
  selection,
  total,
  onEdit,
  onAddToCart,
}: {
  selection: BoloSelection
  total: number
  onEdit: (step: number) => void
  onAddToCart: () => void
}) {
  return (
    <div className="bolo-summary">
      <ul aria-label="Camadas escolhidas">
        {LAYER_ORDER.map((key, index) => {
          const layer = selection[key]
          return (
            <li key={key}>
              <span className="bolo-summary-label">{LAYER_LABELS[key]}</span>
              <span className="bolo-summary-name">{layer?.name ?? '—'}</span>
              <span className="bolo-summary-price">{layer ? formatBRL(layer.price) : ''}</span>
              <button
                type="button"
                className="bolo-summary-edit"
                onClick={() => onEdit(index)}
                aria-label={`Trocar ${LAYER_LABELS[key].toLowerCase()}`}
              >
                Trocar
              </button>
            </li>
          )
        })}
      </ul>
      <motion.button
        type="button"
        className="bolo-add-button"
        onClick={onAddToCart}
        disabled={!isComplete(selection)}
        aria-label={`Adicionar bolo personalizado ao carrinho por ${formatBRL(total)}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        <ShoppingBag aria-hidden="true" />
        Adicionar ao Carrinho · {formatBRL(total)}
      </motion.button>
    </div>
  )
}
