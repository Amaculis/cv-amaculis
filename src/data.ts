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
}

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
    title: 'DID Offline Revocation',
    tagline: 'Gossip-based credential revocation for offline verifiers. Master’s thesis research.',
    description: [
      'In Self-Sovereign Identity systems, verifiers must check whether a credential was revoked, but the standard StatusList approach breaks down when verifiers are offline.',
      'This simulation framework compares five propagation strategies (pull, push, gossip, holder-assisted gossip and a hybrid) across node availability, TTL, network size and revocation rate.',
    ],
    highlights: [
      'Metrics: false acceptance rate, propagation delay, bandwidth per node and coverage',
      'Holder-assisted gossip turns every credential presentation into a gossip exchange',
      'Parameter sweeps and 2D heatmaps; parallel runs for 5,000-node networks',
      'Master’s thesis, Riga Technical University, Cybersecurity',
    ],
    stack: ['Python', 'SimPy', 'NetworkX', 'pandas', 'matplotlib'],
    images: [{ src: img('did-heatmap.png'), caption: 'Propagation delay heatmap across network conditions.' }],
    repo: gh('DID-offline-revocation-gossips-solution'),
    year: '2026',
    kind: 'Research · SSI / decentralised identity',
    accent: '#16a085',
    icon: '🪪',
  },
  {
    id: 'pharma-chain',
    title: 'Pharma Integrity Ledger',
    tagline: 'Blockchain auditing of pharmaceutical manufacturing records.',
    description: [
      'A verification system that guarantees integrity and authenticity of production, packaging and quality-control data for medicinal products.',
      'Companies keep sensitive data in their own databases; only hashes and timestamps go to a private blockchain. An auditor re-hashes the data and compares it with the on-chain record.',
    ],
    highlights: [
      'Three roles: Marketing Authorisation Holder, Contract Manufacturer and Auditor',
      'Solidity smart contracts deployed with Hardhat',
      'Node.js API with PostgreSQL, run with Docker Compose',
    ],
    stack: ['Solidity', 'Hardhat', 'Node.js', 'PostgreSQL', 'Docker'],
    repo: gh('Blockchain-based-pharmaceutical-processing-integrity-verification-system'),
    year: '2025',
    kind: 'Blockchain · team project',
    accent: '#8e44ad',
    icon: '💊',
  },
  {
    id: 'vrp-annealing',
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
