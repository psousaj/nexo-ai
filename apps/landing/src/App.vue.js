import {
	Bot,
	BrainCircuit,
	Clapperboard,
	Gamepad2,
	Link2,
	Menu,
	MessageCircle,
	Send,
	StickyNote,
	X,
} from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
const isMenuOpen = ref(false);
const usersCount = ref(0);
// Animação do contador
onMounted(() => {
	const target = 1534;
	const duration = 2000;
	const increment = target / (duration / 16);
	let current = 0;
	const timer = setInterval(() => {
		current += increment;
		if (current >= target) {
			clearInterval(timer);
			current = target;
		}
		usersCount.value = Math.floor(current);
	}, 16);
});
const features = [
	{
		icon: Clapperboard,
		title: 'Filmes e Séries',
		description: 'Envie o nome e receba info completa do TMDB, notas e onde assistir.',
	},
	{
		icon: Link2,
		title: 'Links Inteligentes',
		description: 'Guarde links de artigos e vídeos. O Nexo lê o conteúdo e categoriza pra você.',
	},
	{
		icon: StickyNote,
		title: 'Notas Rápidas',
		description: 'Transforme áudios e textos em tarefas e lembretes organizados.',
	},
	{
		icon: BrainCircuit,
		title: 'Busca Semântica',
		description: "Encontre aquele filme que 'tem um cara numa ilha' sem lembrar o nome.",
	},
];
const testimonials = [
	{
		name: 'Ana Silva',
		role: 'Designer',
		text: 'Finalmente parei de perder recomendações de filmes nas conversas de WhatsApp. O Nexo salva tudo!',
		image: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
	},
	{
		name: 'Lucas Costa',
		role: 'Dev',
		text: 'A integração com Telegram é insana. Mando links o dia todo e depois acho tudo fácil no dashboard.',
		image: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
	},
	{
		name: 'Beatriz M.',
		role: 'Estudante',
		text: 'Uso pra salvar referências de estudo. Melhora muito minha organização sem ter que sair do chat.',
		image: 'https://i.pravatar.cc/150?u=a04258114e29026302d',
	},
];
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection
// CSS variable injection end
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-primary-200 selection:text-primary-900' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.nav,
	__VLS_intrinsicElements.nav,
)({
	...{ class: 'fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex justify-between items-center h-16' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex items-center gap-2' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'bg-primary-600 p-1.5 rounded-lg' },
});
const __VLS_0 = {}.Bot;
/** @type {[typeof __VLS_components.Bot, ]} */
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(
	__VLS_0,
	new __VLS_0({
		...{ class: 'w-6 h-6 text-white' },
	}),
);
const __VLS_2 = __VLS_1(
	{
		...{ class: 'w-6 h-6 text-white' },
	},
	...__VLS_functionalComponentArgsRest(__VLS_1),
);
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'font-bold text-xl tracking-tight' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'hidden md:flex items-center space-x-8' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: '#features',
	...{ class: 'text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: '#how-it-works',
	...{ class: 'text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.button,
	__VLS_intrinsicElements.button,
)({
	...{
		class:
			'bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40',
	},
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'md:hidden' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.button,
	__VLS_intrinsicElements.button,
)({
	...{
		onClick: (...[_$event]) => {
			__VLS_ctx.isMenuOpen = !__VLS_ctx.isMenuOpen;
		},
	},
	...{ class: 'text-slate-600' },
});
if (!__VLS_ctx.isMenuOpen) {
	const __VLS_4 = {}.Menu;
	/** @type {[typeof __VLS_components.Menu, ]} */
	// @ts-ignore
	const __VLS_5 = __VLS_asFunctionalComponent(
		__VLS_4,
		new __VLS_4({
			...{ class: 'w-6 h-6' },
		}),
	);
	const __VLS_6 = __VLS_5(
		{
			...{ class: 'w-6 h-6' },
		},
		...__VLS_functionalComponentArgsRest(__VLS_5),
	);
} else {
	const __VLS_8 = {}.X;
	/** @type {[typeof __VLS_components.X, ]} */
	// @ts-ignore
	const __VLS_9 = __VLS_asFunctionalComponent(
		__VLS_8,
		new __VLS_8({
			...{ class: 'w-6 h-6' },
		}),
	);
	const __VLS_10 = __VLS_9(
		{
			...{ class: 'w-6 h-6' },
		},
		...__VLS_functionalComponentArgsRest(__VLS_9),
	);
}
if (__VLS_ctx.isMenuOpen) {
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.div,
		__VLS_intrinsicElements.div,
	)({
		...{ class: 'md:hidden bg-white border-t border-slate-100' },
	});
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.div,
		__VLS_intrinsicElements.div,
	)({
		...{ class: 'px-4 pt-2 pb-6 space-y-2' },
	});
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.a,
		__VLS_intrinsicElements.a,
	)({
		href: '#features',
		...{ class: 'block py-3 text-base font-medium text-slate-600' },
	});
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.a,
		__VLS_intrinsicElements.a,
	)({
		href: '#how-it-works',
		...{ class: 'block py-3 text-base font-medium text-slate-600' },
	});
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.button,
		__VLS_intrinsicElements.button,
	)({
		...{ class: 'w-full mt-4 bg-primary-600 text-white px-5 py-3 rounded-xl font-medium' },
	});
}
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.section,
	__VLS_intrinsicElements.section,
)({
	...{ class: 'relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'absolute inset-0 -z-10' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] bg-primary-200/40 rounded-full blur-3xl' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'absolute bottom-0 left-0 -ml-32 -mb-32 w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-3xl' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{
		class:
			'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-8 animate-fade-in-up',
	},
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'flex h-2 w-2 relative' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'relative inline-flex rounded-full h-2 w-2 bg-primary-500' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'text-sm font-medium text-slate-600' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h1,
	__VLS_intrinsicElements.h1,
)({
	...{
		class: 'text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-[1.1]',
	},
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex flex-col sm:flex-row gap-4 justify-center items-center mb-16' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: 'https://wa.me/YOUR_NUMBER',
	target: '_blank',
	...{
		class:
			'w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-green-500/20 hover:scale-[1.02]',
	},
});
const __VLS_12 = {}.MessageCircle;
/** @type {[typeof __VLS_components.MessageCircle, ]} */
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(
	__VLS_12,
	new __VLS_12({
		...{ class: 'w-5 h-5 fill-current' },
	}),
);
const __VLS_14 = __VLS_13(
	{
		...{ class: 'w-5 h-5 fill-current' },
	},
	...__VLS_functionalComponentArgsRest(__VLS_13),
);
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: 'https://t.me/YOUR_BOT',
	target: '_blank',
	...{
		class:
			'w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0088cc] hover:bg-[#0077b5] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-blue-500/20 hover:scale-[1.02]',
	},
});
const __VLS_16 = {}.Send;
/** @type {[typeof __VLS_components.Send, ]} */
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(
	__VLS_16,
	new __VLS_16({
		...{ class: 'w-5 h-5 fill-current' },
	}),
);
const __VLS_18 = __VLS_17(
	{
		...{ class: 'w-5 h-5 fill-current' },
	},
	...__VLS_functionalComponentArgsRest(__VLS_17),
);
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: '#',
	...{
		class:
			'w-full sm:w-auto flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-indigo-500/20 hover:scale-[1.02]',
	},
});
const __VLS_20 = {}.Gamepad2;
/** @type {[typeof __VLS_components.Gamepad2, ]} */
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(
	__VLS_20,
	new __VLS_20({
		...{ class: 'w-5 h-5 fill-current' },
	}),
);
const __VLS_22 = __VLS_21(
	{
		...{ class: 'w-5 h-5 fill-current' },
	},
	...__VLS_functionalComponentArgsRest(__VLS_21),
);
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex items-center justify-center gap-2 text-sm text-slate-500' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex -space-x-2' },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
	...{ class: 'w-8 h-8 rounded-full border-2 border-white' },
	src: 'https://i.pravatar.cc/100?u=1',
	alt: '',
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
	...{ class: 'w-8 h-8 rounded-full border-2 border-white' },
	src: 'https://i.pravatar.cc/100?u=2',
	alt: '',
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
	...{ class: 'w-8 h-8 rounded-full border-2 border-white' },
	src: 'https://i.pravatar.cc/100?u=3',
	alt: '',
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'font-bold text-slate-800' },
});
__VLS_ctx.usersCount;
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.section,
	__VLS_intrinsicElements.section,
)({
	id: 'features',
	...{ class: 'py-24 bg-white' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'text-center max-w-3xl mx-auto mb-20' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h2,
	__VLS_intrinsicElements.h2,
)({
	...{ class: 'text-3xl md:text-4xl font-bold text-slate-900 mb-4' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-lg text-slate-600' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'grid md:grid-cols-2 lg:grid-cols-4 gap-8' },
});
for (const [feature, index] of __VLS_getVForSourceType(__VLS_ctx.features)) {
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.div,
		__VLS_intrinsicElements.div,
	)({
		key: index,
		...{
			class:
				'p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all group',
		},
	});
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.div,
		__VLS_intrinsicElements.div,
	)({
		...{
			class:
				'w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-primary-600 transition-colors',
		},
	});
	const __VLS_24 = feature.icon;
	// @ts-ignore
	const __VLS_25 = __VLS_asFunctionalComponent(
		__VLS_24,
		new __VLS_24({
			...{ class: 'w-6 h-6 text-primary-600 group-hover:text-white transition-colors' },
		}),
	);
	const __VLS_26 = __VLS_25(
		{
			...{ class: 'w-6 h-6 text-primary-600 group-hover:text-white transition-colors' },
		},
		...__VLS_functionalComponentArgsRest(__VLS_25),
	);
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.h3,
		__VLS_intrinsicElements.h3,
	)({
		...{ class: 'text-xl font-bold text-slate-900 mb-3' },
	});
	feature.title;
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.p,
		__VLS_intrinsicElements.p,
	)({
		...{ class: 'text-slate-600 leading-relaxed' },
	});
	feature.description;
}
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.section,
	__VLS_intrinsicElements.section,
)({
	id: 'how-it-works',
	...{ class: 'py-24 bg-slate-900 text-white relative overflow-hidden' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{
		class:
			'absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px]',
	},
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'grid lg:grid-cols-2 gap-16 items-center' },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h2,
	__VLS_intrinsicElements.h2,
)({
	...{ class: 'text-3xl md:text-4xl font-bold mb-6' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'space-y-8' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex gap-6' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{
		class:
			'flex-shrink-0 w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20 text-primary-400 font-bold text-xl',
	},
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h3,
	__VLS_intrinsicElements.h3,
)({
	...{ class: 'text-xl font-bold mb-2' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-slate-400' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex gap-6' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{
		class:
			'flex-shrink-0 w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20 text-primary-400 font-bold text-xl',
	},
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h3,
	__VLS_intrinsicElements.h3,
)({
	...{ class: 'text-xl font-bold mb-2' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-slate-400' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex gap-6' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{
		class:
			'flex-shrink-0 w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20 text-primary-400 font-bold text-xl',
	},
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h3,
	__VLS_intrinsicElements.h3,
)({
	...{ class: 'text-xl font-bold mb-2' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-slate-400' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{
		class:
			'bg-slate-800 rounded-2xl p-4 shadow-2xl border border-slate-700 max-w-md mx-auto transform rotate-1 hover:rotate-0 transition-transform duration-500',
	},
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'space-y-4' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex justify-end' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'bg-primary-600 text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[80%]' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex justify-start' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'bg-slate-700 text-slate-100 px-4 py-3 rounded-2xl rounded-tl-none max-w-[90%] shadow-lg' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'font-bold mb-2' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-sm text-yellow-500 mb-2' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-sm mb-3' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex gap-2 text-xs' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'bg-slate-600 px-2 py-1 rounded' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'bg-slate-600 px-2 py-1 rounded' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.section,
	__VLS_intrinsicElements.section,
)({
	...{ class: 'py-24 bg-white' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h2,
	__VLS_intrinsicElements.h2,
)({
	...{ class: 'text-3xl font-bold text-center mb-16 text-slate-900' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'grid md:grid-cols-3 gap-8' },
});
for (const [testimonial, i] of __VLS_getVForSourceType(__VLS_ctx.testimonials)) {
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.div,
		__VLS_intrinsicElements.div,
	)({
		key: i,
		...{ class: 'p-8 bg-slate-50 rounded-2xl' },
	});
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.div,
		__VLS_intrinsicElements.div,
	)({
		...{ class: 'flex items-center gap-4 mb-6' },
	});
	__VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
		src: testimonial.image,
		alt: testimonial.name,
		...{ class: 'w-12 h-12 rounded-full' },
	});
	__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.h4,
		__VLS_intrinsicElements.h4,
	)({
		...{ class: 'font-bold text-slate-900' },
	});
	testimonial.name;
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.p,
		__VLS_intrinsicElements.p,
	)({
		...{ class: 'text-sm text-primary-600' },
	});
	testimonial.role;
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.p,
		__VLS_intrinsicElements.p,
	)({
		...{ class: 'text-slate-600 italic' },
	});
	testimonial.text;
	__VLS_asFunctionalElement(
		__VLS_intrinsicElements.div,
		__VLS_intrinsicElements.div,
	)({
		...{ class: 'flex text-yellow-400 mt-4' },
	});
	for (const [n] of __VLS_getVForSourceType(5)) {
		__VLS_asFunctionalElement(
			__VLS_intrinsicElements.svg,
			__VLS_intrinsicElements.svg,
		)({
			key: n,
			...{ class: 'w-4 h-4 fill-current' },
			viewBox: '0 0 20 20',
		});
		__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
			d: 'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z',
		});
	}
}
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.section,
	__VLS_intrinsicElements.section,
)({
	...{ class: 'py-24 bg-primary-600 text-white text-center' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'max-w-4xl mx-auto px-4' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.h2,
	__VLS_intrinsicElements.h2,
)({
	...{ class: 'text-4xl font-bold mb-6' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-xl text-primary-100 mb-10' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.button,
	__VLS_intrinsicElements.button,
)({
	...{
		class:
			'bg-white text-primary-600 hover:bg-slate-100 px-10 py-4 rounded-full font-bold text-lg shadow-2xl transition-all hover:scale-105',
	},
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'mt-6 text-sm text-primary-200' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.footer,
	__VLS_intrinsicElements.footer,
)({
	...{ class: 'bg-slate-900 text-slate-400 py-12 border-t border-slate-800' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'max-w-7xl mx-auto px-4 text-center' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex items-center justify-center gap-2 mb-8' },
});
const __VLS_28 = {}.Bot;
/** @type {[typeof __VLS_components.Bot, ]} */
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(
	__VLS_28,
	new __VLS_28({
		...{ class: 'w-6 h-6 text-primary-500' },
	}),
);
const __VLS_30 = __VLS_29(
	{
		...{ class: 'w-6 h-6 text-primary-500' },
	},
	...__VLS_functionalComponentArgsRest(__VLS_29),
);
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.span,
	__VLS_intrinsicElements.span,
)({
	...{ class: 'text-white font-bold text-xl' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.div,
	__VLS_intrinsicElements.div,
)({
	...{ class: 'flex justify-center gap-8 mb-8 text-sm' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: '#',
	...{ class: 'hover:text-white transition-colors' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: '#',
	...{ class: 'hover:text-white transition-colors' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.a,
	__VLS_intrinsicElements.a,
)({
	href: '#',
	...{ class: 'hover:text-white transition-colors' },
});
__VLS_asFunctionalElement(
	__VLS_intrinsicElements.p,
	__VLS_intrinsicElements.p,
)({
	...{ class: 'text-sm' },
});
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */
/** @type {__VLS_StyleScopedClasses['font-sans']} */
/** @type {__VLS_StyleScopedClasses['text-slate-900']} */
/** @type {__VLS_StyleScopedClasses['selection:bg-primary-200']} */
/** @type {__VLS_StyleScopedClasses['selection:text-primary-900']} */
/** @type {__VLS_StyleScopedClasses['fixed']} */
/** @type {__VLS_StyleScopedClasses['w-full']} */
/** @type {__VLS_StyleScopedClasses['z-50']} */
/** @type {__VLS_StyleScopedClasses['bg-white/80']} */
/** @type {__VLS_StyleScopedClasses['backdrop-blur-md']} */
/** @type {__VLS_StyleScopedClasses['border-b']} */
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['justify-between']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['h-16']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */
/** @type {__VLS_StyleScopedClasses['p-1.5']} */
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */
/** @type {__VLS_StyleScopedClasses['w-6']} */
/** @type {__VLS_StyleScopedClasses['h-6']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */
/** @type {__VLS_StyleScopedClasses['hidden']} */
/** @type {__VLS_StyleScopedClasses['md:flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['space-x-8']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['font-medium']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['hover:text-primary-600']} */
/** @type {__VLS_StyleScopedClasses['transition-colors']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['font-medium']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['hover:text-primary-600']} */
/** @type {__VLS_StyleScopedClasses['transition-colors']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */
/** @type {__VLS_StyleScopedClasses['hover:bg-primary-700']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['px-5']} */
/** @type {__VLS_StyleScopedClasses['py-2']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['font-medium']} */
/** @type {__VLS_StyleScopedClasses['transition-all']} */
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */
/** @type {__VLS_StyleScopedClasses['shadow-primary-500/20']} */
/** @type {__VLS_StyleScopedClasses['hover:shadow-primary-500/40']} */
/** @type {__VLS_StyleScopedClasses['md:hidden']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['w-6']} */
/** @type {__VLS_StyleScopedClasses['h-6']} */
/** @type {__VLS_StyleScopedClasses['w-6']} */
/** @type {__VLS_StyleScopedClasses['h-6']} */
/** @type {__VLS_StyleScopedClasses['md:hidden']} */
/** @type {__VLS_StyleScopedClasses['bg-white']} */
/** @type {__VLS_StyleScopedClasses['border-t']} */
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['pt-2']} */
/** @type {__VLS_StyleScopedClasses['pb-6']} */
/** @type {__VLS_StyleScopedClasses['space-y-2']} */
/** @type {__VLS_StyleScopedClasses['block']} */
/** @type {__VLS_StyleScopedClasses['py-3']} */
/** @type {__VLS_StyleScopedClasses['text-base']} */
/** @type {__VLS_StyleScopedClasses['font-medium']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['block']} */
/** @type {__VLS_StyleScopedClasses['py-3']} */
/** @type {__VLS_StyleScopedClasses['text-base']} */
/** @type {__VLS_StyleScopedClasses['font-medium']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['w-full']} */
/** @type {__VLS_StyleScopedClasses['mt-4']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['px-5']} */
/** @type {__VLS_StyleScopedClasses['py-3']} */
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */
/** @type {__VLS_StyleScopedClasses['font-medium']} */
/** @type {__VLS_StyleScopedClasses['relative']} */
/** @type {__VLS_StyleScopedClasses['pt-32']} */
/** @type {__VLS_StyleScopedClasses['pb-20']} */
/** @type {__VLS_StyleScopedClasses['lg:pt-48']} */
/** @type {__VLS_StyleScopedClasses['lg:pb-32']} */
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */
/** @type {__VLS_StyleScopedClasses['absolute']} */
/** @type {__VLS_StyleScopedClasses['inset-0']} */
/** @type {__VLS_StyleScopedClasses['-z-10']} */
/** @type {__VLS_StyleScopedClasses['absolute']} */
/** @type {__VLS_StyleScopedClasses['top-0']} */
/** @type {__VLS_StyleScopedClasses['right-0']} */
/** @type {__VLS_StyleScopedClasses['-mr-32']} */
/** @type {__VLS_StyleScopedClasses['-mt-32']} */
/** @type {__VLS_StyleScopedClasses['w-[600px]']} */
/** @type {__VLS_StyleScopedClasses['h-[600px]']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-200/40']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['blur-3xl']} */
/** @type {__VLS_StyleScopedClasses['absolute']} */
/** @type {__VLS_StyleScopedClasses['bottom-0']} */
/** @type {__VLS_StyleScopedClasses['left-0']} */
/** @type {__VLS_StyleScopedClasses['-ml-32']} */
/** @type {__VLS_StyleScopedClasses['-mb-32']} */
/** @type {__VLS_StyleScopedClasses['w-[600px]']} */
/** @type {__VLS_StyleScopedClasses['h-[600px]']} */
/** @type {__VLS_StyleScopedClasses['bg-indigo-200/40']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['blur-3xl']} */
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */
/** @type {__VLS_StyleScopedClasses['text-center']} */
/** @type {__VLS_StyleScopedClasses['inline-flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['py-2']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['bg-white']} */
/** @type {__VLS_StyleScopedClasses['border']} */
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */
/** @type {__VLS_StyleScopedClasses['mb-8']} */
/** @type {__VLS_StyleScopedClasses['animate-fade-in-up']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['h-2']} */
/** @type {__VLS_StyleScopedClasses['w-2']} */
/** @type {__VLS_StyleScopedClasses['relative']} */
/** @type {__VLS_StyleScopedClasses['animate-ping']} */
/** @type {__VLS_StyleScopedClasses['absolute']} */
/** @type {__VLS_StyleScopedClasses['inline-flex']} */
/** @type {__VLS_StyleScopedClasses['h-full']} */
/** @type {__VLS_StyleScopedClasses['w-full']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-400']} */
/** @type {__VLS_StyleScopedClasses['opacity-75']} */
/** @type {__VLS_StyleScopedClasses['relative']} */
/** @type {__VLS_StyleScopedClasses['inline-flex']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['h-2']} */
/** @type {__VLS_StyleScopedClasses['w-2']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-500']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['font-medium']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['text-5xl']} */
/** @type {__VLS_StyleScopedClasses['md:text-7xl']} */
/** @type {__VLS_StyleScopedClasses['font-extrabold']} */
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */
/** @type {__VLS_StyleScopedClasses['text-slate-900']} */
/** @type {__VLS_StyleScopedClasses['mb-8']} */
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['leading-[1.1]']} */
/** @type {__VLS_StyleScopedClasses['text-transparent']} */
/** @type {__VLS_StyleScopedClasses['bg-clip-text']} */
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-r']} */
/** @type {__VLS_StyleScopedClasses['from-primary-600']} */
/** @type {__VLS_StyleScopedClasses['to-indigo-600']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['mb-12']} */
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['flex-col']} */
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */
/** @type {__VLS_StyleScopedClasses['gap-4']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['mb-16']} */
/** @type {__VLS_StyleScopedClasses['w-full']} */
/** @type {__VLS_StyleScopedClasses['sm:w-auto']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['bg-[#25D366]']} */
/** @type {__VLS_StyleScopedClasses['hover:bg-[#20bd5a]']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['px-8']} */
/** @type {__VLS_StyleScopedClasses['py-4']} */
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */
/** @type {__VLS_StyleScopedClasses['font-semibold']} */
/** @type {__VLS_StyleScopedClasses['transition-all']} */
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */
/** @type {__VLS_StyleScopedClasses['shadow-green-500/20']} */
/** @type {__VLS_StyleScopedClasses['hover:scale-[1.02]']} */
/** @type {__VLS_StyleScopedClasses['w-5']} */
/** @type {__VLS_StyleScopedClasses['h-5']} */
/** @type {__VLS_StyleScopedClasses['fill-current']} */
/** @type {__VLS_StyleScopedClasses['w-full']} */
/** @type {__VLS_StyleScopedClasses['sm:w-auto']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['bg-[#0088cc]']} */
/** @type {__VLS_StyleScopedClasses['hover:bg-[#0077b5]']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['px-8']} */
/** @type {__VLS_StyleScopedClasses['py-4']} */
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */
/** @type {__VLS_StyleScopedClasses['font-semibold']} */
/** @type {__VLS_StyleScopedClasses['transition-all']} */
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */
/** @type {__VLS_StyleScopedClasses['shadow-blue-500/20']} */
/** @type {__VLS_StyleScopedClasses['hover:scale-[1.02]']} */
/** @type {__VLS_StyleScopedClasses['w-5']} */
/** @type {__VLS_StyleScopedClasses['h-5']} */
/** @type {__VLS_StyleScopedClasses['fill-current']} */
/** @type {__VLS_StyleScopedClasses['w-full']} */
/** @type {__VLS_StyleScopedClasses['sm:w-auto']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['bg-[#5865F2]']} */
/** @type {__VLS_StyleScopedClasses['hover:bg-[#4752c4]']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['px-8']} */
/** @type {__VLS_StyleScopedClasses['py-4']} */
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */
/** @type {__VLS_StyleScopedClasses['font-semibold']} */
/** @type {__VLS_StyleScopedClasses['transition-all']} */
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */
/** @type {__VLS_StyleScopedClasses['shadow-indigo-500/20']} */
/** @type {__VLS_StyleScopedClasses['hover:scale-[1.02]']} */
/** @type {__VLS_StyleScopedClasses['w-5']} */
/** @type {__VLS_StyleScopedClasses['h-5']} */
/** @type {__VLS_StyleScopedClasses['fill-current']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['-space-x-2']} */
/** @type {__VLS_StyleScopedClasses['w-8']} */
/** @type {__VLS_StyleScopedClasses['h-8']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['border-2']} */
/** @type {__VLS_StyleScopedClasses['border-white']} */
/** @type {__VLS_StyleScopedClasses['w-8']} */
/** @type {__VLS_StyleScopedClasses['h-8']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['border-2']} */
/** @type {__VLS_StyleScopedClasses['border-white']} */
/** @type {__VLS_StyleScopedClasses['w-8']} */
/** @type {__VLS_StyleScopedClasses['h-8']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['border-2']} */
/** @type {__VLS_StyleScopedClasses['border-white']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */
/** @type {__VLS_StyleScopedClasses['py-24']} */
/** @type {__VLS_StyleScopedClasses['bg-white']} */
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */
/** @type {__VLS_StyleScopedClasses['text-center']} */
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['mb-20']} */
/** @type {__VLS_StyleScopedClasses['text-3xl']} */
/** @type {__VLS_StyleScopedClasses['md:text-4xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-slate-900']} */
/** @type {__VLS_StyleScopedClasses['mb-4']} */
/** @type {__VLS_StyleScopedClasses['text-lg']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['grid']} */
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */
/** @type {__VLS_StyleScopedClasses['gap-8']} */
/** @type {__VLS_StyleScopedClasses['p-8']} */
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */
/** @type {__VLS_StyleScopedClasses['border']} */
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */
/** @type {__VLS_StyleScopedClasses['hover:border-primary-200']} */
/** @type {__VLS_StyleScopedClasses['hover:shadow-lg']} */
/** @type {__VLS_StyleScopedClasses['hover:shadow-primary-500/5']} */
/** @type {__VLS_StyleScopedClasses['transition-all']} */
/** @type {__VLS_StyleScopedClasses['group']} */
/** @type {__VLS_StyleScopedClasses['w-12']} */
/** @type {__VLS_StyleScopedClasses['h-12']} */
/** @type {__VLS_StyleScopedClasses['bg-white']} */
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['mb-6']} */
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */
/** @type {__VLS_StyleScopedClasses['group-hover:bg-primary-600']} */
/** @type {__VLS_StyleScopedClasses['transition-colors']} */
/** @type {__VLS_StyleScopedClasses['w-6']} */
/** @type {__VLS_StyleScopedClasses['h-6']} */
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */
/** @type {__VLS_StyleScopedClasses['group-hover:text-white']} */
/** @type {__VLS_StyleScopedClasses['transition-colors']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-slate-900']} */
/** @type {__VLS_StyleScopedClasses['mb-3']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */
/** @type {__VLS_StyleScopedClasses['py-24']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-900']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['relative']} */
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */
/** @type {__VLS_StyleScopedClasses['absolute']} */
/** @type {__VLS_StyleScopedClasses['inset-0']} */
/** @type {__VLS_StyleScopedClasses['opacity-10']} */
/** @type {__VLS_StyleScopedClasses['bg-[radial-gradient(#ffffff33_1px,transparent_1px)]']} */
/** @type {__VLS_StyleScopedClasses['[background-size:16px_16px]']} */
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */
/** @type {__VLS_StyleScopedClasses['relative']} */
/** @type {__VLS_StyleScopedClasses['z-10']} */
/** @type {__VLS_StyleScopedClasses['grid']} */
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */
/** @type {__VLS_StyleScopedClasses['gap-16']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['text-3xl']} */
/** @type {__VLS_StyleScopedClasses['md:text-4xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['mb-6']} */
/** @type {__VLS_StyleScopedClasses['space-y-8']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['gap-6']} */
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */
/** @type {__VLS_StyleScopedClasses['w-12']} */
/** @type {__VLS_StyleScopedClasses['h-12']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-500/10']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['border']} */
/** @type {__VLS_StyleScopedClasses['border-primary-500/20']} */
/** @type {__VLS_StyleScopedClasses['text-primary-400']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['mb-2']} */
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['gap-6']} */
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */
/** @type {__VLS_StyleScopedClasses['w-12']} */
/** @type {__VLS_StyleScopedClasses['h-12']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-500/10']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['border']} */
/** @type {__VLS_StyleScopedClasses['border-primary-500/20']} */
/** @type {__VLS_StyleScopedClasses['text-primary-400']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['mb-2']} */
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['gap-6']} */
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */
/** @type {__VLS_StyleScopedClasses['w-12']} */
/** @type {__VLS_StyleScopedClasses['h-12']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-500/10']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['border']} */
/** @type {__VLS_StyleScopedClasses['border-primary-500/20']} */
/** @type {__VLS_StyleScopedClasses['text-primary-400']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['mb-2']} */
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-800']} */
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */
/** @type {__VLS_StyleScopedClasses['p-4']} */
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */
/** @type {__VLS_StyleScopedClasses['border']} */
/** @type {__VLS_StyleScopedClasses['border-slate-700']} */
/** @type {__VLS_StyleScopedClasses['max-w-md']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['transform']} */
/** @type {__VLS_StyleScopedClasses['rotate-1']} */
/** @type {__VLS_StyleScopedClasses['hover:rotate-0']} */
/** @type {__VLS_StyleScopedClasses['transition-transform']} */
/** @type {__VLS_StyleScopedClasses['duration-500']} */
/** @type {__VLS_StyleScopedClasses['space-y-4']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['justify-end']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['py-2']} */
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */
/** @type {__VLS_StyleScopedClasses['rounded-tr-none']} */
/** @type {__VLS_StyleScopedClasses['max-w-[80%]']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['justify-start']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-700']} */
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['py-3']} */
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */
/** @type {__VLS_StyleScopedClasses['rounded-tl-none']} */
/** @type {__VLS_StyleScopedClasses['max-w-[90%]']} */
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['mb-2']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['text-yellow-500']} */
/** @type {__VLS_StyleScopedClasses['mb-2']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['mb-3']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['text-xs']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-600']} */
/** @type {__VLS_StyleScopedClasses['px-2']} */
/** @type {__VLS_StyleScopedClasses['py-1']} */
/** @type {__VLS_StyleScopedClasses['rounded']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-600']} */
/** @type {__VLS_StyleScopedClasses['px-2']} */
/** @type {__VLS_StyleScopedClasses['py-1']} */
/** @type {__VLS_StyleScopedClasses['rounded']} */
/** @type {__VLS_StyleScopedClasses['py-24']} */
/** @type {__VLS_StyleScopedClasses['bg-white']} */
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */
/** @type {__VLS_StyleScopedClasses['text-3xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-center']} */
/** @type {__VLS_StyleScopedClasses['mb-16']} */
/** @type {__VLS_StyleScopedClasses['text-slate-900']} */
/** @type {__VLS_StyleScopedClasses['grid']} */
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */
/** @type {__VLS_StyleScopedClasses['gap-8']} */
/** @type {__VLS_StyleScopedClasses['p-8']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['gap-4']} */
/** @type {__VLS_StyleScopedClasses['mb-6']} */
/** @type {__VLS_StyleScopedClasses['w-12']} */
/** @type {__VLS_StyleScopedClasses['h-12']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-slate-900']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */
/** @type {__VLS_StyleScopedClasses['italic']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['text-yellow-400']} */
/** @type {__VLS_StyleScopedClasses['mt-4']} */
/** @type {__VLS_StyleScopedClasses['w-4']} */
/** @type {__VLS_StyleScopedClasses['h-4']} */
/** @type {__VLS_StyleScopedClasses['fill-current']} */
/** @type {__VLS_StyleScopedClasses['py-24']} */
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['text-center']} */
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['text-4xl']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['mb-6']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['text-primary-100']} */
/** @type {__VLS_StyleScopedClasses['mb-10']} */
/** @type {__VLS_StyleScopedClasses['bg-white']} */
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */
/** @type {__VLS_StyleScopedClasses['px-10']} */
/** @type {__VLS_StyleScopedClasses['py-4']} */
/** @type {__VLS_StyleScopedClasses['rounded-full']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-lg']} */
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */
/** @type {__VLS_StyleScopedClasses['transition-all']} */
/** @type {__VLS_StyleScopedClasses['hover:scale-105']} */
/** @type {__VLS_StyleScopedClasses['mt-6']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['text-primary-200']} */
/** @type {__VLS_StyleScopedClasses['bg-slate-900']} */
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */
/** @type {__VLS_StyleScopedClasses['py-12']} */
/** @type {__VLS_StyleScopedClasses['border-t']} */
/** @type {__VLS_StyleScopedClasses['border-slate-800']} */
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */
/** @type {__VLS_StyleScopedClasses['mx-auto']} */
/** @type {__VLS_StyleScopedClasses['px-4']} */
/** @type {__VLS_StyleScopedClasses['text-center']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['items-center']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['gap-2']} */
/** @type {__VLS_StyleScopedClasses['mb-8']} */
/** @type {__VLS_StyleScopedClasses['w-6']} */
/** @type {__VLS_StyleScopedClasses['h-6']} */
/** @type {__VLS_StyleScopedClasses['text-primary-500']} */
/** @type {__VLS_StyleScopedClasses['text-white']} */
/** @type {__VLS_StyleScopedClasses['font-bold']} */
/** @type {__VLS_StyleScopedClasses['text-xl']} */
/** @type {__VLS_StyleScopedClasses['flex']} */
/** @type {__VLS_StyleScopedClasses['justify-center']} */
/** @type {__VLS_StyleScopedClasses['gap-8']} */
/** @type {__VLS_StyleScopedClasses['mb-8']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */
/** @type {__VLS_StyleScopedClasses['transition-colors']} */
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */
/** @type {__VLS_StyleScopedClasses['transition-colors']} */
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */
/** @type {__VLS_StyleScopedClasses['transition-colors']} */
/** @type {__VLS_StyleScopedClasses['text-sm']} */
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
	setup() {
		return {
			MessageCircle: MessageCircle,
			Send: Send,
			Gamepad2: Gamepad2,
			Menu: Menu,
			X: X,
			Bot: Bot,
			isMenuOpen: isMenuOpen,
			usersCount: usersCount,
			features: features,
			testimonials: testimonials,
		};
	},
});
export default (await import('vue')).defineComponent({
	setup() {
		return {};
	},
}); /* PartiallyEnd: #4569/main.vue */
