import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion, type Transition } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  MessageCircle,
  Palette,
  QrCode,
  Store,
  Truck,
} from 'lucide-react'
import {
  formatAddress,
  fulfillmentSchema,
  parseMoney,
  paymentLabel,
  PAYMENT_METHODS,
  PICKUP_ADDRESS,
  validateChange,
  type CheckoutData,
  type Fulfillment,
  type PaymentMethod,
} from '@/lib/checkout'
import { formatBRL } from '@/lib/format'
import { MAPS_URL } from '@/lib/whatsapp'
import type { CartItem } from '@/types/product'

export interface CheckoutStepperProps {
  items: readonly CartItem[]
  total: number
  /** Volta para a lista do carrinho. */
  onBack: () => void
  /** Pedido revisado e confirmado pelo cliente (registra no n8n e abre o WhatsApp). */
  onConfirm: (data: CheckoutData) => Promise<void>
}

const STEPS = ['Endereço', 'Pagamento', 'Resumo'] as const
const slide: Transition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] }

interface FormValues {
  fulfillment: Fulfillment['fulfillment']
  name: string
  street: string
  number: string
  district: string
  complement: string
  reference: string
}

const EMPTY_FORM: FormValues = {
  fulfillment: 'entrega',
  name: '',
  street: '',
  number: '',
  district: '',
  complement: '',
  reference: '',
}

type FieldName = Exclude<keyof FormValues, 'fulfillment'>
type FieldErrors = Partial<Record<FieldName, string>>

/** Valida a etapa 1 com o Zod e devolve os dados limpos ou os erros por campo. */
function parseFulfillment(values: FormValues): { data?: Fulfillment; errors: FieldErrors } {
  const { fulfillment, name, ...address } = values
  const result = fulfillmentSchema.safeParse(
    fulfillment === 'entrega' ? { fulfillment, name, address } : { fulfillment, name },
  )
  if (result.success) return { data: result.data, errors: {} }
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path.at(-1) as FieldName
    errors[field] ??= issue.message
  }
  return { errors }
}

const PAYMENT_ICONS: Record<PaymentMethod, typeof QrCode> = { pix: QrCode, cartao: CreditCard, dinheiro: Banknote }

