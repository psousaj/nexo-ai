# 🎯 Prompt Master: Dashboard Analytics de Alta Performance

## 📚 INSTRUÇÕES OBRIGATÓRIAS DE LEITURA DO REPOSITÓRIO

### 🔍 PASSO 1: Análise Automática do Projeto

Antes de iniciar a construção, você DEVE executar as seguintes ações:

#### A. Ler Documentação do Projeto

```bash
# Localize e leia TODOS os arquivos de documentação:
1. Buscar e ler: /docs/README.md
2. Buscar e ler: /docs/ARCHITECTURE.md
3. Buscar e ler: /docs/API.md ou /docs/api/
4. Buscar e ler: /ROADMAP.md na raiz do projeto
5. Buscar e ler: /CHANGELOG.md para entender evolução
6. Buscar e ler: package.json para entender dependências e scripts
```

**Conteúdo que você DEVE extrair:**

- ✅ Estrutura de dados existente (modelos, schemas, entidades)
- ✅ APIs disponíveis e seus endpoints
- ✅ Convenções de código do projeto (naming, estrutura de pastas)
- ✅ Tecnologias e bibliotecas já implementadas
- ✅ Padrões de autenticação e autorização
- ✅ Features planejadas no roadmap que impactam métricas

#### B. Mapear Estrutura de Dados

```bash
# Identifique os arquivos de modelo de dados:
1. Procurar em: /src/models/ ou /models/
2. Procurar em: /src/types/ ou /types/ (TypeScript)
3. Procurar em: /prisma/schema.prisma (se usar Prisma)
4. Procurar em: /src/database/ ou /db/
5. Procurar em: /src/api/ para entender endpoints de dados
```

**Informações CRÍTICAS a identificar:**

- 📊 Entidades principais (Users, Orders, Products, etc.)
- 🔗 Relacionamentos entre entidades
- 📈 Campos que podem gerar métricas (timestamps, status, valores)
- 🎯 KPIs já implementados ou calculados no backend
- 🔢 Tipos de dados (numéricos, datas, categóricos)

#### C. Verificar APIs e Serviços

```bash
# Mapeie os endpoints disponíveis:
1. Ler: /src/api/routes/ ou /src/routes/
2. Ler: /src/controllers/ para entender lógica de negócio
3. Ler: /src/services/ para identificar cálculos existentes
4. Buscar por: "analytics", "metrics", "reports", "dashboard"
```

**O que você DEVE documentar:**

- 🌐 Endpoints REST disponíveis
- 🔌 WebSockets para dados em tempo real (se houver)
- 📦 Formato de resposta das APIs (JSON schema)
- 🚀 Rate limits ou paginação implementada
- 🔐 Headers de autenticação necessários

---

## 🎨 PROMPT PRINCIPAL PARA DASHBOARD

### Contexto de Negócio

**Você é um Arquiteto de Analytics especializado em criar dashboards modernos, interativos e data-driven. Sua missão é construir um dashboard completo que:**

1. **Integre perfeitamente** com a base de código existente do projeto
2. **Respeite os padrões** já estabelecidos na documentação
3. **Reutilize APIs** e serviços já implementados
4. **Siga o roadmap** para alinhar com features futuras
5. **Entregue insights acionáveis** através de visualizações inteligentes

---

## 📋 ESPECIFICAÇÕES TÉCNICAS DO DASHBOARD

### Fase 1: Definição de Propósito (Baseado em GoodData Best Practices)

#### Perguntas Obrigatórias para Responder:

**Sobre os Usuários:**

1. **Quem são os usuários?** (Executivos, Analistas, Gestores, Clientes?)
2. **Qual problema eles precisam resolver?** (Monitorar vendas, reduzir churn, otimizar conversão?)
3. **Com que frequência usarão?** (Diário, semanal, em momentos específicos?)
4. **Que decisões tomarão baseadas nos dados?** (Aprovar orçamento, ajustar campanha, alocar recursos?)
5. **Qual nível de detalhe precisam?** (Visão macro ou drill-down profundo?)

**Tipos de Dashboard (escolha 1):**

