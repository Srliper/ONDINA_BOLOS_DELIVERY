import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowDown, ArrowUpRight, CakeSlice, Clock, Instagram, MapPin, MessageCircle, Package, Quote, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CakeBuilder } from '@/components/CakeBuilder'
import { CartDrawer } from '@/components/CartDrawer'
import { CustomCakeBanner } from '@/components/CustomCakeBanner'
import { Header } from '@/components/Header'
import { ProductCard } from '@/components/ProductCard'
import { ScrollIntro } from '@/components/ScrollIntro'
import { TeamSection } from '@/components/TeamSection'
import { WhatsAppWidget } from '@/components/WhatsAppWidget'
import aboutPhoto from '@/assets/three_cakes.jpg'
import { CATEGORY_LABEL, getProductById, products } from '@/data/products'
import { testimonials } from '@/data/testimonials'
import { coffeeFlavors, partyFlavors, portions, simpleFlavors } from '@/lib/bakery-menu'
import { formatBRL } from '@/lib/format'
import { stagger } from '@/lib/motion'
import { absoluteUrl, bakeryJsonLd, BUSINESS, SITE_URL } from '@/lib/site'
import { generateContactLink as whatsapp } from '@/lib/whatsapp'
import type { ProductCategory } from '@/types/product'

const TITLE = 'Ondina Bolos | Delivery de Bolos e Doces em São Miguel Arcanjo'
const DESCRIPTION =
  'Bolos para festas a R$ 60,00 o quilo e bolos para café a partir de R$ 20,00. Entrega grátis no perímetro urbano de São Miguel Arcanjo. Monte seu pedido e envie pelo WhatsApp.'

type Filter = 'todos' | ProductCategory
const filters: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos os bolos' },
  { id: 'festas', label: CATEGORY_LABEL.festas },
  { id: 'cafes', label: CATEGORY_LABEL.cafes },
  { id: 'sobremesas', label: CATEGORY_LABEL.sobremesas },
]
const heroProduct = getProductById('naked-cake')!

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: absoluteUrl(heroProduct.image) },
      { property: 'og:image:alt', content: 'Naked cake com frutas da Ondina Bolos' },
      ...(SITE_URL ? [{ property: 'og:url', content: SITE_URL }] : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: absoluteUrl(heroProduct.image) },
    ],
    links: [
      { rel: 'preload', as: 'image', href: heroProduct.image },
      ...(SITE_URL ? [{ rel: 'canonical', href: `${SITE_URL}/` }] : []),
    ],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify(bakeryJsonLd(heroProduct.image)) }],
  }),
  component: Index,
})

function Index() {
  return (
    <div>
      <a className="skip-link" href="#bolos">
        Pular para o cardápio
      </a>
      <Header />
      <main>
        <ScrollIntro />
        <Hero />
        <Catalog />
        <CustomCakeBanner />
        <CakeBuilder />
        <About />
        <TeamSection />
        {testimonials.length > 0 && <Testimonials />}
        <ServiceInfo />
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppWidget />
    </div>
  )
}

/* ---------------------------------- Topo ---------------------------------- */

function Hero() {
  return (
    <header className="bakery-container bakery-hero">
      <div className="hero-copy">
        <div className="hero-eyebrow">
          <CakeSlice size={15} aria-hidden="true" />
          Bolos para delivery
        </div>
        <h1>
          <span className="hero-line"><span>O sabor que</span></span>
          <span className="hero-line"><span>conquista</span></span>
          <span className="hero-line hero-accent"><span>São Miguel Arcanjo.</span></span>
        </h1>
        <p className="hero-description">
          Bolos para o café da tarde e para as suas festas. Escolha no cardápio, monte o pedido e envie pelo WhatsApp.
        </p>
        <div className="hero-cta">
          <Button asChild variant="bakery" className="hero-shimmer">
            <a href="#bolos">
              Ver cardápio
              <ArrowDown aria-hidden="true" />
            </a>
          </Button>
          <a className="hero-secondary" href={whatsapp()} target="_blank" rel="noreferrer">
            <MessageCircle size={16} aria-hidden="true" />
            Falar no WhatsApp
          </a>
        </div>
        <p className="hero-note">
          <Truck size={16} aria-hidden="true" />
          Entrega grátis no perímetro urbano de São Miguel Arcanjo
        </p>
      </div>
      <div className="hero-photo-wrap" data-tilt>
        <div className="hero-photo-frame">
          <img
            className="hero-photo"
            src={heroProduct.image}
            alt="Naked cake da Ondina com frutas frescas e camadas de recheio"
            fetchPriority="high"
            width={928}
            height={1152}
          />
        </div>
        <div className="hero-caption">
          <small>Bolos para festas</small>
          <p>Naked cake com frutas</p>
        </div>
        <HeroSeal />
      </div>
    </header>
  )
}

