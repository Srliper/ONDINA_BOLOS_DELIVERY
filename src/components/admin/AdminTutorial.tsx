import type { ReactNode } from 'react'
import { BellRing, BookOpen, Boxes, Camera, ClipboardCheck, ClipboardList, Hourglass, KeyRound, Layers, Tag } from 'lucide-react'

interface Lesson {
  id: string
  icon: typeof BookOpen
  title: string
  steps: ReactNode[]
  tip?: ReactNode
}

const LESSONS: Lesson[] = [
  {
    id: 'entrar',
    icon: KeyRound,
    title: 'Entrar e sair do painel',
    steps: [
      <>
        No site, role até o fim da página e toque em <strong>Área da equipe</strong> (ou abra o endereço do site com{' '}
        <code>/admin</code> no final).
      </>,
      <>Toque no seu nome e digite a senha da equipe. Depois, toque em <strong>Entrar</strong>.</>,
      <>Você fica conectado por 12 horas neste aparelho. Para sair, use o botão <strong>Sair</strong> lá em cima.</>,
    ],
    tip: <>A senha nunca aparece no site. Cinco tentativas erradas seguidas bloqueiam o acesso por 5 minutos.</>,
  },
  {
    id: 'estoque',
    icon: Boxes,
    title: 'Marcar o estoque dos bolos',
    steps: [
      <>
        Em <strong>Cardápio do site → Bolos</strong>, cada bolo tem um contador de estoque com <strong>−</strong> e{' '}
        <strong>+</strong>. Cada toque já salva no site.
      </>,
      <>
        Bolos de festa contam em <strong>kg</strong>; bolos de café, em <strong>bolos</strong>; doces e sobremesas, em <strong>unidades</strong>.
      </>,
      <>
        Para digitar um número de uma vez, toque no lápis (<strong>Editar</strong>), preencha <strong>Estoque</strong>{' '}
        e toque em <strong>Salvar</strong>.
      </>,
      <>
        Deixe o estoque <strong>vazio</strong> para um bolo feito sob encomenda: ele fica sempre disponível
        (“Sem controle”).
      </>,
    ],
    tip: (
      <>
        Para o estoque baixar com um toque, confirme o pedido em <strong>Últimos pedidos do site</strong> (veja
        “Confirmar pedido e baixar o estoque”).
      </>
    ),
  },
  {
    id: 'confirmar',
    icon: ClipboardCheck,
    title: 'Confirmar pedido e baixar o estoque',
    steps: [
      <>
        Cada pedido feito no site aparece em <strong>Últimos pedidos do site</strong>, com o mesmo número{' '}
        <strong>OB-…</strong> da mensagem do WhatsApp.
      </>,
      <>
        Depois de combinar com o cliente na conversa, toque em <strong>Confirmar e baixar estoque</strong>. O painel
        tira do estoque os bolos do pedido (nunca abaixo de 0) e mostra o que mudou, ex.: “Prestígio 3 → 1”.
      </>,
      <>
        Errou? Toque em <strong>Desfazer</strong> no pedido: a confirmação some e o estoque volta.
      </>,
      <>Bolos sem controle de estoque e bolos do Monte seu Bolo não mexem no estoque.</>,
    ],
    tip: <>Toque em Atualizar para ver pedidos que chegaram depois que você abriu o painel.</>,
  },
  {
    id: 'esgotou',
    icon: BellRing,
    title: 'Aviso de bolo esgotado no WhatsApp',
    steps: [
      <>
        Quando um bolo chega a <strong>0</strong> (pelo − ou ao confirmar um pedido), aparece o aviso{' '}
        <strong>Esgotou</strong> com o botão <strong>Avisar no WhatsApp</strong>.
      </>,
      <>
        O botão abre o WhatsApp com a mensagem pronta para o número da loja: é só tocar em <strong>Enviar</strong>.
      </>,
      <>
        Em <strong>Cardápio do site</strong>, a faixa <strong>Esgotados agora</strong> lista os bolos zerados e tem o
        mesmo botão.
      </>,
    ],
    tip: (
      <>
        Se o n8n estiver configurado para isso, o aviso também vai sozinho, sem precisar tocar em nada (veja o README).
      </>
    ),
  },
  {
    id: 'pendente',
    icon: Hourglass,
    title: 'Estoque zerado = pedido pendente',
    steps: [
      <>
        Com estoque <strong>0</strong>, o bolo aparece como <strong>Esgotado</strong> no site, mas o cliente ainda pode
        deixar o pedido.
      </>,
      <>
        Nesse caso o site <strong>pula a etapa de pagamento</strong>: o pedido chega no WhatsApp com{' '}
        <strong>⏳ PEDIDO PENDENTE</strong> e forma de pagamento “A combinar”.
      </>,
      <>
        O mesmo vale quando o cliente pede mais do que há em estoque (ex.: pede 3 kg e há 2 kg).
      </>,
      <>Responda na conversa confirmando se dá para fazer e combine o pagamento por lá.</>,
    ],
    tip: <>Em “Últimos pedidos do site”, os pedidos pendentes aparecem com a etiqueta Pendente.</>,
  },
  {
    id: 'precos',
    icon: Tag,
    title: 'Mudar preço, nome ou descrição',
    steps: [
      <>
        Em <strong>Cardápio do site</strong>, escolha a aba (<strong>Bolos</strong>, <strong>Recheios</strong> ou{' '}
        <strong>Camadas</strong>) e toque no lápis do item.
      </>,
      <>
        Troque o <strong>Preço (R$)</strong> — pode usar vírgula, ex.: <code>62,50</code> — e o que mais precisar.
      </>,
      <>
        Toque em <strong>Salvar</strong>. O site muda na hora, inclusive o carrinho de quem já estava comprando.
      </>,
    ],
  },
  {
    id: 'novo-bolo',
    icon: Camera,
    title: 'Adicionar um bolo novo com foto',
    steps: [
      <>
        Na aba <strong>Bolos</strong>, toque em <strong>Adicionar bolo</strong>.
      </>,
      <>
        Preencha <strong>Nome</strong>, <strong>Preço</strong>, <strong>Categoria</strong> (festa, café ou doces e sobremesas),{' '}
        <strong>Como é cobrado</strong> (ex.: “o quilo”) e, se quiser, o <strong>Estoque</strong>.
      </>,
      <>
        Toque em <strong>Enviar foto do celular ou computador</strong> e escolha a foto do bolo. O painel diminui a foto
        sozinho e mostra a prévia.
      </>,
      <>
        Toque em <strong>Salvar</strong>. O bolo já aparece no cardápio do site.
      </>,
    ],
    tip: <>Para trocar a foto de um bolo que já existe: lápis → Enviar foto → Salvar.</>,
  },
  {
    id: 'monte',
    icon: Layers,
    title: 'Recheios e camadas do Monte seu Bolo',
    steps: [
      <>
        As abas <strong>Recheios</strong> e <strong>Camadas</strong> (base, cobertura e decoração) mudam as opções do
        Monte seu Bolo.
      </>,
      <>Para essas fotos, use imagem com fundo transparente (PNG) para a camada encaixar no bolo.</>,
      <>Não dá para excluir a última opção de uma etapa: o cliente sempre precisa ter o que escolher.</>,
    ],
  },
  {
    id: 'pedidos',
    icon: ClipboardList,
    title: 'Acompanhar os pedidos',
    steps: [
      <>
        Todo pedido chega no <strong>WhatsApp da empresa</strong> com um número <strong>OB-…</strong>. Use{' '}
        <strong>Abrir conversas (WhatsApp Web)</strong> no computador.
      </>,
      <>
        Em <strong>Últimos pedidos do site</strong>, toque em <strong>Atualizar</strong> para ver os mais recentes.
        Pedidos pendentes têm a etiqueta <strong>Pendente</strong>; os já confirmados, <strong>Confirmado</strong>.
      </>,
    ],
  },
]

/** Tutorial do painel, dentro do próprio /admin: um passo a passo por tarefa. */
export function AdminTutorial() {
  return (
    <section className="admin-card admin-tutorial" aria-labelledby="admin-tutorial-title">
      <h2 id="admin-tutorial-title">
        <BookOpen aria-hidden="true" /> Tutorial do painel
      </h2>
      <p className="admin-muted">Toque num assunto para ver o passo a passo.</p>
      <div className="admin-lessons">
        {LESSONS.map(({ id, icon: Icon, title, steps, tip }) => (
          <details key={id} className="admin-lesson" id={`tutorial-${id}`}>
            <summary>
              <Icon aria-hidden="true" />
              {title}
            </summary>
            <ol>
              {steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            {tip && <p className="admin-lesson-tip">{tip}</p>}
          </details>
        ))}
      </div>
    </section>
  )
}