- 📊 **Strategic Dashboard** - Alta gestão, KPIs macro, tendências de longo prazo
- 📈 **Analytical Dashboard** - Analistas, drill-downs profundos, comparações complexas
- 🎯 **Operational Dashboard** - Gestão diária, métricas em tempo real, alertas
- 📱 **Tactical Dashboard** - Equipes específicas, métricas departamentais, metas curto prazo

---

### Fase 2: Arquitetura de Dados

#### A. Modelo de Dados Lógico (LDM - Logical Data Model)

**Você DEVE criar um LDM que:**

```javascript
// Exemplo de estrutura LDM para o dashboard
const dataModel = {
	entities: {
		// Entidades principais (lidas do /src/models/)
		users: {
			attributes: ['id', 'name', 'email', 'created_at', 'plan_type'],
			metrics: ['total_users', 'new_users', 'active_users', 'churn_rate'],
		},
		orders: {
			attributes: ['id', 'user_id', 'status', 'created_at', 'total_amount'],
			metrics: ['total_revenue', 'avg_order_value', 'conversion_rate'],
		},
		products: {
			attributes: ['id', 'name', 'category', 'price'],
			metrics: ['total_products', 'top_selling', 'inventory_turnover'],
		},
	},

	relationships: [
		// Relacionamentos identificados no código
		{ from: 'orders.user_id', to: 'users.id', type: 'many-to-one' },
		{ from: 'order_items.product_id', to: 'products.id', type: 'many-to-one' },
	],

	calculations: {
		// Métricas derivadas (reutilizar do backend se existir)
		mrr: 'SUM(subscriptions.amount WHERE billing_cycle = "monthly")',
		cac: 'SUM(marketing_costs) / COUNT(new_customers)',
		ltv: 'AVG(customer_lifetime_value)',
	},
};
```

**Prioridades do LDM:**

- ✅ **Single Source of Truth** - Métricas calculadas uma vez, usadas em toda parte
- ✅ **Reusabilidade** - Componentes podem ser usados em múltiplos dashboards
- ✅ **Consistência** - Mesma métrica sempre retorna mesmo valor
- ✅ **Performance** - Agregações pré-calculadas quando possível

#### B. Fontes de Dados

**Conexão com Backend (escolha baseado no que existe no repo):**

```typescript
// Opção 1: REST API (verificar em /src/api/)
const fetchDashboardData = async () => {
	const [users, revenue, metrics] = await Promise.all([
		fetch('/api/analytics/users'),
		fetch('/api/analytics/revenue'),
		fetch('/api/analytics/metrics'),
	]);
	// Processar e combinar dados
};

// Opção 2: GraphQL (se disponível em /src/graphql/)
const DASHBOARD_QUERY = gql`
	query DashboardData {
		userMetrics {
			total
			active
			churn
		}
		revenueMetrics {
			mrr
			arr
			growth
		}
		conversionFunnel {
			stage
			count
			rate
		}
	}
`;

// Opção 3: WebSocket (tempo real - verificar em /src/sockets/)
const socket = io('/analytics');
socket.on('metrics:update', (data) => {
	updateDashboard(data);
});
```

**Tratamento de Dados:**

```typescript
// Pipeline de processamento de dados
interface DataPipeline {
	// 1. Extract - Puxar dados das APIs
	extract: () => Promise<RawData[]>;

	// 2. Transform - Limpar, agregar, calcular
	transform: (data: RawData[]) => ProcessedData;

	// 3. Load - Preparar para visualização
	load: (data: ProcessedData) => VisualizationData;

	// 4. Cache - Armazenar para performance
	cache: (data: VisualizationData, ttl: number) => void;
}
```

---

### Fase 3: Arquitetura de Interface

#### Layout e Wireframe (Baseado em Information Architecture)

**Grid System (escolha 1):**

- **Executive Layout** - 2x2 grid, 4 KPIs principais, foco em trends
- **Analytics Layout** - Sidebar + Main, filtros à esquerda, gráficos à direita
- **Operational Layout** - Cards em cascata, prioridade por urgência
- **Mixed Layout** - Hero metrics no topo, grid de detalhes abaixo

