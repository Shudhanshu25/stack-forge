import PDFDocument from 'pdfkit';
import type { Simulation, SimulationAnalytics, SimulationTurn } from '@stackforge/shared';
import type { SimulationService } from '../simulations/simulation.service.js';
import { formatInrCompact, formatPercent } from './format.js';

export type ReportFormat = 'json' | 'csv' | 'pdf';

export interface Report {
  contentType: string;
  filename: string;
  body: string | Buffer;
}

const CSV_COLUMNS: [string, (t: SimulationAnalytics['series'][number]) => number | null][] = [
  ['turn', (t) => t.turn],
  ['revenue_inr', (t) => t.revenue / 100],
  ['expenses_inr', (t) => t.expensesTotal / 100],
  ['profit_inr', (t) => t.profit / 100],
  ['cash_inr', (t) => t.cash / 100],
  ['customers', (t) => t.customers],
  ['new_customers', (t) => t.newCustomers],
  ['churned_customers', (t) => t.churnedCustomers],
  ['churn_rate', (t) => t.churnRate],
  ['market_share', (t) => t.marketShare],
  ['customer_satisfaction', (t) => t.customerSatisfaction],
  ['competitor_pressure', (t) => t.competitorPressure],
  ['price_inr', (t) => t.price / 100],
  ['marketing_budget_inr', (t) => t.marketingBudget / 100],
  ['employees', (t) => t.employees],
  ['gross_margin', (t) => t.grossMargin],
  ['burn_rate_inr', (t) => t.burnRate / 100],
  ['runway_months', (t) => t.runwayMonths],
  ['cac_inr', (t) => (t.cac === null ? null : t.cac / 100)],
  ['ltv_inr', (t) => (t.ltv === null ? null : t.ltv / 100)],
  ['demand_index', (t) => t.demandIndex],
];

