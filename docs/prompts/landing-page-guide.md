# Prompt para Geração de Landing Page de Alta Conversão

## 📋 Contexto e Objetivo
Crie uma Landing Page moderna e responsiva seguindo as melhores práticas identificadas em páginas com taxas de conversão entre 31% e 96%.

## 🎯 Especificações Obrigatórias

### Estrutura Visual
- **Layout:** Single-page, responsivo mobile-first (70%+ do tráfego é mobile)
- **Design:** Minimalista com hierarquia visual clara
- **Cores:** Paleta de 3 cores max (primária + contraste para CTA + neutra)
- **Tipografia:** Máximo 2 fontes (título + corpo)

### Elementos Essenciais

#### 1. Hero Section (Above the Fold)
- **Título Principal:** 6-10 palavras, foco no benefício principal
- **Subtítulo:** 15-20 palavras, expandindo a proposta de valor
- **Imagem Hero:** Mockup do produto/resultado ou imagem contextual
- **CTA Primário:** Botão com verbo de ação + valor ("Baixe Grátis", "Garanta Seu Desconto")
- **Prova Social Rápida:** Badge numérico (ex: "Mais de 10.000 downloads")

#### 2. Seção de Benefícios
- **3-5 benefícios** em bullet points ou cards
- Ícones visuais para cada benefício
- Texto curto: 1-2 linhas por benefício
- Foco em RESULTADOS, não funcionalidades

#### 3. Formulário de Conversão
- **Posicionamento:** Sticky sidebar (desktop) ou após benefícios (mobile)
- **Campos:**
  - **Baixa fricção:** Nome + Email (conversão ~60-80%)
  - **Média fricção:** + Telefone/Empresa (conversão ~40-60%)
  - **Alta fricção:** + Cargo/Segmento (conversão ~30-45%)
- **Label dos campos:** Placeholders descritivos
- **Botão CTA:** Cor de alto contraste, texto acionável
- **Privacidade:** Mini texto LGPD abaixo do botão

#### 4. Prova Social (Social Proof)
- **Depoimentos:** 2-3 com foto, nome, cargo
- **Logos:** Clientes/parceiros (se aplicável)
- **Números:** Estatísticas de uso ("15.000 empresas confiam")

#### 5. Senso de Urgência (Opcional)
- Contador regressivo (se oferta limitada)
- "Últimas 20 vagas" ou "Promoção termina em X horas"
- Badge de "Oferta exclusiva"

#### 6. Seção FAQ (Opcional para ofertas complexas)
- 3-5 perguntas mais comuns
- Formato accordion para economizar espaço

#### 7. CTA Final
- Repetir o botão principal ao final
- Texto de reforço ("Sim, quero [benefício]!")

### Aspectos Técnicos e Animações

#### Animações Obrigatórias
1. **Fade-in suave:** Elementos aparecem ao scroll (Intersection Observer)
2. **Contador animado:** Números de prova social sobem gradualmente
3. **Hover states:** Botões com transição scale/shadow
4. **Progress bar:** Se formulário em múltiplas etapas
5. **Parallax leve:** Hero section com efeito de profundidade (opcional)

#### Performance
- **Lazy loading:** Imagens abaixo do fold
- **Otimização:** Comprimir imagens (WebP, <100KB cada)
- **Critical CSS:** Inline para Above the Fold
- **Fonte:** Preload da fonte principal

#### Tracking e Conversão
- **Google Analytics 4:** Event tracking no envio do formulário
- **Facebook Pixel:** (se tráfego pago)
- **Heatmap Ready:** Estrutura compatível com Hotjar/Clarity

## 💻 Stack Técnica Recomendada

### Opção 1: HTML Puro (React Artifact)
```
- React + Hooks (useState para formulário)
- Tailwind CSS (utility-first, responsivo)
- Lucide Icons (ícones leves)
- Scroll animations com Intersection Observer
- Form validation nativo HTML5
```

### Opção 2: Next.js (para deploy real)
```
- Next.js 14 (App Router)
- TypeScript
- Tailwind + shadcn/ui
- Zod para validação
- React Hook Form
```

## 📝 Checklist de Copy

### Headlines (Teste A/B Estes Formatos)
- [ ] Benefício direto: "Aumente Suas Vendas em 30 Dias"
- [ ] Pergunta provocativa: "Cansado de [DOR]?"
- [ ] Número + benefício: "3 Passos Para [RESULTADO]"
- [ ] Urgência: "Última Chance: [OFERTA]"

### Princípios de Copywriting
- **Clareza > Criatividade:** Seja direto
- **Benefícios > Recursos:** "Economize 10h/semana" vs "Software com automação"
- **Voz Ativa:** "Baixe agora" vs "O download pode ser feito"
- **Escaneabilidade:** Parágrafos de 2-3 linhas max
- **F-Pattern:** Informações cruciais nas primeiras linhas