**Exemplo de Estrutura:**

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Título, Período, Filtros Globais, Export      │
├──────────────┬──────────────┬──────────────┬───────────┤
│ KPI Card 1   │ KPI Card 2   │ KPI Card 3   │ KPI Card 4│
│ Δ +15%       │ Δ -3%        │ Δ +8%        │ Δ +12%    │
├──────────────┴──────────────┴──────────────┴───────────┤
│  PRIMARY CHART - Tendência temporal principal           │
│  (Line chart, área, coluna)                             │
├──────────────────────────────┬─────────────────────────┤
│  SECONDARY CHART 1            │  SECONDARY CHART 2      │
│  (Breakdown por categoria)    │  (Comparação períodos)  │
├───────────────────────────────┴─────────────────────────┤
│  TABLE - Top performers / Detalhes granulares           │
└─────────────────────────────────────────────────────────┘
```

#### Princípios de Navigation

**Hierarquia de Informação:**

1. **Primary KPIs** (Above the fold, 3-5 métricas críticas)
2. **Trend Visualization** (Gráfico principal de tendência)
3. **Breakdown & Comparison** (Análises secundárias)
4. **Detailed Data** (Tabelas, drill-downs)

**Interatividade:**

- ✅ **Filtros Globais** - Aplicam a todo dashboard (data range, segmento, região)
- ✅ **Filtros Locais** - Específicos de cada visualização
- ✅ **Drill-Down** - Clicar em categoria → Ver detalhes
- ✅ **Drill-Through** - Navegar para dashboard relacionado
- ✅ **Tooltips** - Hover para ver valores exatos e contexto
- ✅ **Cross-Filtering** - Seleção em um gráfico filtra os outros

---

### Fase 4: Visualizações e Componentes

#### Biblioteca de Componentes (escolha baseado no stack do projeto)

**Opções de Charting Library:**

```typescript
// Opção 1: Recharts (React, simples, declarativo)
import { LineChart, BarChart, PieChart, AreaChart } from 'recharts';

// Opção 2: Chart.js (Flexível, canvas-based)
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';

// Opção 3: D3.js (Máxima customização, curva aprendizado alta)
import * as d3 from 'd3';

// Opção 4: Plotly (Interativo, científico)
import Plot from 'react-plotly.js';

// Opção 5: Apache ECharts (Enterprise, rico em features)
import ReactECharts from 'echarts-for-react';
```

**Escolha a biblioteca baseado em:**

- 📊 Já existe no package.json? → Reutilizar
- 🎨 Nível de customização necessário? → D3 > ECharts > Recharts
- 🚀 Performance crítica? → Canvas (Chart.js, ECharts) > SVG (Recharts)
- 📱 Mobile-first? → Recharts (responsivo nativo)

#### Catálogo de Visualizações

**Por Tipo de Insight:**

| Objetivo              | Visualização Recomendada   | Quando Usar                              |
| --------------------- | -------------------------- | ---------------------------------------- |
| **Comparar valores**  | Bar Chart, Column Chart    | Vendas por região, produtos top          |
| **Mostrar tendência** | Line Chart, Area Chart     | Receita ao longo do tempo, crescimento   |
| **Proporção do todo** | Pie Chart, Donut, Treemap  | Market share, distribuição de categorias |
| **Distribuição**      | Histogram, Box Plot        | Faixa etária usuários, preços produtos   |
| **Correlação**        | Scatter Plot, Bubble Chart | LTV vs CAC, engajamento vs conversão     |
| **Ranking**           | Horizontal Bar Chart       | Top 10 produtos, melhores vendedores     |
| **Fluxo/Processo**    | Funnel Chart, Sankey       | Funil de vendas, jornada do usuário      |
| **Geo**               | Map Chart, Heatmap         | Vendas por estado, calor de atividade    |
| **Tabela dinâmica**   | Data Grid com sort/filter  | Listagem detalhada, exports              |

#### Componentes Reutilizáveis

```typescript
// KPI Card Component
interface KPICardProps {
	title: string;
	value: number | string;
	trend: { direction: 'up' | 'down'; percentage: number };
	icon: React.ReactNode;
	color: 'blue' | 'green' | 'red' | 'yellow';
	loading?: boolean;
}