const csvCell = (value: string | number | null) => {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Simulation reports. Figures come from the simulation service's analytics; this only formats. */
export class ReportService {
  constructor(private readonly simulations: SimulationService) {}

  async build(
    ownerId: string,
    id: string,
    format: ReportFormat,
    requestId?: string,
  ): Promise<Report> {
    const [simulation, turns, analytics] = await Promise.all([
      this.simulations.get(ownerId, id),
      this.simulations.turns(ownerId, id),
      this.simulations.analytics(ownerId, id, requestId),
    ]);
    const base = `${simulation.startupName.replace(/[^\w-]+/g, '-').toLowerCase() || 'simulation'}-turn-${analytics.currentTurn}`;
    if (format === 'json') {
      return {
        contentType: 'application/json',
        filename: `${base}.json`,
        body: JSON.stringify(
          { exportedAt: new Date().toISOString(), simulation, analytics, turns },
          null,
          2,
        ),
      };
    }
    if (format === 'csv') {
      return { contentType: 'text/csv', filename: `${base}.csv`, body: this.csv(analytics, turns) };
    }
    return {
      contentType: 'application/pdf',
      filename: `${base}.pdf`,
      body: await this.pdf(simulation, analytics, turns),
    };
  }

  csv(analytics: SimulationAnalytics, turns: SimulationTurn[]): string {
    const byTurn = new Map(turns.map((t) => [t.turnNumber, t]));
    const header = [...CSV_COLUMNS.map(([name]) => name), 'decisions', 'events'];
    const rows = analytics.series.map((point) => {
      const turn = byTurn.get(point.turn);
      const decisions = turn?.decisions.map((d) => `${d.type}=${d.value}`).join('; ') ?? '';
      const events = turn?.events.map((e) => e.type).join('; ') ?? '';
      return [...CSV_COLUMNS.map(([, get]) => get(point)), decisions, events]
        .map(csvCell)
        .join(',');
    });
    return [header.join(','), ...rows].join('\n') + '\n';
  }

  /** A short printable report: summary, a revenue/profit chart, the turn table, accuracy. */
  pdf(
    simulation: Simulation,
    analytics: SimulationAnalytics,
    turns: SimulationTurn[],
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: { Title: `${simulation.startupName} report` },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );
    const ink = '#111111';
    const muted = '#666666';
    const k = analytics.kpis;
    const latest = analytics.series.at(-1)!;

    doc.fillColor(ink).fontSize(18).text(`${simulation.startupName}: simulation report`);
    doc
      .fontSize(9)
      .fillColor(muted)
      .text(
        `${simulation.productName} · ${simulation.configuration.industry} · ${simulation.agentMode} agents · seed ${simulation.seed} · ` +
          `turn ${analytics.currentTurn} · engine ${simulation.engineVersion} · generated ${new Date().toISOString().slice(0, 10)}`,
      );
    doc.moveDown();
    doc.fillColor(ink).fontSize(11).text('Summary', { underline: true });
    doc.fontSize(9);
    const summary: [string, string][] = [
      ['Cash', formatInrCompact(k.cash.value)],
      ['Revenue (last turn)', formatInrCompact(k.revenue.value)],
      ['Profit (last turn)', formatInrCompact(k.profit.value)],
      ['Customers', String(k.customers.value)],
      ['Monthly churn', formatPercent(k.churnRate.value)],
      ['Market share', formatPercent(k.marketShare.value, 3)],
      ['Gross margin', latest.grossMargin === null ? 'n/a' : formatPercent(latest.grossMargin)],
      [
        'Runway',
        latest.runwayMonths === null
          ? 'not burning cash'
          : `${latest.runwayMonths.toFixed(1)} months`,
      ],
      [
        'Forecast accuracy',
        analytics.forecastAccuracy.revenueMape === null
          ? 'no forecasts compared yet'
          : `revenue MAPE ${analytics.forecastAccuracy.revenueMape.toFixed(1)}% over ${analytics.forecastAccuracy.pairs} turns`,
      ],
    ];
    for (const [label, value] of summary) doc.text(`${label}: ${value}`);
    doc.moveDown();

    this.chart(doc, analytics, 40, doc.y, 515, 160);
    doc.y += 175;
    doc.x = 40;

    doc.fillColor(ink).fontSize(11).text('Turns', { underline: true });
    doc.fontSize(8);
    const columns = ['Turn', 'Revenue', 'Profit', 'Cash', 'Customers', 'Churn', 'Share', 'Events'];
    const widths = [30, 65, 65, 65, 55, 45, 50, 140];
    const row = (cells: string[], color = ink) => {
      const y = doc.y;
      let x = 40;
      cells.forEach((cell, i) => {
        doc
          .fillColor(color)
          .text(cell, x, y, { width: widths[i]!, lineBreak: false, ellipsis: true });
        x += widths[i]!;
      });
      doc.y = y + 12;
    };
    row(columns, muted);
    const byTurn = new Map(turns.map((t) => [t.turnNumber, t]));
    for (const t of analytics.series.slice(1)) {
      if (doc.y > 780) doc.addPage();
      row([
        String(t.turn),
        formatInrCompact(t.revenue),
        formatInrCompact(t.profit),
        formatInrCompact(t.cash),
        String(t.customers),
        formatPercent(t.churnRate),
        formatPercent(t.marketShare, 3),
        byTurn
          .get(t.turn)
          ?.events.map((e) => e.title ?? e.type)
          .join(', ') || '-',
      ]);
    }
    const advice = turns.at(-1)?.advice;
    if (advice?.available) {
      doc.x = 40;
      doc.moveDown();
      doc.fillColor(ink).fontSize(11).text('AI CEO on the latest turn', { underline: true });
      doc.fontSize(9).text(advice.summary).text(`Recommendation: ${advice.recommendation}`);
    }
    doc.x = 40;
    doc.moveDown();
    doc
      .fontSize(7)
      .fillColor(muted)
      .text(
        'Amounts in Indian rupees (Rs; L = lakh, Cr = crore). All figures are computed by the simulation engine.',
      );
    doc.end();
    return done;
  }

  /** Revenue and profit on one rupee axis, drawn as vector lines. */
  private chart(
    doc: PDFKit.PDFDocument,
    analytics: SimulationAnalytics,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const points = analytics.series;
    const values = points.flatMap((p) => [p.revenue, p.profit]);
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;
    const px = (i: number) => x + 40 + (i / Math.max(1, points.length - 1)) * (w - 50);
    const py = (v: number) => y + h - ((v - min) / span) * h;
    doc.fontSize(7).fillColor('#666666');
    for (const v of [max, 0, min]) {
      doc
        .moveTo(x + 40, py(v))
        .lineTo(x + w - 10, py(v))
        .lineWidth(0.4)
        .strokeColor('#dddddd')
        .stroke();
      doc.text(formatInrCompact(v), x, py(v) - 3, { width: 36, align: 'right', lineBreak: false });
    }
    const line = (key: 'revenue' | 'profit', color: string) => {
      points.forEach((p, i) =>
        i === 0 ? doc.moveTo(px(i), py(p[key])) : doc.lineTo(px(i), py(p[key])),
      );
      doc.lineWidth(1.5).strokeColor(color).stroke();
    };
    line('revenue', '#2a78d6');
    line('profit', '#eb6834');
    doc.fillColor('#2a78d6').text('Revenue', x + w - 110, y - 10, { lineBreak: false });
    doc.fillColor('#eb6834').text('Profit', x + w - 60, y - 10, { lineBreak: false });
  }
}