/** Selo que gira devagar sobre a foto do topo. */
function HeroSeal() {
  return (
    <svg className="hero-seal" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id="seal-circle" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="58" className="hero-seal-disc" />
      <g className="hero-seal-ring">
        <text>
          <textPath href="#seal-circle" textLength="272" lengthAdjust="spacing">
            Ondina Bolos ✦ desde 2003 ✦ feito à mão ✦
          </textPath>
        </text>
      </g>
      <text x="60" y="68" textAnchor="middle" className="hero-seal-mark">
        O
      </text>
    </svg>
  )
}

/* -------------------------------- Cardápio -------------------------------- */

function Catalog() {
  const [category, setCategory] = useState<Filter>('todos')
  const visible = products.filter(product => category === 'todos' || product.category === category)
  const showParty = category === 'todos' || category === 'festas'
  const showCoffee = category === 'todos' || category === 'cafes'

  return (
    <section className="bakery-container catalog" id="bolos" aria-labelledby="catalog-title" tabIndex={-1}>
      <div className="catalog-heading">
        <div>
          <h2 id="catalog-title">Cardápio</h2>
          <p>Adicione os bolos ao carrinho e envie o pedido de uma vez.</p>
        </div>
        <div className="catalog-filters" role="group" aria-label="Filtrar por categoria">
          {filters.map(filter => (
            <Button key={filter.id} variant="filter" aria-pressed={category === filter.id} onClick={() => setCategory(filter.id)}>
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* A key reinicia a grade a cada filtro, e os cards entram de novo em sequência. */}
      <div className="cake-grid" key={category}>
        {visible.map((product, index) => (
          <ProductCard key={product.id} product={product} index={index} />
        ))}
      </div>
      <p className="photo-note">
        Fotos dos nossos bolos. Tamanho, decoração e data de entrega são combinados na conversa pelo WhatsApp.
      </p>

      <div className="full-menu">
        {showParty && <MenuGroup title="Bolos para festas" price={formatBRL(60)} unit="o quilo" flavors={partyFlavors} category="festas" />}
        {showCoffee && (
          <>
            <MenuGroup title="Bolos para café" price={formatBRL(25)} unit="até 13 fatias" flavors={coffeeFlavors} category="café" />
            <MenuGroup title="Bolos para café simples" price={formatBRL(20)} unit="até 13 fatias" flavors={simpleFlavors} category="café simples" />
          </>
        )}
      </div>
      {showParty && (
        <div className="portion-guide">
          <h3>Qual tamanho escolher?</h3>
          <div className="portion-list">
            {portions.map(portion => (
              <div key={portion.weight}>
                <strong>{portion.weight}</strong>
                <span>{portion.people}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

interface Flavor {
  name: string
  description: string
}

function MenuGroup({ title, price, unit, flavors, category }: { title: string; price: string; unit: string; flavors: readonly Flavor[]; category: string }) {
  return (
    <section className="menu-group" aria-label={title}>
      <div className="menu-group-heading">
        <h3>{title}</h3>
        <p>
          <strong>{price}</strong>
          <span>{unit}</span>
        </p>
      </div>
      <div className="flavor-list">
        {flavors.map(flavor => (
          <article className="flavor-row" key={flavor.name}>
            <div>
              <h4>{flavor.name}</h4>
              {flavor.description && <p>{flavor.description}</p>}
            </div>
            <Button asChild variant="order">
              <a href={whatsapp(`${flavor.name} (${category})`)} target="_blank" rel="noreferrer" aria-label={`Pedir ${flavor.name}, bolo para ${category}, pelo WhatsApp`}>
                <span>Pedir</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}

/* --------------------------- Sobre e localização --------------------------- */

function About() {
  return (
    <section className="about" id="sobre" aria-labelledby="about-title">
      <div className="bakery-container about-grid">
        <div className="about-copy" data-reveal>
          <h2 id="about-title">Feito à mão desde 2003</h2>
          <p>
            Há mais de vinte anos a Ondina faz bolos para os cafés e as festas de São Miguel Arcanjo. Cada pedido é preparado
            na nossa cozinha, com os recheios do cardápio e a decoração que você combinar com a gente.
          </p>
          <p>
            Entregamos sem taxa no perímetro urbano. Se preferir, retire seu bolo na {BUSINESS.street}, {BUSINESS.district}.
          </p>
          <img className="about-photo" src={aboutPhoto} alt="Três bolos da Ondina decorados" loading="lazy" decoding="async" width={1584} height={672} />
        </div>
        <div className="about-map" data-reveal>
          <div className="map-frame">
            <iframe
              title={`Mapa: ${BUSINESS.name}, ${BUSINESS.street}, ${BUSINESS.city}`}
              src={BUSINESS.mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <address>
            <MapPin size={18} aria-hidden="true" />
            <span>
              {BUSINESS.street} — {BUSINESS.district}
              <br />
              {BUSINESS.city} – {BUSINESS.region}
            </span>
          </address>
          <Button asChild variant="cocoa">
            <a href={BUSINESS.mapsUrl} target="_blank" rel="noreferrer">
              <MapPin aria-hidden="true" />
              Abrir no Google Maps
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- Depoimentos ------------------------------- */

function Testimonials() {
  return (
    <section className="bakery-container testimonials" aria-labelledby="testimonials-title">
      <h2 id="testimonials-title">O que dizem nossos clientes</h2>
      <div className="testimonial-grid">
        {testimonials.map((item, index) => (
          <figure className="testimonial" key={`${item.author}-${index}`} data-reveal style={stagger(index)}>
            <Quote aria-hidden="true" />
            <blockquote>{item.quote}</blockquote>
            <figcaption>
              {item.author}
              {item.source && <span>, no {item.source}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

/* ------------------------ Horários e informações ------------------------ */

function ServiceInfo() {
  return (
    <section className="service-info" aria-labelledby="service-title">
      <div className="bakery-container">
        <h2 id="service-title">Entrega e atendimento</h2>
        <div className="service-columns">
          <div>
            <h3>
              <Clock size={16} aria-hidden="true" />
              Horários
            </h3>
            <dl>
              {BUSINESS.hours.map(hour => (
                <div key={hour.label}>
                  <dt>{hour.label}</dt>
                  <dd>{hour.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3>
              <Truck size={16} aria-hidden="true" />
              Entrega e retirada
            </h3>
            <p>Entregamos sem taxa no perímetro urbano de São Miguel Arcanjo.</p>
            <p>
              Para outras localidades, retire seu bolo na {BUSINESS.street} — {BUSINESS.district}, durante o horário de funcionamento.
            </p>
          </div>
          <div>
            <h3>
              <Package size={16} aria-hidden="true" />
              Caixa para viagem
            </h3>
            <p className="packaging-price">{formatBRL(10)}</p>
            <p>Embalagem para transportar seu bolo em viagens.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bakery-footer">
      <div className="bakery-container">
        <div className="footer-columns">
          <div>
            <h2 className="footer-title">Ondina Bolos</h2>
            <p className="footer-copy">Desde 2003, presente nos seus momentos doces.</p>
          </div>
          <div>
            <p className="footer-label">Fale com a Ondina</p>
            <a className="footer-phone" href={`tel:${BUSINESS.phoneE164}`}>
              {BUSINESS.phoneDisplay}
            </a>
            <a className="footer-link" href={whatsapp()} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden="true" />
              Conversar no WhatsApp
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a className="footer-link" href={BUSINESS.instagram} target="_blank" rel="noreferrer">
              <Instagram size={16} aria-hidden="true" />
              {BUSINESS.instagramHandle} no Instagram
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <div>
            <p className="footer-label">Nossa localização</p>
            <p className="footer-copy">
              {BUSINESS.street} — {BUSINESS.district}
              <br />
              {BUSINESS.city}
            </p>
            <a className="footer-link" href={BUSINESS.mapsUrl} target="_blank" rel="noreferrer">
              <MapPin size={17} aria-hidden="true" />
              Abrir no Google Maps
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Ondina Bolos</span>
          <a href="/admin" className="footer-admin">
            Área da equipe
          </a>
        </div>
      </div>
    </footer>
  )
}