// Chart Wrapper com estados
interface ChartWrapperProps {
	title: string;
	data: any[];
	loading: boolean;
	error: Error | null;
	onRefresh: () => void;
	children: React.ReactNode;
}

// Filter Component
interface FilterProps {
	type: 'date' | 'select' | 'multiselect' | 'search';
	label: string;
	options?: { value: string; label: string }[];
	onChange: (value: any) => void;
	value: any;
}

// Table Component com features
interface TableProps {
	columns: Column[];
	data: any[];
	sortable?: boolean;
	filterable?: boolean;
	exportable?: boolean;
	pagination?: { page: number; pageSize: number };
}
```

---

### Fase 5: Animações e Interatividade

#### Animações Obrigatórias

**1. Loading States (Skeleton Screens)**

```typescript
// Evitar spinners genéricos, usar skeletons contextuais
<KPISkeleton /> // Retângulos pulsando no formato do KPI
<ChartSkeleton /> // Forma do gráfico em gray pulsando
<TableSkeleton rows={5} /> // Linhas de tabela carregando
```

**2. Data Updates (Smooth Transitions)**

```typescript
// Recharts com animação
<LineChart animationDuration={800} animationEasing="ease-in-out">
  {/* Charts atualizam suavemente quando data muda */}
</LineChart>

// Framer Motion para KPIs
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ duration: 0.5 }}
>
  <KPICard value={newValue} />
</motion.div>
```

**3. Micro-Interactions**

```css
/* Hover states para cards */
.kpi-card {
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.kpi-card:hover {
	transform: translateY(-4px);
	box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

/* Active states para filtros */
.filter-button.active {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	transform: scale(1.05);
}
```

**4. Contadores Animados**

```typescript
// Animar números de 0 até valor final
const useCountUp = (end: number, duration: number = 2000) => {
	const [count, setCount] = useState(0);

	useEffect(() => {
		let start = 0;
		const increment = end / (duration / 16);

		const timer = setInterval(() => {
			start += increment;
			if (start >= end) {
				setCount(end);
				clearInterval(timer);
			} else {
				setCount(Math.floor(start));
			}
		}, 16);

		return () => clearInterval(timer);
	}, [end, duration]);

	return count;
};
```

**5. Chart Animations**

```typescript
// Stagger animation - elementos aparecem em sequência
const staggerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1 // 100ms entre cada filho
    }
  }
};

<motion.div variants={staggerVariants} initial="hidden" animate="visible">
  {metrics.map((metric, i) => (
    <motion.div key={i} variants={{ hidden: { y: 20 }, visible: { y: 0 } }}>
      <KPICard {...metric} />
    </motion.div>
  ))}
</motion.div>
```

---

### Fase 6: Customização Visual

#### Design System (Verificar se já existe em /src/styles/ ou /design-system/)

**Se NÃO existir design system:**

```typescript
// Criar tokens de design
export const designTokens = {
	colors: {
		// Primary
		primary: { 50: '#eff6ff', 500: '#3b82f6', 900: '#1e3a8a' },
		// Feedback
		success: { light: '#d1fae5', main: '#10b981', dark: '#065f46' },
		warning: { light: '#fef3c7', main: '#f59e0b', dark: '#92400e' },
		danger: { light: '#fee2e2', main: '#ef4444', dark: '#991b1b' },
		// Neutrals
		gray: { 50: '#f9fafb', 500: '#6b7280', 900: '#111827' },
	},

	typography: {
		heading1: { size: '2rem', weight: 700, lineHeight: 1.2 },
		heading2: { size: '1.5rem', weight: 600, lineHeight: 1.3 },
		body: { size: '1rem', weight: 400, lineHeight: 1.5 },
		caption: { size: '0.875rem', weight: 400, lineHeight: 1.4 },
	},

	spacing: {
		xs: '0.25rem',
		sm: '0.5rem',
		md: '1rem',
		lg: '1.5rem',
		xl: '2rem',
		'2xl': '3rem',
	},

	shadows: {
		sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
		md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
		lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
	},

	borderRadius: {
		sm: '0.25rem',
		md: '0.5rem',
		lg: '0.75rem',
		full: '9999px',
	},
};
```

**Se JÁ existir:** Importar e usar tokens existentes!

#### Paletas de Cores para Gráficos

**Data Visualization Colors (Science-Based):**

```typescript
// Sequencial (para valores ordenados - baixo a alto)
const sequential = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e40af'];

