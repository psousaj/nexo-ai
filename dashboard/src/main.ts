import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { abilitiesPlugin } from '@casl/vue';
import { ability } from './plugins/casl';
import App from './App.vue';
import router from './router/index';
import './assets/css/main.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);
app.use(abilitiesPlugin, ability, {
	useGlobalProperties: true,
});

app.mount('#app');
