// All CV content lives here. Edit this file to change what the desk shows.
// Content was collected from https://github.com/Amaculis public repositories.

export interface Project {
  id: string;
  title: string;
  /** One-line pitch shown on the printout / icon tooltip. */
  tagline: string;
  /** Longer description paragraphs. */
  description: string[];
  highlights: string[];
  stack: string[];
  /** Big numbers shown on the printout, optional. */
  stats?: { value: string; label: string }[];
  images?: { src: string; caption: string }[];
  repo: string;
  year: string;
  kind: string;
  /** Where the project lives: a physical object on the desk, or only inside the laptop. */
  onDesk?: 'folder' | 'paper';
  accent: string;
  icon: string;
  /** Finder tags in the laptop OS; colours are defined in TAGS. */
  tags: string[];
}

export const TAGS: Record<string, string> = {
  Security: '#ff453a',
  Optimisation: '#ff9f0a',
  Research: '#30d158',
  Blockchain: '#bf5af2',
  Backend: '#0a84ff',
};

export const profile = {
  // TODO: replace with your real name if you want it on the page.
  name: 'Amaculis',
  handle: 'Amaculis',
  role: 'Software Engineer · Cybersecurity',
  education: 'MSc Cybersecurity — Riga Technical University',
  location: 'Riga, Latvia',
  summary:
    'I build systems that have to be correct and secure by default: guardrails for AI agents, ' +
    'decentralised identity, route optimisation and audit-grade backends.',
  links: [
    { label: 'GitHub', href: 'https://github.com/Amaculis' },
    // { label: 'Email', href: 'mailto:you@example.com' },
    // { label: 'LinkedIn', href: 'https://www.linkedin.com/in/...' },
  ],
  skills: {
    Languages: ['Python', 'Go', 'Java', 'TypeScript', 'C#', 'Solidity', 'SQL'],
    Security: ['Prompt-injection defence', 'Fail-closed design', 'Auth & sessions', 'GDPR-aware data models', 'SSI / DID'],
    Backend: ['PostgreSQL', 'Spring Boot', 'Node.js', 'REST / OpenAPI', 'Docker', 'Caddy'],
    'AI & Optimisation': ['Local LLMs (Llama)', 'LLM-as-judge', 'Timefold Solver', 'Simulated annealing', 'Discrete-event simulation'],
  } as Record<string, string[]>,
};

const gh = (repo: string) => `https://github.com/Amaculis/${repo}`;
const img = (file: string) => `${import.meta.env.BASE_URL}projects/${file}`;