export function CheckoutStepper({ items, total, onBack, onConfirm }: CheckoutStepperProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [values, setValues] = useState<FormValues>(EMPTY_FORM)
  const [showErrors, setShowErrors] = useState(false)
  const [customer, setCustomer] = useState<Fulfillment>()
  const [method, setMethod] = useState<PaymentMethod>()
  const [change, setChange] = useState('')
  const [paymentTried, setPaymentTried] = useState(false)
  const [sending, setSending] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const { errors } = useMemo(() => parseFulfillment(values), [values])
  const changeFor = parseMoney(change)
  const changeError = method === 'dinheiro' ? validateChange(changeFor, total) : undefined

  // Leitores de tela e teclado acompanham a troca de etapa.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const submitAddress = () => {
    const parsed = parseFulfillment(values)
    setShowErrors(true)
    if (!parsed.data) {
      const first = Object.keys(parsed.errors)[0]
      if (first) document.getElementById(`checkout-${first}`)?.focus()
      return
    }
    setCustomer(parsed.data)
    goTo(1)
  }

  const submitPayment = () => {
    setPaymentTried(true)
    if (!method || changeError) return
    goTo(2)
  }

  const set = (field: keyof FormValues) => (value: string) => setValues(prev => ({ ...prev, [field]: value }))

  return (
    <MotionConfig reducedMotion="user">
      <div className="checkout">
        <ol className="checkout-steps" aria-label="Etapas do pedido">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={index === step ? 'is-current' : index < step ? 'is-done' : undefined}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="checkout-step-dot" aria-hidden="true">
                {index < step ? <Check /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <div className="checkout-stage">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.section
              key={step}
              className="checkout-panel"
              custom={direction}
              variants={{
                enter: (dir: 1 | -1) => ({ x: dir * 60, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: 1 | -1) => ({ x: dir * -60, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slide}
              aria-labelledby="checkout-step-title"
            >
              <h3 id="checkout-step-title" ref={headingRef} tabIndex={-1} className="checkout-title">
                {step === 0 ? 'Como você quer receber?' : step === 1 ? 'Como você quer pagar?' : 'Confira seu pedido'}
              </h3>

              {step === 0 && (
                <AddressStep values={values} errors={showErrors ? errors : {}} onChange={set} />
              )}
              {step === 1 && customer && (
                <PaymentStep
                  total={total}
                  fulfillment={customer.fulfillment}
                  method={method}
                  onMethod={setMethod}
                  change={change}
                  onChange={setChange}
                  changeError={paymentTried || change ? changeError : undefined}
                  missingMethod={paymentTried && !method}
                />
              )}
              {step === 2 && customer && method && (
                <ReviewStep
                  items={items}
                  total={total}
                  customer={customer}
                  method={method}
                  changeFor={method === 'dinheiro' ? changeFor : undefined}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="checkout-nav">
          <button
            type="button"
            className="checkout-back"
            onClick={() => (step === 0 ? onBack() : goTo(step - 1))}
          >
            <ArrowLeft aria-hidden="true" />
            {step === 0 ? 'Carrinho' : 'Voltar'}
          </button>
          {step === 0 && (
            <button type="button" className="checkout-next" onClick={submitAddress}>
              Pagamento <ArrowRight aria-hidden="true" />
            </button>
          )}
          {step === 1 && (
            <button type="button" className="checkout-next" onClick={submitPayment}>
              Revisar pedido <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
        {step === 2 && customer && method && (
          <button
            type="button"
            className="checkout-button checkout-send"
            disabled={sending}
            aria-busy={sending}
            onClick={async () => {
              if (sending) return
              setSending(true)
              try {
                await onConfirm({
                  customer,
                  payment: { method, changeFor: method === 'dinheiro' ? changeFor : undefined },
                })
              } finally {
                setSending(false)
              }
            }}
          >
            {sending ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <MessageCircle aria-hidden="true" />}
            {sending ? 'Enviando pedido…' : 'Enviar pedido pelo WhatsApp'}
          </button>
        )}
      </div>
    </MotionConfig>
  )
}

/* ---------- Etapa 1: entrega/retirada e endereço ---------- */

function AddressStep({
  values,
  errors,
  onChange,
}: {
  values: FormValues
  errors: FieldErrors
  onChange: (field: keyof FormValues) => (value: string) => void
}) {
  const isDelivery = values.fulfillment === 'entrega'
  return (
    <>
      <div className="checkout-choice-row" role="radiogroup" aria-label="Forma de receber">
        <ChoiceCard
          name="fulfillment"
          checked={isDelivery}
          onSelect={() => onChange('fulfillment')('entrega')}
          icon={<Truck />}
          title="Entrega"
          hint="Levamos até você"
        />
        <ChoiceCard
          name="fulfillment"
          checked={!isDelivery}
          onSelect={() => onChange('fulfillment')('retirada')}
          icon={<Store />}
          title="Retirada"
          hint="Na Rua Tapixi, 412"
        />
      </div>

      <TextField
        id="name"
        label="Seu nome"
        value={values.name}
        onValue={onChange('name')}
        error={errors.name}
        autoComplete="name"
        maxLength={60}
        placeholder="Como podemos te chamar"
      />

      {isDelivery ? (
        <>
          <div className="checkout-row">
            <TextField
              id="street"
              label="Rua"
              value={values.street}
              onValue={onChange('street')}
              error={errors.street}
              className="is-grow"
              autoComplete="address-line1"
              maxLength={120}
              placeholder="Ex.: Rua Tapixi"
            />
            <TextField
              id="number"
              label="Número"
              value={values.number}
              onValue={onChange('number')}
              error={errors.number}
              className="is-narrow"
              maxLength={6}
              placeholder="412"
            />
          </div>
          <TextField
            id="district"
            label="Bairro"
            value={values.district}
            onValue={onChange('district')}
            error={errors.district}
            autoComplete="address-level3"
            maxLength={60}
            placeholder="Ex.: Vila Tomaz"
          />
          <TextField
            id="complement"
            label="Complemento"
            optional
            value={values.complement}
            onValue={onChange('complement')}
            error={errors.complement}
            autoComplete="address-line2"
            maxLength={60}
            placeholder="Apto, bloco, casa dos fundos..."
          />
          <TextField
            id="reference"
            label="Ponto de referência"
            optional
            value={values.reference}
            onValue={onChange('reference')}
            error={errors.reference}
            maxLength={120}
            placeholder="Ex.: perto da praça da matriz"
          />
        </>
      ) : null}

      <a className="checkout-map" href={MAPS_URL} target="_blank" rel="noreferrer">
        <MapPin aria-hidden="true" />
        <span>
          <strong>{isDelivery ? 'Mapa de referência da Ondina' : 'Retirada na Ondina Bolos'}</strong>
          <small>{isDelivery ? 'Abra para nos mostrar o caminho a partir da loja' : PICKUP_ADDRESS}</small>
        </span>
        <span className="checkout-map-cta">Abrir mapa</span>
      </a>
    </>
  )
}

/** Campo de texto com rótulo, erro do Zod e os atributos de acessibilidade ligados. */
function TextField({
  id,
  label,
  value,
  onValue,
  error,
  optional,
  className,
  ...inputProps
}: {
  id: FieldName
  label: string
  value: string
  onValue: (value: string) => void
  error?: string | undefined
  optional?: boolean
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'className'>) {
  const inputId = `checkout-${id}`
  const errorId = `${inputId}-error`
  return (
    <div className={`checkout-field${className ? ` ${className}` : ''}${error ? ' has-error' : ''}`}>
      <label htmlFor={inputId}>
        {label}
        {optional && <span> (opcional)</span>}
      </label>
      <span className="checkout-input">
        <input
          id={inputId}
          value={value}
          onChange={event => onValue(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
      </span>
      {error && (
        <p id={errorId} className="checkout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/* ---------- Etapa 2: pagamento ---------- */

function PaymentStep({
  total,
  fulfillment,
  method,
  onMethod,
  change,
  onChange,
  changeError,
  missingMethod,
}: {
  total: number
  fulfillment: Fulfillment['fulfillment']
  method: PaymentMethod | undefined
  onMethod: (method: PaymentMethod) => void
  change: string
  onChange: (value: string) => void
  changeError?: string | undefined
  missingMethod: boolean
}) {
  const changeId = useId()
  const hints: Record<PaymentMethod, string> = {
    pix: 'Aprovação na hora',
    cartao: 'Débito ou crédito na maquininha',
    dinheiro: 'Levamos troco',
  }
  return (
    <>
      <div className="checkout-payments" role="radiogroup" aria-label="Forma de pagamento">
        {PAYMENT_METHODS.map(option => {
          const Icon = PAYMENT_ICONS[option]
          return (
            <ChoiceCard
              key={option}
              name="payment"
              checked={method === option}
              onSelect={() => onMethod(option)}
              icon={<Icon />}
              title={paymentLabel(option, fulfillment)}
              hint={hints[option]}
              wide
            />
          )
        })}
      </div>
      {missingMethod && (
        <p className="checkout-error" role="alert">
          Escolha uma forma de pagamento.
        </p>
      )}

      <AnimatePresence initial={false} mode="wait">
        {method === 'pix' && (
          <motion.div
            key="pix"
            className="checkout-pix"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <SimulatedQr seed={total} />
            <div>
              <p className="checkout-pix-label">Valor exato</p>
              <p className="checkout-pix-total">{formatBRL(total)}</p>
              <p className="checkout-pix-note">
                QR Code <strong>simulado</strong>, só para ilustrar. A chave Pix de verdade é enviada na conversa do
                WhatsApp, depois que a Ondina confirmar o pedido.
              </p>
            </div>
          </motion.div>
        )}
        {method === 'dinheiro' && (
          <motion.div
            key="dinheiro"
            className={`checkout-field checkout-change${changeError ? ' has-error' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <label htmlFor={changeId}>
              Troco para quanto? <span>(opcional)</span>
            </label>
            <span className="checkout-input">
              <input
                id={changeId}
                value={change}
                onChange={e => onChange(e.target.value)}
                inputMode="decimal"
                maxLength={9}
                placeholder={`Ex.: ${formatBRL(Math.ceil(total / 50) * 50)}`}
                aria-invalid={Boolean(changeError)}
                aria-describedby={changeError ? `${changeId}-error` : undefined}
              />
            </span>
            {changeError && (
              <p id={`${changeId}-error`} className="checkout-error" role="alert">
                {changeError}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Cartão de escolha (rádio nativo por baixo): ganha escala e borda dourada quando marcado. */
function ChoiceCard({
  name,
  checked,
  onSelect,
  icon,
  title,
  hint,
  wide,
}: {
  name: string
  checked: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  hint: string
  wide?: boolean
}) {
  return (
    <motion.label
      className={`checkout-choice${checked ? ' is-selected' : ''}${wide ? ' is-wide' : ''}`}
      animate={{ scale: checked ? 1.02 : 1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span className="checkout-choice-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="checkout-choice-text">
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <span className="checkout-choice-check" aria-hidden="true">
        {checked && <Check />}
      </span>
    </motion.label>
  )
}

/**
 * QR Code ilustrativo (não é um Pix válido): desenha os três "olhos" de canto e módulos
 * pseudoaleatórios a partir do valor, só para o cliente reconhecer o formato.
 */
function SimulatedQr({ seed }: { seed: number }) {
  const size = 25
  const cells = useMemo(() => {
    let state = Math.round(seed * 100) + 7919
    const rand = () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    }
    const inFinder = (x: number, y: number) =>
      (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8)
    const out: { x: number; y: number }[] = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!inFinder(x, y) && rand() > 0.52) out.push({ x, y })
      }
    }
    return out
  }, [seed])
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  )
  return (
    <svg className="checkout-qr" viewBox={`-1 -1 ${size + 2} ${size + 2}`} role="img" aria-label="QR Code simulado">
      <rect x={-1} y={-1} width={size + 2} height={size + 2} fill="#fff" />
      {cells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
      ))}
      {finder(0, 0)}
      {finder(size - 7, 0)}
      {finder(0, size - 7)}
    </svg>
  )
}

/* ---------- Etapa 3: resumo ---------- */

function ReviewStep({
  items,
  total,
  customer,
  method,
  changeFor,
}: {
  items: readonly CartItem[]
  total: number
  customer: Fulfillment
  method: PaymentMethod
  changeFor: number | undefined
}) {
  return (
    <div className="checkout-review">
      <ul className="checkout-review-items" aria-label="Itens do pedido">
        {items.map(item => (
          <li key={item.id}>
            <div>
              <p className="checkout-review-name">
                {item.type === 'custom' && <Palette aria-hidden="true" />}
                {item.quantity}× {item.name}
                {item.type === 'ready' && item.product.unit === 'kg' ? ' (kg)' : ''}
              </p>
              {item.type === 'custom' && (
                <p className="checkout-review-layers">
                  {item.customConfig.base} · {item.customConfig.recheio} · {item.customConfig.cobertura} ·{' '}
                  {item.customConfig.decoracao}
                </p>
              )}
            </div>
            <strong>{formatBRL(item.price * item.quantity)}</strong>
          </li>
        ))}
      </ul>

      <dl className="checkout-review-info">
        <div>
          <dt>Nome</dt>
          <dd>{customer.name}</dd>
        </div>
        <div>
          <dt>{customer.fulfillment === 'entrega' ? 'Entrega em' : 'Receber'}</dt>
          <dd>{formatAddress(customer)}</dd>
        </div>
        <div>
          <dt>Pagamento</dt>
          <dd>
            {paymentLabel(method, customer.fulfillment)}
            {changeFor !== undefined && ` (troco para ${formatBRL(changeFor)})`}
          </dd>
        </div>
      </dl>

      <div className="checkout-review-total">
        <span>Total</span>
        <strong>{formatBRL(total)}</strong>
      </div>
      <p className="checkout-review-note">A Ondina confirma o pedido, o horário e o frete pela conversa.</p>
    </div>
  )
}