## 🎨 Paletas de Cores Sugeridas

### Tech/SaaS
- Primária: `#3B82F6` (Blue)
- CTA: `#10B981` (Green)
- Texto: `#1F2937` (Gray-800)

### E-commerce/Produtos
- Primária: `#EC4899` (Pink)
- CTA: `#F59E0B` (Amber)
- Texto: `#111827` (Gray-900)

### Corporativo/B2B
- Primária: `#6366F1` (Indigo)
- CTA: `#EF4444` (Red)
- Texto: `#374151` (Gray-700)

## 🚀 Casos de Uso por Taxa de Conversão

### Alta Conversão (60-95%) - Público Quente
- Lista própria aquecida
- Retargeting de visitantes do site
- Co-marketing com parceiro confiável
- Oferta irresistível (ex: arquivo gratuito, ferramenta pronta)

### Média Conversão (30-60%) - Público Morno
- Tráfego orgânico qualificado
- Anúncios para público similar
- Newsletter com CTA secundário
- Material educativo de valor

### Baixa Conversão (<30%) - Tráfego Frio
- Anúncios para público amplo
- Oferta complexa/cara sem nurturing
- Formulário com muitos campos
- Falta de prova social

## 📊 Métricas Para Monitorar

### Essenciais
- **Taxa de conversão:** Conversões / Visitantes únicos
- **Tempo médio na página:** >45s é bom sinal
- **Taxa de rejeição:** <40% ideal
- **Scroll depth:** % que chegam ao formulário

### Avançadas
- **Heatmap de cliques:** Onde as pessoas clicam
- **Taxa de abandono do form:** Iniciaram mas não completaram
- **Custo por Lead:** (se tráfego pago)
- **Dispositivo:** % mobile vs desktop

## 🔧 Implementação Técnica das Animações

### 1. Contador Animado
```javascript
// Anima números de 0 até o valor final
useEffect(() => {
  const target = 10000; // valor final
  const duration = 2000; // 2 segundos
  const increment = target / (duration / 16);
  
  let current = 0;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      clearInterval(timer);
      current = target;
    }
    setCount(Math.floor(current));
  }, 16);
}, []);
```

### 2. Scroll Fade-In
```javascript
// Fade in ao entrar na viewport
const { ref, inView } = useInView({
  threshold: 0.2,
  triggerOnce: true
});

<div ref={ref} className={`transition-all duration-700 ${
  inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
}`}>
```

### 3. Validação de Formulário
```javascript
// Validação real-time
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const handleSubmit = (e) => {
  e.preventDefault();
  if (!validateEmail(email)) {
    setError('Email inválido');
    return;
  }
  // Submit logic
};
```

## 🎯 Prompt Final Para IA

**Use este prompt depois de definir os detalhes:**

"Crie uma Landing Page React moderna e responsiva para [TIPO DE OFERTA] com os seguintes elementos:

- Hero section com título '[SEU TÍTULO]', subtítulo '[SEU SUBTÍTULO]' e CTA '[TEXTO CTA]'
- Seção de 4 benefícios usando ícones lucide-react
- Formulário com campos: [LISTAR CAMPOS]
- 3 depoimentos com foto circular
- Footer com links de privacidade
- Paleta de cores: [CORES ESCOLHIDAS]
- Animações: fade-in no scroll, contador animado para estatísticas, hover effects nos botões
- Mobile-first com Tailwind CSS
- Toda a página em um único componente React
- Validação de email no formulário

Estilo visual: [minimalista/moderno/corporativo/criativo]
Público-alvo: [DESCREVER PERSONA]"

## 📚 Referências de Sucesso

- **84% conversão:** Oh la la Dani - Imagens contextuais + formulário simples
- **96% conversão:** Silhouette Brasil - Oferta tangível + divulgação orgânica
- **65% conversão:** Medcel - Formulário inteligente (só pergunta o que não sabe)
- **73% conversão:** SIGA Pregão - CTA em dois passos + cores contrastantes

## ⚠️ Erros Fatais a Evitar

1. ❌ Formulário extenso sem justificativa
2. ❌ CTA genérico ("Enviar", "Submit")
3. ❌ Falta de prova social
4. ❌ Design poluído com muitas distrações
5. ❌ Não funcionar em mobile
6. ❌ Carregamento lento (>3s)
7. ❌ Falar de recursos ao invés de benefícios
8. ❌ Falta de contraste no botão de CTA
9. ❌ Não ter opção de saída (gera frustração)
10. ❌ Usar Lorem Ipsum ou placeholders genéricos

---

**Próximo Passo:** Responda as 4 perguntas estratégicas do início para eu gerar o código otimizado da sua Landing Page específica!
