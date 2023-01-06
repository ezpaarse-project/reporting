import { setup } from 'reporting-sdk-js';
import type Vue from 'vue';
import components from './components';

type ReportingOptions = {
  url?: 'string',
};

export default {
  install(app: typeof Vue, options: ReportingOptions) {
    setup.setURL(options.url ?? 'http://localhost:8080');
    // eslint-disable-next-line no-restricted-syntax
    for (const [name, component] of Object.entries(components)) {
      app.component(name, component);
    }
  },
};