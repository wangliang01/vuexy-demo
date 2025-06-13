import '@core/scss/template/index.scss'
import '@styles/styles.scss'

import App from '@/App.vue'
import { createApp } from 'vue'
import { registerPlugins } from '@core/utils/plugins'

// Styles



// Create vue app
const app = createApp(App)


// Register plugins
registerPlugins(app)

// Mount vue app
app.mount('#app')
