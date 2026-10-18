import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import type { Order } from '@/lib/order-flow'
import { salesReport } from '@/lib/sales-report'

const PERIODS = [7, 30, 90] as const

const shortDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/** Relatório de vendas: quanto entrou, por onde (site ou WhatsApp) e o que mais vendeu. */
export function AdminReport({ orders }: { orders: readonly Order[] }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7)
  const report = useMemo(() => salesReport(orders, days), [orders, days])
  const peak = Math.max(1, ...report.daily.map(day => day.revenue))
  const topPeak = Math.max(1, ...report.topProducts.map(product => product.revenue))

  return (
    <section className="admin-card admin-report" aria-labelledby="admin-report-title">
      <div className="admin-orders-head">
        <h2 id="admin-report-title">
          <BarChart3 aria-hidden="true" /> Vendas
        </h2>
        <div className="admin-order-filters" role="group" aria-label="Período">
          {PERIODS.map(option => (
            <button key={option} type="button" className="admin-filter" aria-pressed={days === option} onClick={() => setDays(option)}>
              {option} dias
            </button>
          ))}
        </div>
      </div>

      <dl className="admin-report-kpis">
        <div>
          <dt>Vendido (pago)</dt>
          <dd>{formatBRL(report.revenue)}</dd>
        </div>
        <div>
          <dt>Pedidos</dt>
          <dd>
            {report.orders} <small>({report.paidOrders} pagos)</small>
          </dd>
        </div>
        <div>
          <dt>Ticket médio</dt>
          <dd>{formatBRL(report.averageTicket)}</dd>
        </div>
        <div>
          <dt>A receber</dt>
          <dd>{formatBRL(report.openValue)}</dd>
        </div>
      </dl>

      <div className="admin-report-chart" role="img" aria-label={`Vendas pagas por dia nos últimos ${days} dias`}>
        {report.daily.map(day => (
          <div key={day.date} className="admin-report-col" title={`${shortDay(day.date)}: ${formatBRL(day.revenue)} · ${day.orders} pedidos`}>
            <span style={{ height: `${(day.revenue / peak) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="admin-report-axis" aria-hidden="true">
        <span>{shortDay(report.daily[0]!.date)}</span>
        <span>hoje</span>
      </div>

      <div className="admin-report-split">
        <div>
          <h3>Por onde</h3>
          <ul className="admin-report-bars">
            <li>
              <span>Pelo site</span>
              <strong>
                {formatBRL(report.byChannel.site.revenue)} · {report.byChannel.site.orders} pedidos
              </strong>
            </li>
            <li>
              <span>WhatsApp</span>
              <strong>
                {formatBRL(report.byChannel.whatsapp.revenue)} · {report.byChannel.whatsapp.orders} pedidos
              </strong>
            </li>
          </ul>
        </div>
        <div>
          <h3>Mais vendidos</h3>
          {report.topProducts.length === 0 ? (
            <p className="admin-muted">Nenhuma venda paga no período.</p>
          ) : (
            <ul className="admin-report-bars">
              {report.topProducts.map(product => (
                <li key={`${product.name}-${product.unit}`}>
                  <span>
                    {product.name} <small>({product.quantity} {product.unit === 'kg' ? 'kg' : 'un.'})</small>
                  </span>
                  <strong>{formatBRL(product.revenue)}</strong>
                  <i style={{ width: `${(product.revenue / topPeak) * 100}%` }} aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {report.cancelled > 0 && <p className="admin-muted">{report.cancelled} cancelados no período (fora das contas).</p>}
    </section>
  )
}