export const projects: Project[] = [
  {
    id: 'agentwarden',
    tags: ['Security'],
    title: 'AgentWarden',
    tagline: 'A semantic firewall between your AI coding agent and your machine.',
    description: [
      'Coding agents run shell commands, edit files and browse the web, and anything they read can carry instructions. ' +
        'AgentWarden intercepts every action and decides allow, deny or ask based on what the action means in the context of the task, not only on what the command is called.',
      'A cascade of deterministic rules, a local Llama 3.1 8B judge and Muse Spark for the hard cases keeps 87.5% of decisions on the machine. ' +
        'Everything the agent reads is scanned for injected instructions. Any error, timeout or unparsable verdict fails closed.',
    ],
    highlights: [
      '0 of 147 red-team attacks got through',
      '~40× cheaper than sending every action to the large model, with the same accuracy',
      'Rules settle clear cases in under 1 ms: secrets, uploads, history rewrites, symlink tricks',
      'Tamper-proof: the agent cannot edit its own policy, kill the daemon or approve its own prompts',
      'Secrets are redacted before anything reaches a model; no telemetry',
    ],
    stack: ['Python 3.12', 'Llama 3.1 8B', 'Muse Spark', 'Claude Code hooks', 'CI evals'],
    stats: [
      { value: '100%', label: 'attacks caught' },
      { value: '~40×', label: 'cheaper' },
      { value: '87.5%', label: 'decided locally' },
    ],
    images: [
      { src: img('agentwarden-demo.gif'), caption: 'A planted instruction tries to send .env to a URL. The hook blocks it.' },
      { src: img('agentwarden-how.png'), caption: 'Rules → local Llama → Muse Spark, plus an injection scanner on every read.' },
    ],
    repo: gh('AgentWarden'),
    year: '2026',
    kind: 'AI security · open source (MIT)',
    onDesk: 'folder',
    accent: '#c0392b',
    icon: '🛡',
  },
  {
    id: 'fleet-planner',
    tags: ['Backend', 'Security'],
    title: 'Fleet Planner',
    tagline: 'Trip planning and bus/driver assignment for a passenger bus company.',
    description: [
      'Internal system for dispatchers to plan trips and assign buses and drivers on a timeline. Roles: admin, dispatcher and driver (the driver view is a PWA).',
      'Secure by default: every endpoint authenticates and authorises server-side, all SQL is compile-checked through sqlc, and illegal states are made unrepresentable in the database itself.',
    ],
    highlights: [
      'No double-booking enforced by a Postgres EXCLUDE USING gist constraint, re-checked in the service layer',
      'Every mutation is audited: who, what, when, before and after, with redaction of personal data',
      'Opaque server-side sessions, CSRF tokens, argon2id passwords, Caddy with automatic TLS and HSTS',
      'Schema ready for payroll without a rewrite; GDPR-aware handling of driver data',
      'Layered handler → service → repository architecture, versioned migrations, CI and Docker',
    ],
    stack: ['Go', 'PostgreSQL', 'sqlc / pgx', 'templ + htmx', 'Tailwind', 'Caddy', 'Docker'],
    stats: [
      { value: '3', label: 'roles' },
      { value: '0', label: 'raw SQL strings' },
      { value: '100%', label: 'mutations audited' },
    ],
    repo: gh('fleet-planner'),
    year: '2026',
    kind: 'Backend · production system',
    onDesk: 'paper',
    accent: '#2c6fbb',
    icon: '🚌',
  },
  {
    id: 'food-delivery',
    tags: ['Optimisation', 'Backend'],
    title: 'Food Delivery Optimizer',
    tagline: 'Vehicle routing on real Latvian roads with a constraint solver.',
    description: [
      'A Spring Boot web application that assigns orders to delivery vehicles and plans their routes to minimise total travel time and distance.',
      'Timefold Solver handles the Vehicle Routing Problem, while GraphHopper computes road-accurate distances from OpenStreetMap data for Latvia. Results are shown on an interactive Leaflet map.',
    ],
    highlights: [
      'Multi-vehicle VRP solved with Timefold (the successor to OptaPlanner)',
      'Real driving and cycling distances from GraphHopper + OSM',
      'REST API documented with Swagger / OpenAPI',
      'Benchmarking with timefold-solver-benchmark, packaged with Docker',
    ],
    stack: ['Java 17', 'Spring Boot 3.5', 'Timefold 1.27', 'GraphHopper 11', 'Leaflet', 'Docker'],
    repo: gh('Food-Delivery-Optimizer'),
    year: '2025',
    kind: 'Optimisation · team project',
    onDesk: 'paper',
    accent: '#d35400',
    icon: '🚴',
  },
  {
    id: 'did-revocation',
    tags: ['Research', 'Security'],
    title: 'DID Offline Revocation',
    tagline: 'How fast does a revoked credential stop working when verifiers are offline? A simulator that answers it. Master’s thesis research.',
    description: [
      'In Self-Sovereign Identity (SSI) systems a verifier must know whether a credential has been revoked. The standard StatusList approach assumes the verifier can reach the issuer, which breaks down for devices that are often offline or never connected at all.',
      'I built a discrete-event simulator (SimPy, every node is its own process) that compares four ways of delivering revocation lists: classic PULL and PUSH, peer-to-peer GOSSIP from a few seed nodes, and MIXED, where credential holders also carry fresh lists between verifiers every time they present a credential.',
      'Result: with PULL the false acceptance rate grows almost linearly with the share of unreachable nodes; GOSSIP holds until about 65 % of nodes are cut off; MIXED keeps it close to zero almost everywhere and propagates fastest, paying for it with the most bandwidth.',
    ],
    highlights: [
      'Metrics: false acceptance rate, propagation delay (mean / p95), coverage, bandwidth and storage per node',
      'Parallel 1D and 2D parameter sweeps with adaptive seeding at high-variance points, 95 % CI plots',
      'Scaling tests up to 1,000,000 nodes',
      'Master’s thesis, Riga Technical University, Cybersecurity',
    ],
    stats: [
      { value: '4', label: 'strategies' },
      { value: '1M', label: 'nodes simulated' },
      { value: '<1%', label: 'false accepts (MIXED)' },
    ],
    stack: ['Python', 'SimPy', 'NetworkX', 'pandas', 'matplotlib', 'seaborn'],
    images: [
      { src: img('did-far.png'), caption: 'False acceptance rate per strategy across online / offline durations.' },
      { src: img('did-dead-ratio.png'), caption: 'Strategies compared as more nodes lose issuer access.' },
    ],
    repo: gh('DID-offline-revocation-gossips-solution'),
    year: '2026',
    kind: 'Research · SSI / decentralised identity',
    accent: '#16a085',
    icon: '🪪',
  },
  {
    id: 'pharma-chain',
    tags: ['Blockchain', 'Backend'],
    title: 'Pharma Integrity Ledger',
    tagline: 'Tamper-proof audit trail for pharmaceutical manufacturing, anchored on a private blockchain.',
    description: [
      'Drug makers (MAH) and contract manufacturers (CMO) need to prove that production, packaging and quality-control records were never altered, without handing their data to anyone. This system makes that provable and cheaper to audit.',
      'Sensitive data stays in each company’s own database; only a hash and a timestamp go on-chain. An auditor re-hashes the real records and compares them with the blockchain: a match proves they are authentic and unchanged.',
      'Team project of four. My part was the blockchain layer: the AuditRegistry smart contract, the Hardhat node and deployment inside Docker, and the link between the .NET API and the chain.',
    ],
    highlights: [
      'AuditRegistry contract in Solidity: write step hashes, verify them later',
      'Hardhat node + automatic contract deploy in Docker, ABI and address shared with the API',
      'ASP.NET (.NET 10) API with EF Core and PostgreSQL; whole system starts with one docker compose up',
    ],
    stack: ['Solidity', 'Hardhat', 'C# / .NET', 'PostgreSQL', 'Docker'],
    repo: gh('Blockchain-based-pharmaceutical-processing-integrity-verification-system'),
    year: '2025',
    kind: 'Blockchain · team project',
    accent: '#8e44ad',
    icon: '💊',
  },
  {
    id: 'vrp-annealing',
    tags: ['Optimisation', 'Research'],
    title: 'VRP · Simulated Annealing',
    tagline: 'Fuel-limited vehicle routing solved with a hand-written metaheuristic.',
    description: [
      'Coursework for Practical Combinatorial Optimisation. Generates random delivery points and searches for routes for one or more vehicles, each with a fuel limit, visiting as many points as possible with minimal distance.',
    ],
    highlights: [
      'Neighbourhood moves: add-unvisited, move, remove, swap and 2-opt',
      'Metropolis acceptance exp(−Δ/T) with geometric cooling',
      'Penalties for skipped points and limit violations; matplotlib route plots',
    ],
    stack: ['Python', 'matplotlib'],
    repo: gh('1mpd_am21169'),
    year: '2025',
    kind: 'Algorithms · coursework',
    accent: '#7f8c8d',
    icon: '🧭',
  },
];
