import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowUpRight, MapPin, MessageCircle, Truck, CakeSlice } from 'lucide-react'
import { Button } from '@/components/ui/button'
import logo from '@/assets/ondina_logo.jpg.asset.json'
import { CakeBuilder } from '@/components/CakeBuilder'
import { partyFlavors, coffeeFlavors, simpleFlavors, portions } from '@/lib/bakery-menu'
import { CATEGORY_LABEL, getProductById, products } from '@/data/products'
import { formatBRL } from '@/lib/format'
import { stagger } from '@/lib/motion'
import { generateContactLink as whatsapp, MAPS_URL as location } from '@/lib/whatsapp'
import type { ProductCategory } from '@/types/product'

type Filter = 'todos' | ProductCategory
const filters: { id: Filter; label: string }[] = [
 { id: 'todos', label: 'Todos os bolos' },
 { id: 'festas', label: CATEGORY_LABEL.festas },
 { id: 'cafes', label: CATEGORY_LABEL.cafes },
]
const heroProduct = getProductById('naked-cake')!

export const Route = createFileRoute('/')({
 head: () => ({meta:[
 {title:'Ondina Bolos | Bolos para delivery'},
 {name:'description',content:'Bolos para festas a R$ 60,00/kg e para café a partir de R$ 20,00. Entrega gratuita no perímetro urbano de São Miguel Arcanjo. Pedidos: (15) 99711-5450.'},
 {property:'og:title',content:'Ondina Bolos | Bolos para delivery'},
 {property:'og:description',content:'Confira sabores, preços e horários da Ondina Bolos. Entrega gratuita no perímetro urbano de São Miguel Arcanjo e pedidos pelo WhatsApp.'},
 {property:'og:type',content:'website'},
 {name:'twitter:card',content:'summary_large_image'},
 ]}), component: Index,
})
function Index() {
 const [category,setCategory] = useState<Filter>('todos')
 const visible = products.filter(product => category === 'todos' || product.category === category)
 const showParty = category !== 'cafes'
 const showCoffee = category !== 'festas'
 return <div>
  <nav className="bakery-nav" aria-label="Navegação principal"><div className="scroll-progress" aria-hidden="true"/><div className="bakery-container bakery-nav-inner">
   <a className="brand" href="#" aria-label="Ondina Bolos, início"><img src={logo.url} alt="Logo Ondina Bolos"/><div><div className="brand-name">Ondina Bolos</div><div className="brand-since">DESDE 2003</div></div></a>
   <div className="nav-actions"><a className="nav-catalog" href="#bolos">Nossos bolos</a><a className="nav-catalog" href="#monte">Monte seu bolo</a><a className="nav-location" href={location} target="_blank" rel="noreferrer"><MapPin size={14}/>Localização</a><Button asChild variant="cocoa"><a href={whatsapp()} target="_blank" rel="noreferrer"><MessageCircle/>Pedir agora</a></Button></div>
  </div></nav>
  <main>
   <header className="bakery-container bakery-hero">
    <div className="hero-copy">
     <div className="hero-eyebrow"><CakeSlice size={15}/>Bolos para delivery</div>
     <h1>
      <span className="hero-line"><span>Ondina Bolos</span></span>
      <span className="hero-line hero-accent"><span>Um carinho</span></span>
      <span className="hero-line hero-accent"><span>em cada fatia.</span></span>
     </h1>
     <p className="hero-description">Do café da tarde aos momentos de festa.<br/>Escolha seu bolo favorito e combine a entrega com a gente pelo WhatsApp.</p>
     <div className="hero-cta"><Button asChild variant="bakery" className="hero-shimmer"><a href={whatsapp()} target="_blank" rel="noreferrer"><MessageCircle/>Pedir pelo WhatsApp<ArrowUpRight/></a></Button><span className="hero-note"><Truck size={16}/>Entrega urbana gratuita em São Miguel Arcanjo</span></div>
    </div>
    <div className="hero-photo-wrap" data-tilt>
     <div className="hero-photo-frame"><img className="hero-photo" src={heroProduct.image} alt="Naked cake da Ondina com frutas e camadas de recheio" fetchPriority="high"/></div>
     <div className="hero-caption"><small>Bolos para festas</small><p>Naked cake com frutas</p></div>
     <HeroSeal/>
    </div>
   </header>
   <section className="bakery-container catalog" id="bolos" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><h2 id="catalog-title">Nossos bolos</h2><p>Um favorito para cada momento.</p></div><div className="catalog-filters" aria-label="Categorias de bolos">{filters.map(filter=><Button key={filter.id} variant="filter" aria-pressed={category===filter.id} onClick={()=>setCategory(filter.id)}>{filter.label}</Button>)}</div></div>
    <div className="cake-grid" key={category} aria-live="polite">{visible.map((product,index)=><article key={product.id} className="cake-item" data-reveal style={stagger(index)}>
     <a className="cake-media" href={whatsapp(product.name)} target="_blank" rel="noreferrer" aria-label={`Consultar ${product.name} no WhatsApp`}><img className="cake-image" src={product.image} alt={`Bolo ${product.name} da Ondina Bolos`} loading="lazy"/></a>
     <p className="cake-category">{CATEGORY_LABEL[product.category]}</p>
     <h3>{product.name}</h3>
     <p className="cake-price"><strong>{formatBRL(product.price)}</strong> {product.priceUnit}</p>
     <Button asChild variant="order"><a href={whatsapp(product.name)} target="_blank" rel="noreferrer">Pedir pelo WhatsApp<ArrowUpRight/></a></Button>
    </article>)}</div>
    <p className="photo-note">Imagens preparadas a partir dos nossos bolos. Consulte tamanhos, decoração, disponibilidade e entrega pelo WhatsApp.</p>
     <div className="full-menu">
      {showParty && <MenuGroup title="Bolos para festas" price={formatBRL(60)} unit="o quilo" flavors={partyFlavors} category="festas" />}
      {showCoffee && <><MenuGroup title="Bolos para café" price={formatBRL(25)} unit="Até 13 fatias" flavors={coffeeFlavors} category="café" /><MenuGroup title="Bolos para café simples" price={formatBRL(20)} unit="Até 13 fatias" flavors={simpleFlavors} category="café simples" /></>}
     </div>
     {showParty && <div className="portion-guide"><h3>Qual tamanho escolher?</h3><div className="portion-list">{portions.map(portion => <div key={portion.weight}><strong>{portion.weight}</strong><span>{portion.people}</span></div>)}</div></div>}
   </section>
    <CakeBuilder/>
    <section className="service-info" aria-labelledby="service-title"><div className="bakery-container"><h2 id="service-title">Entrega e atendimento</h2><div className="service-columns"><div><h3>Horários</h3><dl><div><dt>Segunda a sexta</dt><dd>07:00 às 18:00</dd></div><div><dt>Sábado</dt><dd>07:00 às 20:00</dd></div><div><dt>Domingo</dt><dd>Fechado</dd></div></dl></div><div><h3>Entrega e retirada</h3><p>Entregamos sem taxa no perímetro urbano de São Miguel Arcanjo.</p><p>Para outras localidades, retire seu bolo na Rua Tapixi, 412 — Vila Tomaz, durante o horário de funcionamento.</p><Button asChild variant="order"><a href={location} target="_blank" rel="noreferrer"><MapPin size={16}/>Ver no mapa<ArrowUpRight/></a></Button></div><div><h3>Caixa para viagem</h3><p className="packaging-price">R$ 10,00</p><p>Embalagem para transportar seu bolo em viagens.</p></div></div></div></section>
  </main>
   <footer className="bakery-footer"><div className="bakery-container"><div className="footer-columns"><div><h2 className="footer-title">Ondina Bolos</h2><p className="footer-copy">Desde 2003, presente nos seus momentos doces.</p></div><div><p className="footer-label">Fale com a Ondina</p><a className="footer-phone" href="tel:+5515997115450">+55 15 99711-5450</a><a className="footer-link" href={whatsapp()} target="_blank" rel="noreferrer"><MessageCircle size={16}/>Conversar no WhatsApp<ArrowUpRight size={14}/></a></div><div><p className="footer-label">Nossa localização</p><p className="footer-copy">Rua Tapixi, 412 — Vila Tomaz<br/>São Miguel Arcanjo</p><a className="footer-link" href={location} target="_blank" rel="noreferrer"><MapPin size={17}/>Abrir no Google Maps<ArrowUpRight size={14}/></a></div></div><div className="footer-bottom"><span>© 2026 Ondina Bolos</span><span>Desde 2003</span></div></div></footer>
 </div>
}

