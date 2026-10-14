import type { ReactNode } from 'react'
import { BookOpen, Boxes, Camera, ClipboardList, Hourglass, KeyRound, Layers, Tag } from 'lucide-react'

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
        O estoque <strong>baixa sozinho</strong> quando um pedido do site é feito com tudo disponível, e volta se o
        pedido for cancelado. Vendas feitas fora do site (balcão, telefone) você diminui aqui.
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
        Ao finalizar, o site confere o estoque. Se faltar algum bolo (ou o cliente pedir mais do que há, ex.: 3 kg com 2
        kg em estoque), o pedido é criado como <strong>PENDENTE (Falta de estoque)</strong> e chega no WhatsApp com{' '}
        <strong>⏳ PEDIDO PENDENTE</strong>. Nada é cobrado.
      </>,
      <>
        Pedido pendente fica <strong>travado</strong>: não dá para mandar para preparo, entrega nem confirmar o
        pagamento, nem pelo seletor de status.
      </>,
      <>
        Para liberar: dê entrada no estoque em <strong>Cardápio do site → Bolos</strong> e, no pedido, toque em{' '}
        <strong>Verificar estoque</strong>. Com estoque suficiente, ele é reservado e o pedido passa para{' '}
        <strong>Aguardando pagamento</strong>.
      </>,
    ],
    tip: <>Se não for possível fazer o bolo, mude o status para Cancelado e avise o cliente na conversa.</>,
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
    tip: (
      <>
        Para trocar a foto de um bolo que já existe: lápis → Enviar foto → Salvar. Se aparecer o aviso de{' '}
        <strong>bolos novos do cardápio padrão</strong>, toque em <strong>Adicionar ao cardápio</strong> para eles
        entrarem no site.
      </>
    ),
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
        Em <strong>Pedidos do site</strong> ficam todos os pedidos, com cliente, endereço (com CEP), itens e total. Use os
        filtros (Em aberto, Pendentes, Aguardando pagamento…) e <strong>Atualizar</strong> para ver os novos.
      </>,
      <>
        Quando o pagamento cair (ex.: Pix), toque em <strong>Confirmar pagamento</strong>: o pedido vai para{' '}
        <strong>Pago / Em preparo</strong>. Pix precisa disso antes do preparo; dinheiro e cartão são pagos na entrega
        ou retirada.
      </>,
      <>
        Depois, mude o <strong>Status da entrega</strong>: Saiu para entrega (ou Pronto para retirada) e Entregue. Cada
        mudança fica no <strong>Histórico</strong> do pedido, com quem fez.
      </>,
    ],
    tip: <>Cancelar um pedido devolve ao estoque o que ele tinha reservado.</>,
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
