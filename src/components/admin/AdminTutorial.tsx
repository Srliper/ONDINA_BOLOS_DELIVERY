import type { ReactNode } from 'react'
import { Bell, BellRing, BookOpen, Boxes, Camera, ClipboardList, CreditCard, Hourglass, KeyRound, Layers, MessageCircle, Tag, Users } from 'lucide-react'

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
    id: 'esgotou',
    icon: BellRing,
    title: 'Aviso de bolo esgotado no WhatsApp',
    steps: [
      <>
        Quando um bolo chega a <strong>0</strong> (pelo − ou quando um pedido do site leva o último), aparece o aviso{' '}
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
        Para trocar a foto de um bolo que já existe: lápis → Enviar foto → Salvar. Bolos novos do cardápio padrão
        entram no site sozinhos; se um bolo padrão for excluído e você quiser de volta, toque em{' '}
        <strong>Devolver ao cardápio</strong> no aviso da aba Bolos.
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
        Pedido pelo WhatsApp chega no <strong>WhatsApp da empresa</strong> com um número <strong>OB-…</strong>. Use{' '}
        <strong>Abrir conversas (WhatsApp Web)</strong> no computador. Pedido pago no site não passa pelo WhatsApp: fica
        só aqui.
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
  {
    id: 'site',
    icon: CreditCard,
    title: 'Pedidos pagos aqui no site',
    steps: [
      <>
        No fim do pedido, o cliente escolhe: <strong>Pagar aqui no site</strong> (Pix ou cartão, pelo Mercado Pago) ou{' '}
        <strong>Finalizar pelo WhatsApp</strong>, como antes.
      </>,
      <>
        Pedido do site aparece com a etiqueta <strong>Pelo site</strong>. Quando o pagamento é aprovado, ele vai{' '}
        <strong>sozinho</strong> para <strong>Pago / Em preparo</strong> — não precisa confirmar. O dinheiro cai na conta
        do Mercado Pago da loja.
      </>,
      <>
        Depois é igual: prepare e mude o status para Saiu para entrega (ou Pronto para retirada) e Entregue.
      </>,
      <>
        Pedido do site <strong>pendente</strong> (sem estoque) não é cobrado. Ao tocar em <strong>Verificar estoque</strong>{' '}
        e liberar, o botão <strong>Pagar agora</strong> aparece na página do pedido do cliente — avise-o pela conversa.
      </>,
    ],
    tip: (
      <>
        Se um pedido pago online for cancelado, devolva o valor pelo painel do Mercado Pago (o histórico do pedido
        lembra você).
      </>
    ),
  },
  {
    id: 'conversa',
    icon: MessageCircle,
    title: 'Conversar com o cliente pelo site',
    steps: [
      <>
        Cada pedido tem uma página para o cliente acompanhar o status e mandar mensagens. Abra{' '}
        <strong>Conversa pelo site</strong> no cartão do pedido para ler e responder.
      </>,
      <>
        Mensagem nova do cliente aparece com a etiqueta <strong>mensagem nova</strong> e no filtro{' '}
        <strong>Mensagens novas</strong>. O que você responde aparece na página do pedido do cliente.
      </>,
      <>
        O telefone do cliente fica no cartão: tocar nele abre o WhatsApp com a mensagem pronta e o link do pedido.{' '}
        <strong>Copiar link do pedido</strong> serve para mandar por onde preferir.
      </>,
    ],
  },
  {
    id: 'procura',
    icon: Users,
    title: 'Clientes esperando bolo esgotado',
    steps: [
      <>
        Quando um bolo está com estoque <strong>0</strong>, o site mostra <strong>Avise-me quando chegar</strong>. O
        cliente deixa nome, WhatsApp e quanto quer.
      </>,
      <>
        Em <strong>Procura por bolos esgotados</strong> você vê, por bolo, quantas pessoas estão esperando, os pedidos
        pendentes e quanto foi pedido no total — a demanda do que está em falta.
      </>,
      <>
        Quando der entrada no estoque, o bolo aparece como <strong>Voltou</strong>. Toque no telefone de cada cliente: o
        WhatsApp abre com a mensagem pronta. Depois toque no <strong>✓</strong> (ou em{' '}
        <strong>Marcar todos como avisados</strong>).
      </>,
    ],
  },
  {
    id: 'avisos',
    icon: Bell,
    title: 'Avisos de pedido novo e para entregar',
    steps: [
      <>
        Com o painel aberto, ele confere sozinho a cada 30 segundos. Chegou pedido novo, pagamento aprovado (pedido{' '}
        <strong>para entregar</strong>), mensagem ou cliente esperando bolo? Toca um aviso e aparece na tela.
      </>,
      <>
        Toque em <strong>Ligar notificações</strong> no quadro <strong>Avisos</strong> para receber a notificação do
        aparelho mesmo com outra aba na frente. O número entre parênteses no título da aba mostra o que precisa de
        atenção.
      </>,
      <>
        O filtro <strong>A entregar</strong> em Pedidos do site mostra só o que já está pago (ou é pago na entrega) e
        falta entregar.
      </>,
    ],
    tip: (
      <>
        Para receber no WhatsApp da loja mesmo com o painel fechado, quem cuida do site liga o aviso do n8n (variável{' '}
        <code>N8N_STORE_ALERT_URL</code>, no README).
      </>
    ),
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
