import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowUpRight, MapPin, MessageCircle, Truck, CakeSlice } from 'lucide-react'
import { Button } from '@/components/ui/button'
import hero from '@/assets/naked_hero.jpg'
import ninho from '@/assets/ninho_nutella.jpg'
import fuba from '@/assets/fuba_goiabada.jpg'
import morango from '@/assets/ninho_morango.jpg'
import prestigio from '@/assets/prestigio.jpg'
import amendoim from '@/assets/amendoim_doce_leite.jpg'
import beijinho from '@/assets/beijinho_abacaxi.jpg'
import chocolate from '@/assets/chocolate_morangos.jpg'
import sonho from '@/assets/sonho_valsa.jpg'
import logo from '@/assets/ondina_logo.jpg.asset.json'
import { CakeBuilder } from '@/components/CakeBuilder'
import { partyFlavors, coffeeFlavors, simpleFlavors, portions } from '@/lib/bakery-menu'

const location = 'https://maps.app.goo.gl/DtPo1uTkxT1tYZCe9'
const whatsapp = (cake?: string) => `https://api.whatsapp.com/send?phone=5515997115450&text=${encodeURIComponent(cake ? `Olá Ondina Bolos 🍰! Gostaria de pedir o bolo ${cake} e combinar tamanho, disponibilidade e entrega ou retirada.` : 'Olá Ondina Bolos 🍰! Gostaria de fazer um pedido e combinar entrega ou retirada.')}`
const cakes = [
 { name: 'Ninho com Nutella', category: 'Festas', image: ninho },
 { name: 'Fubá com goiabada', category: 'Cafés', image: fuba },
 { name: 'Prestígio', category: 'Festas', image: prestigio },
 { name: 'Naked cake', category: 'Festas', image: hero },
 { name: 'Ninho com morango', category: 'Festas', image: morango },
 { name: 'Amendoim com doce de leite', category: 'Cafés', image: amendoim },
 { name: 'Beijinho com abacaxi', category: 'Festas', image: beijinho },
 { name: 'Sonho de valsa', category: 'Festas', image: sonho },
 { name: 'Chocolate com morangos', category: 'Festas', image: chocolate },
]
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
 const [category,setCategory] = useState('Todos')
 const visible = cakes.filter(cake => category === 'Todos' || cake.category === category)
 return <div>
  <nav className="bakery-nav" aria-label="Navegação principal"><div className="bakery-container bakery-nav-inner">
   <a className="brand" href="#" aria-label="Ondina Bolos, início"><img src={logo.url} alt="Logo Ondina Bolos"/><div><div className="brand-name">Ondina Bolos</div><div className="brand-since">DESDE 2003</div></div></a>
   <div className="nav-actions"><a className="nav-catalog" href="#bolos">Nossos bolos</a><a className="nav-catalog" href="#monte">Monte seu bolo</a><a className="nav-location" href={location} target="_blank" rel="noreferrer"><MapPin size={14}/>Localização</a><Button asChild variant="cocoa"><a href={whatsapp()} target="_blank" rel="noreferrer"><MessageCircle/>Pedir agora</a></Button></div>
  </div></nav>
  <main>
   <header className="bakery-container bakery-hero">
     <div><div className="hero-eyebrow"><CakeSlice size={15}/>Bolos para delivery</div><h1>Ondina Bolos<span>Um carinho<br/>em cada fatia.</span></h1><p className="hero-description">Do café da tarde aos momentos de festa.<br/>Escolha seu bolo favorito e combine a entrega com a gente pelo WhatsApp.</p><div className="hero-cta"><Button asChild variant="bakery"><a href={whatsapp()} target="_blank" rel="noreferrer"><MessageCircle/>Pedir pelo WhatsApp<ArrowUpRight/></a></Button><span className="hero-note"><Truck size={16}/>Entrega urbana gratuita em São Miguel Arcanjo</span></div></div>
    <div className="hero-photo-wrap"><img className="hero-photo" src={hero} alt="Naked cake da Ondina com frutas e camadas de recheio" fetchPriority="high"/><div className="hero-caption"><small>Bolos para festas</small><p>Naked cake com frutas</p></div></div>
   </header>
   <section className="bakery-container catalog" id="bolos" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><h2 id="catalog-title">Nossos bolos</h2><p>Um favorito para cada momento.</p></div><div className="catalog-filters" aria-label="Categorias de bolos">{['Todos','Festas','Cafés'].map(item=><Button key={item} variant="filter" aria-pressed={category===item} onClick={()=>setCategory(item)}>{item==='Todos'?'Todos os bolos':`Bolos para ${item.toLowerCase()}`}</Button>)}</div></div>
    <div className="cake-grid" aria-live="polite">{visible.map(cake=><article key={cake.name} className="cake-item"><a href={whatsapp(cake.name)} target="_blank" rel="noreferrer" aria-label={`Consultar ${cake.name} no WhatsApp`}><img className="cake-image" src={cake.image} alt={`Bolo ${cake.name} da Ondina Bolos`} loading="lazy"/></a><p className="cake-category">Bolos para {cake.category.toLowerCase()}</p><h3>{cake.name}</h3><Button asChild variant="order"><a href={whatsapp(cake.name)} target="_blank" rel="noreferrer">Consultar preço e pedir<ArrowUpRight/></a></Button></article>)}</div>
    <p className="photo-note">Imagens preparadas a partir dos nossos bolos. Consulte tamanhos, decoração, disponibilidade e entrega pelo WhatsApp.</p>
     <div className="full-menu">
      {(category === 'Todos' || category === 'Festas') && <MenuGroup title="Bolos para festas" price="R$ 60,00" unit="o quilo" flavors={partyFlavors} category="festas" />}
      {(category === 'Todos' || category === 'Cafés') && <><MenuGroup title="Bolos para café" price="R$ 25,00" unit="Até 13 fatias" flavors={coffeeFlavors} category="café" /><MenuGroup title="Bolos para café simples" price="R$ 20,00" unit="Até 13 fatias" flavors={simpleFlavors} category="café simples" /></>}
     </div>
     {(category === 'Todos' || category === 'Festas') && <div className="portion-guide"><h3>Qual tamanho escolher?</h3><div className="portion-list">{portions.map(portion => <div key={portion.weight}><strong>{portion.weight}</strong><span>{portion.people}</span></div>)}</div></div>}
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
