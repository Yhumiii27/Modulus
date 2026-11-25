// The connectors of Modulus and their state (docs/spec/05). Pure list: what each reads or writes, how, and whether it is
// simulated, waiting for a grant of Matrix, or live. EN source strings.
export interface ConnectorDef {
  tool: string;
  object: string;
  nature: 'read' | 'write';
  how: string;
  state: 'simulated' | 'waiting' | 'live';
  request: string;
}

export const CONNECTORS: readonly ConnectorDef[] = [
  { tool: 'Clavis', object: 'clavis.pub_acces', nature: 'read', how: 'Roles Modulus.* at sign-in and on every request', state: 'waiting', request: 'C-1, M-1' },
  { tool: 'Keystone', object: 'keystone.pub_clients, pub_articles, purchase prices (K-1)', nature: 'read', how: 'Customers (D-16), BOM articles (D-5), computed budget (D-7)', state: 'simulated', request: 'K-1, M-1' },
  { tool: 'Keystone', object: 'keystone.pub_couts_projet (K-2)', nature: 'read', how: 'Real cost per post at closure (D-9)', state: 'simulated', request: 'K-2' },
  { tool: 'Arche', object: 'arche.pub_besoins_machines, POST /api/v1/quote-requests', nature: 'read', how: 'Machine needs of the CAPEX, quotation requests of case 1', state: 'waiting', request: 'A-1, A-2' },
  { tool: 'Codex', object: 'POST /api/documents', nature: 'write', how: 'PDF of the sent offers (outbox)', state: 'simulated', request: 'Codex' },
  { tool: 'Matrix', object: 'modulus.pub_catalogue_machines, pub_catalogue_options, pub_cotations, pub_budgets_configurations, pub_configurations_vendues', nature: 'read', how: 'Publications defined by Matrix from the reference queries', state: 'waiting', request: 'M-2' },
];