// Divergente (para comparações - negativo/neutro/positivo)
const divergent = ['#dc2626', '#f87171', '#f3f4f6', '#34d399', '#059669'];

// Categórico (para categorias distintas - máximo 8)
const categorical = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

// Acessibilidade (colorblind-friendly)
const accessible = ['#0173b2', '#de8f05', '#029e73', '#cc78bc', '#ca9161'];
```

#### Temas (Light / Dark Mode)

```typescript
const theme = {
	light: {
		background: '#ffffff',
		surface: '#f9fafb',
		text: { primary: '#111827', secondary: '#6b7280' },
		border: '#e5e7eb',
		chart: { grid: '#f3f4f6', axis: '#d1d5db' },
	},
	dark: {
		background: '#0f172a',
		surface: '#1e293b',
		text: { primary: '#f1f5f9', secondary: '#94a3b8' },
		border: '#334155',
		chart: { grid: '#1e293b', axis: '#475569' },
	},
};
```

---

### Fase 7: Performance e Otimização

#### Checklist de Performance

**1. Data Fetching**

```typescript
// ✅ Usar React Query ou SWR para cache e revalidation
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
	queryKey: ['dashboard', filters],
	queryFn: () => fetchDashboardData(filters),
	staleTime: 5 * 60 * 1000, // 5 minutos
	cacheTime: 10 * 60 * 1000, // 10 minutos
});

// ✅ Debounce em filtros que acionam fetch
const debouncedSearch = useDebouncedValue(searchTerm, 500);
```

**2. Rendering Optimization**

```typescript
// ✅ Memoizar componentes pesados
const ExpensiveChart = React.memo(({ data }) => (
  <ComplexVisualization data={data} />
), (prev, next) => prev.data === next.data);

// ✅ Virtualização para listas longas
import { useVirtualizer } from '@tanstack/react-virtual';
// Renderiza apenas itens visíveis no viewport
```

**3. Bundle Size**

```typescript
// ✅ Code splitting por rota
const DashboardPage = lazy(() => import('./pages/Dashboard'));

// ✅ Tree-shaking de libraries
import { LineChart } from 'recharts'; // ✅ Específico
import * as Recharts from 'recharts'; // ❌ Importa tudo
```

**4. Data Processing**

```typescript
// ✅ Processar dados no backend quando possível
// ❌ Evitar: Receber 10k registros e processar no frontend
// ✅ Fazer: Backend retorna dados já agregados

// ✅ Web Workers para processamento pesado
const worker = new Worker('./dataProcessor.worker.ts');
worker.postMessage(largeDataset);
worker.onmessage = (e) => setProcessedData(e.data);
```

---

### Fase 8: Testes e Validação

#### Matriz de Testes

**1. Testes Funcionais**

```typescript
// Testar cálculo de métricas
describe('Dashboard Metrics', () => {
	it('calcula MRR corretamente', () => {
		const subscriptions = [
			{ amount: 100, cycle: 'monthly' },
			{ amount: 50, cycle: 'monthly' },
		];
		expect(calculateMRR(subscriptions)).toBe(150);
	});
});

// Testar filtros
it('filtra dados por período', () => {
	const filtered = filterByDateRange(data, { start: '2024-01-01', end: '2024-01-31' });
	expect(filtered.every((d) => d.date >= '2024-01-01' && d.date <= '2024-01-31')).toBe(true);
});
```

**2. Testes de Performance**

```typescript
// Medir tempo de renderização
import { render, screen } from '@testing-library/react';
import { performance } from 'perf_hooks';

it('renderiza dashboard em menos de 2s', async () => {
  const start = performance.now();
  render(<Dashboard />);
  await screen.findByText('Revenue');
  const end = performance.now();

  expect(end - start).toBeLessThan(2000);
});
```

**3. Testes Visuais (Screenshot)**

```typescript
import { test, expect } from '@playwright/test';

