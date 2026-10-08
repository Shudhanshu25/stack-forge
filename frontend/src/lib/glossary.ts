/** Definitions shown in tooltips. They match how the simulation service computes each metric. */
export const GLOSSARY = {
  cac: {
    term: 'CAC (customer acquisition cost)',
    text: "This month's marketing spend divided by the customers it brought in. Lower means growth is cheaper.",
  },
  ltv: {
    term: 'LTV (lifetime value)',
    text: 'Revenue per customer per month × gross margin ÷ monthly churn: the gross profit a customer is expected to bring before leaving. Compare it with CAC; LTV well above CAC means growth pays for itself.',
  },
  churn: {
    term: 'Churn',
    text: 'The share of customers at the start of the month who left during it. 5% monthly churn loses roughly half your customers in a year.',
  },
  burnRate: {
    term: 'Burn rate',
    text: 'Cash lost in a month: expenses minus revenue when the startup is loss-making. Zero when profitable.',
  },
  runway: {
    term: 'Runway',
    text: 'Months of cash left at the current burn rate: cash ÷ burn rate. When it reaches zero the startup is bankrupt.',
  },
  marketShare: {
    term: 'Market share',
    text: 'Your customers as a share of everyone in your addressable market.',
  },
  location: {
    term: 'Why location matters',
    text: 'Your city sets what salaries, rent and state compliance cost, and how easy hiring is; these apply to every business. Where customers are local (a cafe more than a SaaS product), it also shapes how many customers there are, how much they can spend and how strong local competitors are. Values are relative to the national average.',
  },
  grossMargin: {
    term: 'Gross margin',
    text: 'Revenue minus variable costs (cost of goods, servicing, logistics), as a share of revenue. What is left to pay for salaries, rent and marketing.',
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