function MenuGroup({ title, price, unit, flavors, category }: { title: string; price: string; unit: string; flavors: { name: string; description: string }[]; category: string }) {
 return <section className="menu-group" aria-label={title}><div className="menu-group-heading"><h3>{title}</h3><p><strong>{price}</strong><span>{unit}</span></p></div><div className="flavor-list">{flavors.map(flavor => <article className="flavor-row" key={flavor.name}><div><h4>{flavor.name}</h4>{flavor.description && <p>{flavor.description}</p>}</div><Button asChild variant="order"><a href={whatsapp(`${flavor.name} (${category})`)} target="_blank" rel="noreferrer" aria-label={`Pedir ${flavor.name}, bolo para ${category}`}><span>Pedir</span><ArrowUpRight size={17}/></a></Button></article>)}</div></section>
}

/** Selo que gira devagar sobre a foto do topo. */
function HeroSeal() {
 return <svg className="hero-seal" viewBox="0 0 120 120" aria-hidden="true">
  <defs><path id="seal-circle" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs>
  <circle cx="60" cy="60" r="58" className="hero-seal-disc"/>
  <g className="hero-seal-ring"><text><textPath href="#seal-circle" textLength="272" lengthAdjust="spacing">Ondina Bolos ✦ desde 2003 ✦ feito à mão ✦</textPath></text></g>
  <text x="60" y="68" textAnchor="middle" className="hero-seal-mark">O</text>
 </svg>
}