test('dashboard visual regression', async ({ page }) => {
	await page.goto('/dashboard');
	await page.waitForSelector('.chart');
	await expect(page).toHaveScreenshot('dashboard.png');
});
```

**4. Testes de Acessibilidade**

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

it('não tem violações de acessibilidade', async () => {
  const { container } = render(<Dashboard />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

### Fase 9: Documentação e Deploy

#### Documentação a Criar

**1. README.md do Dashboard**

```markdown
# Analytics Dashboard

## Métricas Disponíveis

- **MRR**: Monthly Recurring Revenue - Calculado como soma de...
- **CAC**: Customer Acquisition Cost - Total gasto / Novos clientes
- **Churn Rate**: Taxa de cancelamento mensal

## Filtros

- Data Range: Últimos 7/30/90 dias ou customizado
- Segmento: Enterprise, SMB, Startup
- Região: BR, US, EU

## Como Atualizar Métricas

1. Adicionar cálculo em `/src/services/metricsService.ts`
2. Atualizar tipo em `/src/types/metrics.ts`
3. Adicionar visualização em `/src/components/charts/`

## Troubleshooting

- **Dados não carregam**: Verificar endpoint em Network tab
- **Gráfico quebrado**: Validar formato de data em `transformData()`
```

**2. ARCHITECTURE.md - Seção Dashboard**

```markdown
## Dashboard Architecture

### Data Flow

API → React Query Cache → Transform Layer → Visualization Components

### State Management

- Global filters: Zustand store
- Chart data: React Query
- UI state: Local useState

### Performance Strategies

- Debounced filters (500ms)
- Memoized expensive calculations
- Virtualized tables (>100 rows)
- Cached API responses (5min TTL)
```

---

## 🚀 PROMPT FINAL EXECUTÁVEL

Use este prompt depois de ler toda documentação do projeto:

---

**PROMPT:**

"Você é um Arquiteto de Analytics Senior. Analise completamente o repositório seguindo estas etapas OBRIGATÓRIAS:

**ETAPA 1 - ANÁLISE DO REPOSITÓRIO**

1. Leia e resuma: `/docs/README.md`, `/docs/ARCHITECTURE.md`, `/ROADMAP.md`
2. Identifique modelos de dados em: `/src/models/`, `/src/types/`, `/prisma/`
3. Mapeie APIs em: `/src/api/`, `/src/routes/`, `/src/controllers/`
4. Liste dependências relevantes do `package.json`
5. Identifique padrões de código (naming, estrutura, estado global)

**ETAPA 2 - MODELAGEM DE DADOS**
Com base no que você encontrou, crie:

1. Logical Data Model (LDM) com entidades, atributos e relacionamentos
2. Lista de métricas possíveis baseadas nos dados existentes
3. Endpoints de API necessários (reutilizar existentes ou propor novos)

**ETAPA 3 - DESIGN DO DASHBOARD**
Crie um dashboard [TIPO: Strategic/Analytical/Operational/Tactical] para [USUÁRIO: Executivos/Analistas/etc] que responda estas perguntas de negócio:

- [PERGUNTA 1: Ex: Qual nossa receita mensal recorrente?]
- [PERGUNTA 2: Ex: Qual taxa de churn este mês?]
- [PERGUNTA 3: Ex: Quais produtos mais vendidos?]

**ETAPA 4 - IMPLEMENTAÇÃO**
Construa em React + TypeScript usando:

- Biblioteca de charts: [Recharts/Chart.js/D3] (escolher baseado no que já existe)
- Gerenciamento de estado: [React Query + Zustand/Redux/Context]
- Estilo: Tailwind CSS + Design tokens do projeto (se existir)
- Componentes: Baseados em shadcn/ui ou biblioteca UI do projeto

**FEATURES OBRIGATÓRIAS:**
✅ KPI Cards animados com trends
✅ Filtros globais (data range, segmentação)
✅ 3-5 visualizações principais (line, bar, pie, table)
✅ Drill-down em pelo menos 1 gráfico
✅ Loading states (skeleton screens)
✅ Error handling com retry
✅ Responsive mobile-first
✅ Dark mode toggle
✅ Export para PDF/CSV

**ETAPA 5 - PERFORMANCE**
Implemente:

- React Query para cache (5min stale time)
- Debounce em filtros (500ms)
- Memoização de cálculos pesados
- Lazy loading de gráficos abaixo do fold

**ENTREGÁVEIS:**

1. Código completo do dashboard em 1 arquivo React (artifact)
2. README.md com documentação de uso
3. Lista de endpoints necessários (novos ou existentes)
4. Sugestões de otimização baseadas no código atual"

---

## 📊 EXEMPLOS DE DASHBOARDS POR NICHO

### SaaS B2B

**KPIs Principais:**

- MRR (Monthly Recurring Revenue)
- Churn Rate
- CAC (Customer Acquisition Cost)
- LTV:CAC Ratio
- Active Users (DAU/MAU)

**Visualizações:**

- MRR Growth (Line chart com tendência)
- Churn by Cohort (Stacked area chart)
- CAC vs LTV (Scatter plot)
- Signup Funnel (Funnel chart)
- Top Features Usage (Horizontal bar)

---

### E-commerce

**KPIs Principais:**

- GMV (Gross Merchandise Value)
- Conversion Rate
- Average Order Value
- Cart Abandonment Rate
- Customer Lifetime Value

**Visualizações:**

- Revenue Trend (Area chart)
- Top Products (Bar chart)
- Geo Sales Map (Choropleth map)
- Conversion Funnel (Funnel chart)
- Cohort Retention (Heatmap)

---

### Marketing

**KPIs Principais:**

- Leads Gerados
- CPL (Cost per Lead)
- Conversion Rate (Lead → SQL)
- ROAS (Return on Ad Spend)
- Engagement Rate

**Visualizações:**

- Lead Source Breakdown (Donut chart)
- Campaign Performance (Grouped bar)
- Landing Page Conversion (Table sortable)
- Social Media Reach (Line multi-series)
- Email Performance (Metrics cards)

---

### Financeiro

**KPIs Principais:**

- Revenue
- EBITDA
- Cash Flow
- Burn Rate
- Runway (meses)

**Visualizações:**

- P&L Statement (Waterfall chart)
- Cash Flow (Area chart positivo/negativo)
- Budget vs Actual (Grouped column)
- Expense Breakdown (Treemap)
- Financial Ratios (Gauge charts)

---

## ⚡ QUICK START TEMPLATES

### Template 1: Executive Dashboard (Strategic)

```typescript
import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie } from 'recharts';

const ExecutiveDashboard = () => {
  const [period, setPeriod] = useState('month');

  return (
    <div className="grid grid-cols-4 gap-6 p-6">
      {/* KPI Row */}
      <KPICard title="Revenue" value="$1.2M" trend="+15%" />
      <KPICard title="Users" value="45.2K" trend="+8%" />
      <KPICard title="MRR" value="$850K" trend="+12%" />
      <KPICard title="Churn" value="2.3%" trend="-0.5%" />

      {/* Main Chart */}
      <div className="col-span-4">
        <RevenueChart data={data} period={period} />
      </div>

      {/* Secondary Charts */}
      <div className="col-span-2">
        <UserGrowthChart />
      </div>
      <div className="col-span-2">
        <ConversionFunnel />
      </div>
    </div>
  );
};
```

### Template 2: Analytical Dashboard (Deep Dive)

```typescript
const AnalyticalDashboard = () => {
  const [filters, setFilters] = useState({
    dateRange: 'last30days',
    segment: 'all',
    region: 'all'
  });

  return (
    <div className="flex h-screen">
      {/* Sidebar de Filtros */}
      <aside className="w-64 bg-gray-50 p-4">
        <DateRangeFilter onChange={(v) => setFilters({...filters, dateRange: v})} />
        <SegmentFilter onChange={(v) => setFilters({...filters, segment: v})} />
        <RegionFilter onChange={(v) => setFilters({...filters, region: v})} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <MetricCards filters={filters} />
        <TrendAnalysis filters={filters} />
        <CohortAnalysis filters={filters} />
        <DetailedTable filters={filters} exportable />
      </main>
    </div>
  );
};
```

### Template 3: Real-Time Operational Dashboard

```typescript
const OperationalDashboard = () => {
  // WebSocket para dados em tempo real
  const { data: liveMetrics } = useWebSocket('/ws/metrics');

  return (
    <div className="grid grid-cols-6 gap-4 p-4">
      {/* Alert Banner */}
      {liveMetrics.alerts.length > 0 && (
        <AlertBanner alerts={liveMetrics.alerts} />
      )}

      {/* Live KPIs */}
      <LiveKPI label="Orders/min" value={liveMetrics.ordersPerMin} />
      <LiveKPI label="Active Users" value={liveMetrics.activeUsers} />
      <LiveKPI label="Error Rate" value={liveMetrics.errorRate} alert />

      {/* Real-time Charts */}
      <div className="col-span-4">
        <StreamingChart data={liveMetrics.timeSeries} />
      </div>

      {/* Recent Activity Log */}
      <div className="col-span-2">
        <ActivityFeed items={liveMetrics.recentActivity} />
      </div>
    </div>
  );
};
```

---

## 🎯 CHECKLIST FINAL ANTES DE ENTREGAR

### Funcionalidade

- [ ] Todas métricas calculam corretamente
- [ ] Filtros aplicam em todos gráficos
- [ ] Drill-down funciona
- [ ] Export PDF/CSV implementado
- [ ] Loading states para todas async operations
- [ ] Error boundaries capturam crashes

### Performance

- [ ] Dashboard carrega em < 3s (First Contentful Paint)
- [ ] Filtros não travam (debounced)
- [ ] Gráficos renderizam suavemente
- [ ] Tabelas com +100 linhas são virtualizadas
- [ ] Bundle size < 500KB (gzipped)

### UX/UI

- [ ] Responsivo mobile (testado em 375px, 768px, 1440px)
- [ ] Dark mode implementado
- [ ] Tooltips explicativos nos KPIs
- [ ] Empty states (quando não há dados)
- [ ] Feedback visual em todas interações

### Código

- [ ] TypeScript sem `any`
- [ ] Componentes reutilizáveis
- [ ] Testes unitários (>80% coverage)
- [ ] Documentação inline (JSDoc)
- [ ] Segue padrões do projeto

### Acessibilidade

- [ ] ARIA labels em gráficos
- [ ] Navegação por teclado
- [ ] Contraste adequado (WCAG AA)
- [ ] Screen reader friendly
- [ ] Cores não dependem apenas de cor (patterns/textures)

### Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Build passa sem warnings
- [ ] Documentação atualizada
- [ ] CHANGELOG.md atualizado
- [ ] Demo/preview disponível

---

## 🆘 TROUBLESHOOTING COMUM

### "Dados não aparecem nos gráficos"

```typescript
// Verificar:
1. Console.log(data) → Estrutura está correta?
2. Network tab → API retornou 200?
3. Data transformation → Keys batem com esperado?

// Debug:
console.log('Raw data:', rawData);
console.log('Transformed:', transformedData);
console.log('Chart expects:', { x: 'date', y: 'value' });
```

### "Gráfico quebra ao mudar filtro"

```typescript
// Causa: Data shape muda entre filtros
// Solução: Normalizar sempre para mesma estrutura

const normalizeData = (data) => {
	return data.map((d) => ({
		x: d.date || d.timestamp || d.x,
		y: d.value || d.amount || d.y,
	}));
};
```

### "Performance ruim com muitos dados"

```typescript
// Estratégias:
1. Agregação no backend (10k points → 100 points)
2. Virtualize tabelas (react-window)
3. Throttle re-renders (useMemo, React.memo)
4. Web Worker para cálculos (offload main thread)
```

### "Layout quebra no mobile"

```typescript
// Use grid responsivo:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Auto-ajusta baseado em breakpoint */}
</div>

// Esconda elementos menos críticos:
<div className="hidden lg:block">
  <DetailedChart />
</div>
```

---

**FIM DO PROMPT MASTER**

Use este documento como referência completa para criar dashboards de nível enterprise que integram perfeitamente com qualquer codebase existente.
